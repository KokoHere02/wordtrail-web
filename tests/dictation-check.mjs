// Real Vue UI with scripted Section 20 server decisions. This does not test the backend judge.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';
import { AxiosError } from 'axios';
const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', define: { 'import.meta.env.VITE_UI_PREVIEW': '"false"' }, logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-dictation-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/dictation-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { router, http, api, dailyApi, dictationApi, app } = await import('../.qa-dictation-dist/ui.js');
const document = window.document;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = value => JSON.parse(JSON.stringify(value));
async function until(predicate, label) {
  const deadline = Date.now() + 10000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error(`Timed out: ${label}\n${document.body.textContent}`); await sleep(20); }
}
function input(selector, value) { const element = document.querySelector(selector); assert.ok(element, selector); element.value = value; element.dispatchEvent(new window.Event('input', { bubbles: true })); }
function button(text) { return [...document.querySelectorAll('button')].find(element => element.textContent.trim() === text); }
async function click(text) { await until(() => button(text)?.disabled === false, `enabled ${text}`); button(text).click(); }
const ok = (config, value, status = 200) => ({ config, status, headers: {}, data: { code: 'OK', message: '成功', data: clone(value) } });
function reject(config, code, message = code, status = 409) { throw new AxiosError('explicit fixture rejection', 'ERR_BAD_RESPONSE', config, undefined, { config, status, headers: {}, data: { code, message, data: null } }); }
const pageOf = (records, params) => ({ page: Number(params.page), size: Number(params.size), total: records.length, records: records.slice((params.page - 1) * params.size, params.page * params.size) });
const groups = meaning => [{ partOfSpeech: 'n.', meaning }];
const tasks = new Map();
const events = [];
const requests = [];
let nextId = 901;
let createMode = 'normal';
let loseAction;
let staleOnce = false;
let reusedOnce = false;
let failNext = false;
let wrongModeOnce = false;
let failMistakes = false;
let emptyPlan = false;
let emptyResult = false;
const question = (itemId, presentationId, nextAttemptNo = 1, correctStreak = 0, requiredCorrectStreak = 1) => ({ itemId, prompt: itemId === 11 ? 'n. 苹果 [目标词]' : 'v. 放弃', promptGroups: groups(itemId === 11 ? '苹果 [目标词]' : '放弃'), presentationId, nextAttemptNo, correctStreak, requiredCorrectStreak, attemptLimit: 6 });
const task = batchId => ({ batchId, bookId: null, taskType: 'PRACTICE', practiceMode: 'DICTATION', status: 'IN_PROGRESS', totalCount: 2, completedCount: 0, passedCount: 0, needsPracticeCount: 0, attemptCount: 0, nextItemId: 11, attemptLimit: 6, createdAt: '2026-10-24T09:00:00', completedAt: null });
function makeTask(source = 'PLAN') {
  const batchId = nextId++;
  const steps = source === 'PLAN' ? [
    { q: question(11, `${batchId}-a`), verdict: 'INCORRECT', correctStreak: 0, itemStatus: 'RELEARNING', completionReason: null, counts: [0, 0, 0, 1], next: 22 },
    { q: question(22, `${batchId}-b`), verdict: 'REVEALED', correctStreak: 0, itemStatus: 'RELEARNING', completionReason: null, counts: [0, 0, 0, 2], next: 11 },
    { q: question(11, `${batchId}-c`, 2, 0, 2), verdict: 'CORRECT', correctStreak: 1, itemStatus: 'RELEARNING', completionReason: null, counts: [0, 0, 0, 3], next: 11 },
    { q: question(11, `${batchId}-d`, 3, 1, 2), verdict: 'CORRECT', correctStreak: 2, itemStatus: 'DONE', completionReason: 'RECALLED', counts: [1, 1, 0, 4], next: 22 },
    // A newer server state may contain attempts from another device. Never synthesize missing attempts.
    { q: question(22, `${batchId}-e`, 6, 0, 2), verdict: 'CORRECT', correctStreak: 1, itemStatus: 'DONE', completionReason: 'LIMIT_REACHED', counts: [2, 1, 1, 10], next: null },
  ] : [
    { q: question(22, `${batchId}-r1`, 1, 0, 2), verdict: 'CORRECT', correctStreak: 1, itemStatus: 'RELEARNING', completionReason: null, counts: [0, 0, 0, 1], next: 22 },
    { q: question(22, `${batchId}-r2`, 2, 1, 2), verdict: 'CORRECT', correctStreak: 2, itemStatus: 'DONE', completionReason: 'RECALLED', counts: [1, 1, 0, 2], next: null },
  ];
  const value = { task: { ...task(batchId), ...(source === 'MISTAKES' ? { totalCount: 1, nextItemId: 22 } : {}) }, steps, index: 0, receipts: new Map(), words: new Map(), source };
  tasks.set(batchId, value); return value;
}
function wordsFor(state) { return [...state.words.values()]; }
function mistakes() {
  const latest = new Map(); for (const state of tasks.values()) for (const word of wordsFor(state)) latest.set(word.wordId, word);
  return [...latest.values()].filter(word => word.learningStatus === 'RELEARNING' || word.completionReason === 'LIMIT_REACHED');
}
const planWords = Array.from({ length: 12 }, (_, index) => ({ wordId: 1001 + index, word: `plan-word-${index}`, phonetic: null, translation: 'n. 计划词', translationGroups: groups('计划词'), planStatus: 'ACTIVE', firstLearnedAt: '2026-01-01T00:00:00', lastLearnedAt: '2026-10-23T00:00:00', lastResult: 1, reviewLevel: 1, joinedAt: '2026-01-01T00:00:00', nextReviewAt: null }));
const fixture = http.defaults.adapter;
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  requests.push({ url: config.url, method: config.method, body: clone(body ?? null), params: config.params ? clone(config.params) : undefined, authenticated: typeof config.headers.get('Authorization') === 'string' });
  if (config.url === '/learning-plan/words' && config.method === 'get') {
    assert.equal(config.params.status, 'ACTIVE'); assert.equal(config.params.learningStatus, 'LEARNED');
    return ok(config, pageOf(emptyPlan ? [] : planWords, config.params));
  }
  if (!config.url.startsWith('/dictation/')) return fixture(config);
  if (config.url === '/dictation/batches' && config.method === 'post') {
    if (createMode === 'empty') return reject(config, 'NO_DICTATION_WORDS', '没有可选默写题');
    const value = makeTask(body.source);
    if (createMode === 'lost') throw new AxiosError('create outcome unknown', 'ECONNABORTED', config);
    return ok(config, value.task, 201);
  }
  if (config.url === '/dictation/batches') return ok(config, pageOf([...tasks.values()].map(value => value.task).filter(value => value.status === config.params.status).reverse(), config.params));
  if (config.url === '/dictation/mistakes') {
    if (failMistakes) { failMistakes = false; return reject(config, 'TEMPORARY', '错词列表暂不可用', 503); }
    return ok(config, pageOf(mistakes(), config.params));
  }
  const history = config.url.match(/^\/dictation\/words\/(\d+)\/history$/);
  if (history) return ok(config, pageOf(events.filter(event => event.wordId === Number(history[1])).map(({ wordId, ...event }) => event).reverse(), config.params));
  const match = config.url.match(/^\/dictation\/batches\/(\d+)(?:\/(next|result\/words|items\/(\d+)\/answer))?$/);
  assert.ok(match, `documented endpoint: ${config.url}`);
  const state = tasks.get(Number(match[1]));
  if (!state) return reject(config, 'BATCH_NOT_FOUND', '默写批次不存在', 404);
  if (wrongModeOnce) { wrongModeOnce = false; return reject(config, 'NOT_DICTATION_TASK', '这不是默写任务'); }
  if (!match[2]) return ok(config, state.task);
  if (match[2] === 'result/words') {
    if (state.task.status !== 'COMPLETED') return reject(config, 'DICTATION_NOT_COMPLETED');
    return ok(config, pageOf(emptyResult ? [] : wordsFor(state), config.params));
  }
  if (match[2] === 'next') {
    assert.equal(body ?? null, null);
    assert.equal(document.querySelector('.dictation-expected'), null, 'answer removed before POST next');
    assert.equal(document.querySelector('#dictation-input')?.value || '', '', 'input cleared before POST next');
    if (failNext) { failNext = false; throw new AxiosError('next timeout', 'ECONNABORTED', config); }
    if (state.task.status !== 'IN_PROGRESS') return reject(config, 'DICTATION_NOT_IN_PROGRESS');
    return ok(config, state.steps[state.index].q);
  }
  if (staleOnce) { staleOnce = false; state.steps[state.index].q.presentationId += '-renewed'; return reject(config, 'STALE_DICTATION_ANSWER', '题目标识已过期'); }
  if (reusedOnce) { reusedOnce = false; return reject(config, 'REQUEST_ID_REUSED', '请求键冲突'); }
  const cached = state.receipts.get(body.requestId);
  if (cached) { assert.deepEqual(body, cached.body); return ok(config, { ...cached.value, progress: state.task }); }
  const step = state.steps[state.index];
  assert.equal(body.presentationId, step.q.presentationId); assert.equal(body.attemptNo, step.q.nextAttemptNo); assert.equal(Number(match[3]), step.q.itemId);
  assert.deepEqual(Object.keys(body).sort(), (body.action === 'ANSWER' ? ['action', 'input', 'attemptNo', 'presentationId', 'requestId'] : ['action', 'attemptNo', 'presentationId', 'requestId']).sort());
  const [completedCount, passedCount, needsPracticeCount, attemptCount] = step.counts;
  Object.assign(state.task, { completedCount, passedCount, needsPracticeCount, attemptCount, nextItemId: step.next, status: step.next === null ? 'COMPLETED' : 'IN_PROGRESS', completedAt: step.next === null ? '2026-10-24T10:00:00' : null });
  const expectedWord = step.q.itemId === 11 ? 'apple' : 'abandon';
  const value = { logId: events.length + 1, itemId: step.q.itemId, action: body.action, submittedAnswer: body.action === 'ANSWER' ? body.input : null, expectedWord, translation: 'n. 服务端答案释义', translationGroups: groups('服务端答案释义'), verdict: step.verdict, attemptNo: step.q.nextAttemptNo, correctStreak: step.correctStreak, itemStatus: step.itemStatus, completionReason: step.completionReason, answeredAt: '2026-10-24T09:01:00', affectsSchedule: false, progress: clone(state.task) };
  const wordId = step.q.itemId === 11 ? 1001 : 1011;
  state.words.set(wordId, { itemId: step.q.itemId, wordId, word: expectedWord, translation: value.translation, translationGroups: value.translationGroups, lastVerdict: value.verdict, lastInput: value.submittedAnswer, attemptCount: value.attemptNo, correctStreak: value.correctStreak, learningStatus: value.itemStatus, completionReason: value.completionReason, learningDate: '2026-10-24', answeredAt: value.answeredAt });
  events.push({ wordId, logId: value.logId, batchId: state.task.batchId, itemId: value.itemId, learningDate: '2026-10-24', answeredAt: value.answeredAt, taskType: 'PRACTICE', practiceMode: 'DICTATION', action: value.action, input: value.submittedAnswer, expectedWord, verdict: value.verdict, attemptNo: value.attemptNo, correctStreakBefore: step.q.correctStreak, correctStreakAfter: value.correctStreak, itemStatusAfter: value.itemStatus, completionReason: value.completionReason, affectsSchedule: false });
  state.index++; state.receipts.set(body.requestId, { body: clone(body), value: clone(value) });
  if (loseAction === body.action) { loseAction = undefined; throw new AxiosError('lost saved answer', 'ECONNABORTED', config); }
  return ok(config, value);
};
const writes = () => requests.filter(call => call.method === 'put' && call.url.startsWith('/dictation/'));
const creates = () => requests.filter(call => call.method === 'post' && call.url === '/dictation/batches');
const nexts = () => requests.filter(call => call.url.endsWith('/next'));
async function readyQuestion() { await until(() => document.querySelector('#dictation-input')?.disabled === false, 'new question accepts input'); assert.equal(document.querySelector('.dictation-expected'), null); }
async function nextQuestion() { await click('隐藏答案，下一题'); await readyQuestion(); }
await until(() => document.querySelector('#username'), 'login');
input('#username', 'dictation_reader'); input('#password', 'example123'); await click('登录');
await until(() => document.querySelector('.daily-equation'), 'authenticated');
const beforeDaily = await dailyApi.today();
await router.push('/dictation/mistakes'); await until(() => document.querySelector('.state-panel')?.textContent.includes('暂无已记录'), 'empty mistakes');
assert.equal(button('重练待巩固词').disabled, true);
await router.push('/dictation'); await until(() => document.querySelectorAll('.dictation-plan-row').length === 10, 'eligible plan candidates');
assert.equal(creates().length, 0, 'GET entry never creates tasks');
input('#dictation-count', '0'); await click('从计划开始默写');
await until(() => document.querySelector('.inline-error')?.textContent.includes('1～100'), 'count validation'); assert.equal(creates().length, 0);
document.querySelector('input[aria-label="默写选词 plan-word-0"]').click();
document.querySelector('.wordlist-sheet [aria-label="下一页"]').click();
await until(() => document.querySelector('input[aria-label="默写选词 plan-word-10"]'), 'plan page two');
document.querySelector('input[aria-label="默写选词 plan-word-10"]').click();
await until(() => button('默写所选 2 词')?.disabled === false, 'cross-page selection');
button('默写所选 2 词').click(); button('默写所选 2 词').click();
await readyQuestion();
const mainId = Number(router.currentRoute.value.params.batchId);
assert.equal(creates().length, 1); assert.deepEqual(creates()[0].body, { source: 'PLAN', wordIds: [1001, 1011] });
assert.equal(document.querySelector('.dictation-prompt').textContent.includes('[目标词]'), true);
assert.equal(document.querySelector('.dictation-card').textContent.includes('apple'), false);
assert.equal(requests.some(call => /^\/words\//.test(call.url)), false, 'study never fetches an English dictionary answer');
const beforeBlank = writes().length;
await click('提交答案'); await until(() => document.querySelector('#dictation-validation'), 'blank input blocked'); assert.equal(writes().length, beforeBlank);
loseAction = 'ANSWER'; input('#dictation-input', '  aple  ');
button('提交答案').click(); button('不会／看答案').click();
await until(() => document.querySelector('.dictation-error')?.textContent.includes('请求超时'), 'unknown saved answer');
assert.equal(writes().length, beforeBlank + 1); const firstBody = clone(writes().at(-1).body);
assert.equal(firstBody.input, '  aple  ', 'input is not normalized on the client');
const issuedBeforeReload = nexts().length;
await router.push('/dictation'); await until(() => document.querySelector('.dictation-home'), 'leave pending answer');
// Workspace navigation retains the current view; the pending write is also persisted for a real reload.
await router.push(`/dictation/${mainId}`);
await until(() => document.querySelector('.dictation-error')?.textContent.includes('请求超时'), 'cached pending request retained');
assert.equal(nexts().length, issuedBeforeReload, 'do not issue a different question while outcome is unknown');
assert.equal(document.querySelector('.dictation-expected'), null);
document.querySelector('[aria-label="打开账户菜单"]').click(); await until(() => button('退出登录'), 'logout before pending recovery');
await click('退出登录'); await until(() => document.querySelector('#username'), 'logged out');
input('#username', 'dictation_reader'); input('#password', 'example123'); await click('登录');
await until(() => document.querySelector('.daily-equation'), 'relogged in');
await router.push(`/dictation/${mainId}`); await until(() => document.querySelector('.dictation-error')?.textContent.includes('上次提交结果尚未确认'), 'pending survives same-account relogin');
assert.equal(nexts().length, issuedBeforeReload);
await click('重试原请求'); await until(() => document.querySelector('.dictation-verdict')?.textContent === '未命中本题目标词', 'retry shows server verdict');
assert.deepEqual(writes().at(-1).body, firstBody); assert.equal(events.length, 1);
assert.equal(document.querySelector('.dictation-expected').textContent, 'apple');
assert.equal(nexts().length, issuedBeforeReload, 'feedback waits for explicit next');
await nextQuestion(); loseAction = 'REVEAL';
await click('不会／看答案'); await until(() => document.querySelector('.dictation-error')?.textContent.includes('请求超时'), 'REVEAL outcome unknown');
const revealBody = clone(writes().at(-1).body); assert.equal('input' in revealBody, false);
await click('重试原请求'); await until(() => document.querySelector('.dictation-verdict')?.textContent === '已查看答案', 'REVEAL retry');
assert.deepEqual(writes().at(-1).body, revealBody); assert.equal(events.length, 2);
await nextQuestion();
assert.match(document.querySelector('.dictation-card').textContent, /连续命中 0 \/ 2/);
const outstandingPresentation = tasks.get(mainId).steps[tasks.get(mainId).index].q.presentationId;
await router.push('/dictation'); await until(() => document.querySelector('.dictation-home'), 'refresh unanswered question');
await router.push(`/dictation/${mainId}`); await readyQuestion();
assert.equal(tasks.get(mainId).steps[tasks.get(mainId).index].q.presentationId, outstandingPresentation, 'unanswered issuance is restored by backend');
assert.equal(document.querySelector('#dictation-input').value, ''); assert.equal(events.length, 2);
staleOnce = true; input('#dictation-input', 'expired draft'); const beforeStale = nexts().length;
await click('提交答案'); await until(() => document.querySelector('.dictation-error')?.textContent.includes('题目已过期'), 'stale presentation rejected');
assert.equal(nexts().length, beforeStale); assert.equal(events.length, 2); assert.equal(document.querySelector('#dictation-input'), null);
await click('重新获取题目'); await readyQuestion(); assert.equal(document.querySelector('#dictation-input').value, '');
input('#dictation-input', 'server-accepted-spelling'); await click('提交答案');
await until(() => document.querySelector('.dictation-verdict')?.textContent === '拼写命中', 'server judge owns correctness');
assert.equal(tasks.get(mainId).task.completedCount, 0);
assert.match(document.querySelector('.dictation-feedback-note').textContent, /仍需继续验证/);
await nextQuestion(); assert.match(document.querySelector('.dictation-card').textContent, /第 3 次/);
input('#dictation-input', ' Apple '); await click('提交答案'); await until(() => document.querySelector('.dictation-feedback-note')?.textContent.includes('通过本轮验证'), 'second consecutive server success');
await nextQuestion(); assert.match(document.querySelector('.dictation-card').textContent, /第 6 次 \/ 上限 6 次/);
input('#dictation-input', 'abandon'); await click('提交答案');
await until(() => document.querySelector('.dictation-feedback-note')?.textContent.includes('本轮结束，仍需巩固'), 'CORRECT does not override LIMIT_REACHED');
assert.equal(router.currentRoute.value.path, `/dictation/${mainId}`);
await click('查看默写结果'); await until(() => document.querySelector('.dictation-stats'), 'server result summary');
assert.deepEqual([...document.querySelectorAll('.dictation-stats dd')].map(node => Number(node.textContent)), [2, 2, 1, 1, 10]);
assert.equal(document.body.textContent.includes('已掌握'), false);
const resultNextCount = nexts().length;
await router.push('/dictation'); await until(() => document.querySelector('.dictation-home'), 'leave result');
await router.push(`/dictation/${mainId}`); await click('查看默写结果'); await until(() => document.querySelector('.dictation-stats'), 'cached completion opens GET-only result');
assert.equal(nexts().length, resultNextCount);
assert.equal(new Set(writes().filter((call, index, all) => all.findIndex(other => other.body.requestId === call.body.requestId) === index).map(call => call.body.requestId)).size, 6, 'new actions have distinct keys, retries retain keys');
assert.deepEqual(await dailyApi.today(), beforeDaily);
assert.equal(requests.some(call => call.method !== 'get' && (/^\/learning/.test(call.url))), false);
console.log('PASS ordered plan selection, create guard, prompt-only questions, raw input, ANSWER/REVEAL exact retries, stale recovery, repeated items and backend-only verdict/status/counts');

await router.push('/dictation/mistakes'); await until(() => document.querySelector('.dictation-mistakes .dictation-word-row'), 'server mistakes');
assert.match(document.querySelector('.dictation-word-feedback').textContent, /拼写命中.*尝试 6 次/);
assert.match(document.querySelector('.dictation-word-feedback').textContent, /本轮结束，仍需巩固/);
const oldHistoryReads = requests.filter(call => /^\/learning-plan\/words\/\d+\/history$/.test(call.url)).length;
await click('默写历史'); await until(() => document.querySelectorAll('.dictation-history-event').length === 2, 'dictation-only history');
assert.equal(requests.filter(call => /^\/learning-plan\/words\/\d+\/history$/.test(call.url)).length, oldHistoryReads);
await click('认识记录'); await until(() => document.querySelector('[role=dialog] .state-panel')?.textContent.includes('不能解释为从未学习'), 'recognition history stays separate');
assert.equal(document.querySelector('.dictation-history-event'), null);
await click('默写记录'); await until(() => document.querySelector('.dictation-history-event'), 'history type switch');
document.querySelector('[aria-label="关闭弹窗"]').click(); await until(() => !document.querySelector('[role=dialog]'), 'history closed');
document.querySelector('input[aria-label="选择默写错词 abandon"]').click();
const originalResult = clone(tasks.get(mainId).task);
await click('重练所选 1 词'); await readyQuestion();
const repeatId = Number(router.currentRoute.value.params.batchId);
assert.notEqual(repeatId, mainId); assert.deepEqual(creates().at(-1).body, { source: 'MISTAKES', wordIds: [1011] });
assert.match(document.querySelector('.dictation-card').textContent, /连续命中 0 \/ 2/);
assert.equal((await dictationApi.mistakes({ page: 1, size: 10 })).total, 1, 'creation and next do not clear mistakes');
input('#dictation-input', 'abandon'); await click('提交答案'); await until(() => button('隐藏答案，下一题')?.disabled === false, 'first retrain success');
assert.equal(tasks.get(repeatId).task.completedCount, 0);
await nextQuestion(); input('#dictation-input', 'abandon'); await click('提交答案'); await click('查看默写结果');
await until(() => document.querySelector('.dictation-stats'), 'retrain result');
assert.deepEqual(tasks.get(mainId).task, originalResult);
assert.equal((await dictationApi.mistakes({ page: 1, size: 10 })).total, 0);
console.log('PASS completed GET restore, five result metrics, independent history types, current mistakes and two-step new-batch retraining');

// No events are invented when lists or results are empty, and no ended task is judged locally.
const interrupted = makeTask();
await router.push(`/dictation/${interrupted.task.batchId}/result`);
await until(() => document.body.textContent.includes('本轮尚未结束'), 'uncompleted result gate');
assert.equal(requests.some(call => call.url === `/dictation/batches/${interrupted.task.batchId}/result/words`), false);
const previousIssueCount = nexts().length; failNext = true;
await router.push(`/dictation/${interrupted.task.batchId}`); await until(() => document.querySelector('.dictation-error')?.textContent.includes('请求超时'), 'next failure');
await click('重新获取题目'); await readyQuestion(); assert.equal(nexts().length, previousIssueCount + 2);
reusedOnce = true; input('#dictation-input', 'x'); await click('提交答案');
await until(() => document.querySelector('.dictation-error')?.textContent.includes('勿更换请求键重放'), 'request key reuse stopped');
assert.equal(button('重试原请求'), undefined);
assert.equal(interrupted.index, 0);
const noQueue = makeTask(); noQueue.task.nextItemId = null;
const noQueueNextCount = nexts().length;
await router.push(`/dictation/${noQueue.task.batchId}`); await until(() => document.querySelector('.dictation-error')?.textContent.includes('服务端暂未提供'), 'no local completion for missing queue');
assert.equal(nexts().length, noQueueNextCount);
wrongModeOnce = true;
await router.push('/dictation/9999'); await until(() => document.querySelector('.dictation-error')?.textContent.includes('不存在'), 'inaccessible batch');
// The fixture checks existence first, so exercise wrong-mode on an accessible task.
wrongModeOnce = true; await router.push(`/dictation/${noQueue.task.batchId}`); await until(() => document.querySelector('.dictation-error')?.textContent.includes('这不是默写任务'), 'type endpoint isolation');
emptyResult = true; await router.push(`/dictation/${mainId}/result`); await until(() => document.querySelector('.state-panel')?.textContent.includes('本轮暂无可回顾'), 'empty result words'); emptyResult = false;
failMistakes = true; await router.push('/dictation/mistakes'); await until(() => document.querySelector('.state-panel')?.textContent.includes('错词列表暂不可用'), 'mistakes failure');
await click('重新加载'); await until(() => document.querySelector('.state-panel')?.textContent.includes('暂无已记录'), 'empty mistakes retry');
emptyPlan = true; createMode = 'empty'; await router.push('/dictation'); await until(() => document.querySelector('.wordlist-sheet .state-panel')?.textContent.includes('暂无符合条件'), 'empty plan');
await click('从计划开始默写'); await until(() => document.querySelector('.dictation-launch-error')?.textContent.includes('没有可选默写题'), 'no empty batch creation');
assert.equal(tasks.size, 4);
createMode = 'lost'; emptyPlan = false;
await router.push('/records'); await until(() => document.querySelector('.records-page'), 'leave before unknown creation');
await router.push('/dictation'); await until(() => document.querySelector('.dictation-plan-row'), 'new entry');
const beforeUnknownCreate = creates().length;
await click('从计划开始默写'); await until(() => document.querySelector('.dictation-launch-error')?.textContent.includes('创建结果尚未确认'), 'unknown create handled');
assert.equal(button('从计划开始默写').disabled, true);
await click('刷新默写记录'); await until(() => document.querySelectorAll('.dictation-task-row').length === 3, 'GET task list recovers unknown creation');
assert.equal(creates().length, beforeUnknownCreate + 1);
assert.deepEqual(creates().at(-1).body, { source: 'PLAN', count: 20 });
assert.equal(requests.filter(call => call.url.startsWith('/dictation/')).every(call => call.authenticated), true);
console.log('PASS unfinished/empty data, next retry, inaccessible/wrong-mode task, request-key conflict, missing queue and non-idempotent create recovery without auto retry');
await click('已完成'); await until(() => document.querySelectorAll('.dictation-task-row').length === 2, 'completed task filter');
assert.equal(document.querySelectorAll('.dictation-task-row a[href$="/result"]').length, 2);
noQueue.task.status = 'ABANDONED'; await click('已放弃');
await until(() => document.querySelectorAll('.dictation-task-row').length === 1 && document.querySelector('.dictation-task-row')?.textContent.includes('已放弃'), 'abandoned task filter');
assert.equal(document.querySelectorAll('.dictation-task-row a').length, 0, 'no fabricated abandon/resume operation');
const paged = makeTask();
Object.assign(paged.task, { totalCount: 12, completedCount: 12, passedCount: 0, needsPracticeCount: 12, attemptCount: 72, nextItemId: null, status: 'COMPLETED' });
for (let index = 0; index < 12; index++) paged.words.set(2001 + index, { itemId: 3001 + index, wordId: 2001 + index, word: `snapshot-${index}`, translation: 'n. 后端快照', translationGroups: groups('后端快照'), lastVerdict: 'CORRECT', lastInput: 'server-recorded', attemptCount: 6, correctStreak: 1, learningStatus: 'DONE', completionReason: 'LIMIT_REACHED', learningDate: '2026-10-24', answeredAt: '2026-10-24T10:00:00' });
await router.push(`/dictation/${paged.task.batchId}/result`);
await until(() => document.querySelectorAll('.dictation-result .dictation-word-row').length === 10, 'result first page');
assert.deepEqual([...document.querySelectorAll('.dictation-stats dd')].map(node => Number(node.textContent)), [12, 12, 0, 12, 72]);
document.querySelector('.dictation-result > .pagination [aria-label="下一页"]').click();
await until(() => document.querySelectorAll('.dictation-result .dictation-word-row').length === 2, 'result next page');
assert.deepEqual(requests.filter(call => call.url === `/dictation/batches/${paged.task.batchId}/result/words`).at(-1).params, { page: 2, size: 10 });
await click('默写历史'); await until(() => document.querySelector('[role=dialog] .state-panel')?.textContent.includes('暂无已记录的默写事件'), 'empty dictation history');
document.querySelector('[aria-label="关闭弹窗"]').click(); await until(() => !document.querySelector('[role=dialog]'), 'empty history closed');
await router.push('/dictation/mistakes'); await until(() => document.querySelectorAll('.dictation-mistakes .dictation-word-row').length === 10, 'mistakes first page');
document.querySelector('input[aria-label="选择默写错词 snapshot-0"]').click();
document.querySelector('.dictation-mistakes .pagination [aria-label="下一页"]').click();
await until(() => document.querySelector('input[aria-label="选择默写错词 snapshot-10"]'), 'mistakes second page');
document.querySelector('input[aria-label="选择默写错词 snapshot-10"]').click();
await until(() => button('重练所选 2 词')?.disabled === false, 'mistake selection spans pages');
assert.equal(requests.some(call => /dictation.*(?:abandon|relearn|result$)/.test(call.url)), false, 'only documented endpoints used');
console.log('PASS task status filters, result/mistake pagination, totals independent of current page, cross-page selection and empty history');
app.unmount(); await window.happyDOM.close();
console.log('Dictation frontend checks passed with scripted fixtures. Browser layout and real backend judging remain separate validation.');
