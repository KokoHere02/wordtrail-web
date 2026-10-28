import { chooseSelect } from './helpers/choose-select.mjs';
// Actual Vue frontend with explicit Section 21 fixtures. No translation judging is simulated.
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
await build({ configFile: false, plugins: [vue()], mode: 'mock', define: { 'import.meta.env.VITE_UI_PREVIEW': '"false"' }, logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-sentences-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/sentences-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { router, http, api, dailyApi, sentencesApi, useAuthStore, app } = await import('../.qa-sentences-dist/ui.js');
const document = window.document;
const clone = value => JSON.parse(JSON.stringify(value));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) { const deadline = Date.now() + 10000; while (!predicate()) { if (Date.now() > deadline) throw new Error(`Timed out: ${label}\n${document.body.textContent}`); await sleep(20); } }
function input(selector, value) { const element = document.querySelector(selector); assert.ok(element, selector); element.value = value; element.dispatchEvent(new window.Event('input', { bubbles: true })); element.dispatchEvent(new window.Event('change', { bubbles: true })); }
function button(text) { return [...document.querySelectorAll('button')].find(element => element.textContent.trim() === text); }
async function click(text) { await until(() => button(text)?.disabled === false, `enabled ${text}`); button(text).click(); }
async function go(path, selector) { await router.push(path); await until(() => document.querySelector(selector), `mounted ${path}`); }
const base = '/sentence-translation';
const user = () => useAuthStore().user?.id;
const calls = [];
const questions = Array.from({ length: 13 }, (_, index) => ({ sentenceId: index + 1, englishText: index === 6 ? 'Plain text <img src=x> must stay text.' : `I read sentence ${index + 1} today.`, difficulty: index % 3 + 1, source: '原创试用来源，不代表权威认证', sourceReference: index ? null : '示例 A', active: index < 12, wordIds: index % 2 === 0 ? [1001] : [1002], referenceTranslation: `参考译文 ${index + 1}，中文措辞可以不同。`, explanation: `解析 ${index + 1}：核对核心含义，不做字符串判分。\n<script>plain text</script>` }));
const favorites = new Map();
const sessions = new Map();
const attempts = [];
const submissionKeys = new Map();
const reviewKeys = new Map();
let nextSession = 501;
let nextItem = 601;
let loseStage;
let loseCreate = false;
let bankEmpty = false;
let failRead;
let conflict;
let unauthorizedReads = 0;
const ok = (config, data, status = 200) => ({ config, status, headers: {}, data: { code: 'OK', message: '成功', data: clone(data) } });
function reject(config, code, message = code, status = 409) { throw new AxiosError('explicit fixture error', 'ERR_BAD_RESPONSE', config, undefined, { config, status, headers: {}, data: { code, message, data: null } }); }
const pageOf = (records, params) => ({ page: Number(params.page), size: Number(params.size), total: records.length, records: records.slice((params.page - 1) * params.size, params.page * params.size) });
function favoriteSet() { if (!favorites.has(user())) favorites.set(user(), new Set()); return favorites.get(user()); }
function reviews() {
  const latest = new Map(); for (const attempt of attempts.filter(value => value.owner === user() && value.selfAssessment !== null)) latest.set(attempt.sentenceId, attempt);
  return [...latest.values()].filter(attempt => attempt.selfAssessment !== 'UNDERSTOOD').reverse().map(attempt => ({ sentenceId: attempt.sentenceId, englishText: attempt.englishText, difficulty: attempt.difficulty, available: questions.find(value => value.sentenceId === attempt.sentenceId)?.active === true, attemptId: attempt.attemptId, selfAssessment: attempt.selfAssessment, reviewedAt: attempt.reviewedAt }));
}
function progress(state) {
  const saved = state.items.map(item => item.attempt).filter(Boolean);
  const done = state.items.filter(item => item.status === 'DONE').length;
  const next = state.items.find(item => item.status !== 'DONE');
  return { sessionId: state.id, selectionSource: state.source, status: next ? 'IN_PROGRESS' : 'COMPLETED', totalCount: state.items.length, submissionCount: saved.length, answerCount: saved.filter(value => value.action === 'ANSWER').length, revealCount: saved.filter(value => value.action === 'REVEAL').length, selfReviewCount: done, completedCount: done, understoodCount: saved.filter(value => value.selfAssessment === 'UNDERSTOOD').length, partialCount: saved.filter(value => value.selfAssessment === 'PARTIAL').length, notUnderstoodCount: saved.filter(value => value.selfAssessment === 'NOT_UNDERSTOOD').length, nextItemId: next?.itemId ?? null, createdAt: state.createdAt, completedAt: next ? null : '2026-10-24T00:02:00' };
}
function history(attempt) { const { owner, difficulty, ...value } = attempt; return value; }
function feedback(state, attempt) { const { englishText, sessionId, ...value } = history(attempt); return { ...value, progress: progress(state) }; }
function current(state) {
  const item = state.items.find(item => item.status !== 'DONE');
  if (!item) return null;
  const attempt = item.attempt;
  return { itemId: item.itemId, sentenceId: item.sentenceId, status: item.status, englishText: item.englishText, difficulty: item.difficulty, source: item.source, sourceReference: item.sourceReference, linkedWords: item.wordIds.map(wordId => ({ wordId, word: wordId === 1001 ? 'abandon' : 'absorb' })), attemptId: attempt?.attemptId ?? null, action: attempt?.action ?? null, translation: attempt?.translation ?? null, referenceTranslation: attempt ? item.referenceTranslation : null, explanation: attempt ? item.explanation : null, selfAssessment: attempt?.selfAssessment ?? null, submittedAt: attempt?.submittedAt ?? null };
}
function create(source, ids) { const state = { id: nextSession++, owner: user(), source, createdAt: '2026-10-23T23:58:00', items: ids.map(id => ({ ...clone(questions.find(value => value.sentenceId === id)), itemId: nextItem++, status: 'PENDING', attempt: null })) }; sessions.set(state.id, state); return state; }
const fixture = http.defaults.adapter;
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  calls.push({ url: config.url, method: config.method, body: clone(body ?? null), params: config.params ? clone(config.params) : undefined, authenticated: typeof config.headers.get('Authorization') === 'string' });
  if (!config.url.startsWith(`${base}/`)) return fixture(config);
  if (config.url === `${base}/management/access`) return ok(config, { canManage: false });
  if (unauthorizedReads && config.method === 'get' && !config._retried) { unauthorizedReads--; return reject(config, 'UNAUTHENTICATED', '登录失效', 401); }
  if (failRead && config.url.endsWith(failRead)) { failRead = undefined; return reject(config, 'TEMPORARY', '读取暂时失败', 503); }
  if (config.url === `${base}/questions` || config.url === `${base}/favorites`) {
    assert.equal(Object.keys(config.params).every(key => ['page', 'size', 'difficulty', 'wordId'].includes(key)), true);
    const filtered = questions.filter(question => question.active && !bankEmpty && (!config.params.difficulty || question.difficulty === config.params.difficulty) && (!config.params.wordId || question.wordIds.includes(config.params.wordId)) && (config.url.endsWith('/questions') || favoriteSet().has(question.sentenceId))).map(({ active, wordIds, referenceTranslation, explanation, ...question }) => ({ ...question, favorite: favoriteSet().has(question.sentenceId) }));
    return ok(config, pageOf(filtered, config.params));
  }
  const fav = config.url.match(/\/questions\/(\d+)\/favorite$/);
  if (fav) {
    assert.deepEqual(Object.keys(body), ['favorite']); const question = questions.find(value => value.sentenceId === Number(fav[1]));
    if (!question || body.favorite && !question.active) return reject(config, 'SENTENCE_NOT_FOUND', '句子已停用或不存在', 404);
    if (body.favorite) favoriteSet().add(question.sentenceId); else favoriteSet().delete(question.sentenceId);
    return ok(config, { sentenceId: question.sentenceId, favorite: body.favorite });
  }
  if (config.url === `${base}/review-queue`) { assert.deepEqual(Object.keys(config.params).sort(), ['page', 'size']); return ok(config, pageOf(reviews(), config.params)); }
  const h = config.url.match(/\/questions\/(\d+)\/history$/);
  if (h) return ok(config, pageOf(attempts.filter(value => value.owner === user() && value.sentenceId === Number(h[1])).map(history).reverse(), config.params));
  if (config.url === `${base}/sessions` && config.method === 'get') return ok(config, pageOf([...sessions.values()].filter(state => state.owner === user() && progress(state).status === config.params.status).reverse().map(progress), config.params));
  if (config.url === `${base}/sessions`) {
    assert.equal(Object.keys(body).every(key => ['source', 'count', 'sentenceIds', 'difficulty', 'wordId'].includes(key)), true);
    assert.equal('count' in body && 'sentenceIds' in body, false);
    let eligible = questions.filter(question => question.active && (!body.difficulty || body.difficulty === question.difficulty) && (!body.wordId || question.wordIds.includes(body.wordId)) && (body.source === 'BANK' || body.source === 'FAVORITES' && favoriteSet().has(question.sentenceId) || body.source === 'REVIEW' && reviews().some(value => value.sentenceId === question.sentenceId)));
    if (bankEmpty) eligible = [];
    const ids = body.sentenceIds ? [...new Set(body.sentenceIds)] : eligible.slice(0, body.count).map(value => value.sentenceId);
    if (body.sentenceIds && ids.some(id => !eligible.some(value => value.sentenceId === id))) return reject(config, 'SENTENCE_UNAVAILABLE', '所选句子已停用或不符合条件，整轮未创建');
    if (!ids.length) return reject(config, 'NO_SENTENCE_QUESTIONS', '当前来源没有可用句子');
    const state = create(body.source, ids);
    if (loseCreate) { loseCreate = false; throw new AxiosError('unknown create outcome', 'ECONNABORTED', config); }
    return ok(config, progress(state), 201);
  }
  const match = config.url.match(/\/sessions\/(\d+)(?:\/(current|result|items\/(\d+)\/(submission|self-review)))?$/);
  assert.ok(match, `documented endpoint ${config.url}`);
  const state = sessions.get(Number(match[1]));
  if (!state || state.owner !== user()) return reject(config, 'SENTENCE_SESSION_NOT_FOUND', '练习不存在或无权访问', 404);
  if (!match[2]) return ok(config, progress(state));
  if (match[2] === 'current') return ok(config, current(state));
  if (match[2] === 'result') {
    if (progress(state).status !== 'COMPLETED') return reject(config, 'SENTENCE_SESSION_NOT_COMPLETED', '本轮尚未完成');
    assert.deepEqual(Object.keys(config.params).sort(), ['page', 'size']);
    return ok(config, pageOf(state.items.map(item => history(item.attempt)).reverse(), config.params));
  }
  const kind = match[4]; const item = state.items.find(value => value.itemId === Number(match[3]));
  if (!item) return reject(config, 'SENTENCE_ITEM_NOT_FOUND');
  if (conflict) { const code = conflict; conflict = undefined; return reject(config, code, code); }
  const keys = kind === 'submission' ? submissionKeys : reviewKeys;
  const key = `${user()}:${body.requestId}`;
  const cached = keys.get(key);
  if (cached) { assert.deepEqual(body, cached.body); assert.equal(item.itemId, cached.itemId); return ok(config, feedback(state, cached.attempt)); }
  if (kind === 'submission') {
    assert.deepEqual(Object.keys(body).sort(), (body.action === 'ANSWER' ? ['action', 'translation', 'requestId'] : ['action', 'requestId']).sort());
    if (item.status !== 'PENDING' || current(state)?.itemId !== item.itemId) return reject(config, 'STALE_SENTENCE_ITEM', '旧题已提交');
    const attempt = { owner: user(), difficulty: item.difficulty, attemptId: attempts.length + 701, sessionId: state.id, itemId: item.itemId, sentenceId: item.sentenceId, englishText: item.englishText, action: body.action, translation: body.action === 'ANSWER' ? body.translation : null, referenceTranslation: item.referenceTranslation, explanation: item.explanation, selfAssessment: null, learningDate: '2026-10-23', submittedAt: '2026-10-23T23:59:30', reviewDate: null, reviewedAt: null };
    item.attempt = attempt; item.status = 'AWAITING_REVIEW'; attempts.push(attempt);
  } else {
    assert.deepEqual(Object.keys(body).sort(), ['assessment', 'requestId']);
    assert.ok(['UNDERSTOOD', 'PARTIAL', 'NOT_UNDERSTOOD'].includes(body.assessment));
    if (item.status !== 'AWAITING_REVIEW' || current(state)?.itemId !== item.itemId) return reject(config, 'SELF_REVIEW_NOT_ALLOWED', '不能覆盖自评');
    Object.assign(item.attempt, { selfAssessment: body.assessment, reviewDate: '2026-10-24', reviewedAt: '2026-10-24T00:01:00' }); item.status = 'DONE';
  }
  keys.set(key, { itemId: item.itemId, body: clone(body), attempt: item.attempt });
  if (loseStage === kind) { loseStage = undefined; throw new AxiosError('saved response lost', 'ECONNABORTED', config); }
  return ok(config, feedback(state, item.attempt));
};
const writes = suffix => calls.filter(call => call.method === 'put' && call.url.endsWith(suffix));
const creates = () => calls.filter(call => call.method === 'post' && call.url === `${base}/sessions`);
async function readyPending() { await until(() => document.querySelector('#sentence-translation')?.disabled === false, 'PENDING ready'); assert.equal(document.querySelector('.sentence-reference'), null); }
async function readyReview() { await until(() => button('部分理解')?.disabled === false, 'AWAITING_REVIEW ready'); assert.equal(document.querySelector('#sentence-translation'), null); }
async function login(name) { input('#username', name); input('#password', 'example123'); await click('登录'); await until(() => document.querySelector('.daily-equation'), 'logged in'); }
async function logout() { document.querySelector('[aria-label="打开账户菜单"]').click(); await until(() => button('退出登录'), 'profile'); await click('退出登录'); await until(() => document.querySelector('#username'), 'logged out'); }
await until(() => document.querySelector('#username'), 'login view'); await login('sentence_reader');
const originalDaily = await dailyApi.today(); const originalPractice = localStorage.getItem('wordtrail.mock.sentence_reader');
await go('/sentences/review', '.sentence-catalog'); await until(() => document.querySelector('.state-panel')?.textContent.includes('暂无已自评'), 'empty review queue');
await go('/sentences/favorites', '.sentence-catalog'); await until(() => document.querySelector('.state-panel')?.textContent.includes('暂无符合条件的收藏'), 'empty favorites');
await go('/sentences', '.sentence-catalog'); await until(() => document.querySelectorAll('.sentence-question-row').length === 10, 'bank first page');
assert.equal(document.querySelector('img[src=x]'), null, 'question text is never HTML');
assert.equal(creates().length, 0);
await chooseSelect(document, '难度', '进阶'); await click('应用筛选'); await until(() => document.querySelectorAll('.sentence-question-row').length === 4, 'difficulty filter');
await click('选择关联单词'); await until(() => document.querySelector('[role=dialog]'), 'word picker');
input('input[aria-label="查找关联单词"]', 'abandon'); await click('查找'); await click('选用 abandon');
await until(() => !document.querySelector('[role=dialog]'), 'picker closes'); await click('应用筛选');
await until(() => document.querySelectorAll('.sentence-question-row').length === 2, 'explicit word association filter');
assert.deepEqual(calls.filter(call => call.url === `${base}/questions`).at(-1).params, { page: 1, size: 10, difficulty: 2, wordId: 1001 });
await click('清除关联单词'); await chooseSelect(document, '难度', '全部难度'); await click('应用筛选'); await until(() => document.querySelectorAll('.sentence-question-row').length === 10, 'reset filters');
const favoriteButton = document.querySelector('[aria-label="收藏句子 1"]'); favoriteButton.click(); favoriteButton.click();
await until(() => document.querySelector('[aria-label="取消收藏句子 1"]'), 'favorite saved'); assert.equal(writes('/favorite').length, 1);
document.querySelector('[aria-label="收藏句子 3"]').click(); await until(() => document.querySelector('[aria-label="取消收藏句子 3"]'), 'second favorite');
await go('/sentences/favorites', '.sentence-catalog'); await until(() => document.querySelectorAll('.sentence-question-row').length === 2, 'favorites list');
document.querySelector('input[aria-label="选择句子 1"]').click(); document.querySelector('[aria-label="取消收藏句子 1"]').click();
await until(() => document.querySelectorAll('.sentence-question-row').length === 1 && document.querySelector('.sentence-library-note[role=status]')?.textContent.includes('移出所选'), 'unfavorite removes source selection');
await click('从收藏开始'); await readyPending(); const favoriteSessionId = Number(router.currentRoute.value.params.sessionId);
assert.deepEqual(creates().at(-1).body, { source: 'FAVORITES', count: 10 }); assert.equal(sessions.get(favoriteSessionId).items.length, 1, 'actual candidate count is authoritative');
await go('/sentences', '.sentence-catalog'); await until(() => document.querySelectorAll('.sentence-question-row').length === 10, 'bank for selection');
await click('作答历史'); await until(() => document.querySelector('[role=dialog] .state-panel')?.textContent.includes('暂无作答记录'), 'empty history');
document.querySelector('[aria-label="关闭弹窗"]').click(); await until(() => !document.querySelector('[role=dialog]'), 'history closed');
input('#sentence-count', '0'); await click('从题库开始'); await until(() => document.querySelector('.inline-error')?.textContent.includes('1～50'), 'count validation');
for (const id of [1, 2]) document.querySelector(`input[aria-label="选择句子 ${id}"]`).click();
document.querySelector('.sentence-catalog .pagination [aria-label="下一页"]').click(); await until(() => document.querySelector('input[aria-label="选择句子 11"]'), 'second catalog page');
document.querySelector('input[aria-label="选择句子 11"]').click(); await until(() => button('练习所选 3 句')?.disabled === false, 'cross-page selection');
button('练习所选 3 句').click(); button('练习所选 3 句').click(); await readyPending(); const mainId = Number(router.currentRoute.value.params.sessionId);
assert.deepEqual(creates().at(-1).body, { source: 'BANK', sentenceIds: [1, 2, 11] }); assert.equal(creates().length, 2);
assert.match(document.querySelector('.workspace-progress').textContent, /剩余 3 句/);
assert.equal(document.querySelector('.sentence-linked-words a').getAttribute('href'), '/words/1001');
const submitBefore = writes('/submission').length; await click('提交译文'); await until(() => document.querySelector('#sentence-validation'), 'blank translation');
input('#sentence-translation', '中'.repeat(2001)); await click('提交译文'); await until(() => document.querySelector('#sentence-validation'), 'translation length'); assert.equal(writes('/submission').length, submitBefore);
const raw = '  我的中文表达与参考措辞不同。\n第二行  '; input('#sentence-translation', raw); loseStage = 'submission';
button('提交译文').click(); button('不会，查看解析').click();
await until(() => document.querySelector('.sentence-session-error')?.textContent.includes('请求超时'), 'unknown submission');
assert.equal(writes('/submission').length, submitBefore + 1); const submitBody = clone(writes('/submission').at(-1).body); assert.equal(submitBody.translation, raw);
await go('/sentences/records', '.sentence-records'); await go(`/sentences/sessions/${mainId}`, '.sentence-study');
await until(() => document.querySelector('.sentence-session-error')?.textContent.includes('请求超时'), 'cached pending submission retained');
assert.equal(document.querySelector('#sentence-translation').disabled, true); assert.equal(button('部分理解'), undefined);
await logout(); await login('other_sentence_reader');
const noReplayCount = writes('/submission').length;
await go(`/sentences/sessions/${mainId}`, '.sentence-study'); await until(() => document.querySelector('.sentence-session-error')?.textContent.includes('无权访问'), 'other account denied');
assert.equal(button('重试原请求'), undefined); assert.equal(writes('/submission').length, noReplayCount, 'no cross-account pending replay');
await logout(); await login('sentence_reader'); await go(`/sentences/sessions/${mainId}`, '.sentence-study');
await until(() => document.querySelector('.sentence-original')?.textContent === raw && button('重试原请求')?.disabled === false, 'same-account cross-day awaiting restore');
await click('重试原请求'); await readyReview(); assert.deepEqual(writes('/submission').at(-1).body, submitBody); assert.equal(attempts.filter(value => value.sessionId === mainId).length, 1);
assert.equal(document.querySelector('.sentence-reference').textContent, questions[0].referenceTranslation);
assert.equal(document.querySelector('.sentence-explanation script'), null);
loseStage = 'self-review'; const reviewBefore = writes('/self-review').length;
button('部分理解').click(); button('未理解').click(); await until(() => document.querySelector('.sentence-session-error')?.textContent.includes('请求超时'), 'unknown self-review');
assert.equal(writes('/self-review').length, reviewBefore + 1); const reviewBody = clone(writes('/self-review').at(-1).body); assert.notEqual(reviewBody.requestId, submitBody.requestId);
await go('/sentences/records', '.sentence-records'); await go(`/sentences/sessions/${mainId}`, '.sentence-study');
await until(() => button('重试原请求')?.disabled === false, 'pending review restore blocks next item writes'); assert.equal(document.querySelector('#sentence-translation'), null); assert.equal(button('部分理解').disabled, true);
await click('重试原请求'); await readyPending(); assert.deepEqual(writes('/self-review').at(-1).body, reviewBody);
assert.equal(document.querySelector('[data-item-id]').dataset.itemId, String(sessions.get(mainId).items[1].itemId)); assert.equal(document.querySelector('.sentence-reference'), null);
loseStage = 'submission'; await click('不会，查看解析'); await until(() => button('重试原请求')?.disabled === false, 'REVEAL pending');
const revealBody = clone(writes('/submission').at(-1).body); assert.equal('translation' in revealBody, false);
const item2 = sessions.get(mainId).items[1]; await sentencesApi.selfReview(mainId, item2.itemId, { assessment: 'UNDERSTOOD', requestId: crypto.randomUUID() });
await go('/sentences/records', '.sentence-records'); await go(`/sentences/sessions/${mainId}`, '.sentence-study'); await until(() => button('重试原请求')?.disabled === false, 'old receipt pending on new current');
await click('重试原请求'); await readyPending(); assert.deepEqual(writes('/submission').at(-1).body, revealBody);
assert.equal(document.querySelector('[data-item-id]').dataset.itemId, String(sessions.get(mainId).items[2].itemId), 'old Feedback cannot restore an old item/phase');
input('#sentence-translation', '参考措辞并不决定自评'); await click('提交译文'); await readyReview(); await click('未理解');
await until(() => document.querySelector('.sentence-result-stats'), 'finished via Current=null');
assert.deepEqual([...document.querySelectorAll('.sentence-result-stats dd')].map(node => Number(node.textContent)), [3, 3, 2, 1, 3, 3]);
assert.match(document.querySelector('.sentence-assessment-counts').textContent, /意思基本一致 1.*部分理解 1.*未理解 1/);
assert.equal(document.body.textContent.includes('%'), false);
assert.deepEqual(await dailyApi.today(), originalDaily); assert.equal(localStorage.getItem('wordtrail.mock.sentence_reader'), originalPractice);
assert.equal(calls.some(call => /^(?:\/learning|\/dictation)/.test(call.url) && call.method !== 'get'), false, 'sentence writes never affect word/daily/dictation flows');
console.log('PASS catalog filters, explicit word IDs, favorites, ordered selection, immutable input, two independent request IDs, replay/refresh/relogin and authoritative Current transitions');

// Pending/unreviewed history is real, but is not silently classified as NOT_UNDERSTOOD.
await go(`/sentences/sessions/${favoriteSessionId}`, '.sentence-study'); await readyPending(); input('#sentence-translation', '还没自评的记录'); await click('提交译文'); await readyReview();
await go('/sentences/favorites', '.sentence-catalog'); await until(() => document.querySelector('.sentence-question-row'), 'favorite history'); await click('作答历史');
await until(() => document.querySelector('.sentence-history-row')?.textContent.includes('尚未自评'), 'null self-assessment history');
assert.equal(document.querySelector('.sentence-history-row .learning-badge').textContent, '尚未自评');
document.querySelector('[aria-label="关闭弹窗"]').click(); await until(() => !document.querySelector('[role=dialog]'), 'close history');
await go('/sentences/review', '.sentence-catalog'); await until(() => document.querySelectorAll('.sentence-question-row').length === 2, 'latest reviewed attempts only');
const archived = create('BANK', [13]); const archivedItem = archived.items[0];
const archivedAttempt = { ...clone(attempts.find(value => value.sentenceId === 1)), attemptId: 999, sessionId: archived.id, itemId: archivedItem.itemId, sentenceId: 13, englishText: 'Archived snapshot.', selfAssessment: 'NOT_UNDERSTOOD', difficulty: 1 };
archivedItem.attempt = archivedAttempt; archivedItem.status = 'DONE'; attempts.push(archivedAttempt); favoriteSet().add(13);
await click('刷新列表'); await until(() => document.querySelector('input[aria-label="选择句子 13"]'), 'inactive queue item retained');
assert.equal(document.querySelector('input[aria-label="选择句子 13"]').disabled, true);
await click('取消收藏'); await until(() => favoriteSet().has(13) === false, 'inactive favorite cancellation saved');
document.querySelector('input[aria-label="选择句子 1"]').click(); await click('练习所选 1 句'); await readyPending(); const retryId = Number(router.currentRoute.value.params.sessionId);
assert.deepEqual(creates().at(-1).body, { source: 'REVIEW', sentenceIds: [1] });
assert.equal((await sentencesApi.reviewQueue({ page: 1, size: 100 })).records.some(value => value.sentenceId === 1), true);
await click('不会，查看解析'); await readyReview(); assert.equal((await sentencesApi.reviewQueue({ page: 1, size: 100 })).records.some(value => value.sentenceId === 1), true, 'submission does not clear previous review state');
await click('意思基本一致'); await until(() => document.querySelector('.sentence-result-stats'), 'retraining result'); assert.notEqual(retryId, mainId);
assert.equal((await sentencesApi.reviewQueue({ page: 1, size: 100 })).records.some(value => value.sentenceId === 1), false);
assert.equal((await sentencesApi.result(mainId, { page: 1, size: 100 })).records.find(value => value.sentenceId === 1).selfAssessment, 'PARTIAL', 'new review never overwrites old session snapshot');
assert.equal(favoriteSet().has(3), true, 'understanding and favorites are independent');
console.log('PASS null assessments, snapshot/date history, inactive queue selection, inactive favorite cancellation and latest-reviewed-only consolidation');

// Known stale requests are rejected, then recovered via GET; never change the key and replay.
await go(`/sentences/sessions/${favoriteSessionId}`, '.sentence-study'); await readyReview(); conflict = 'SELF_REVIEW_NOT_ALLOWED';
const beforeConflictReview = writes('/self-review').length; await click('部分理解');
await until(() => document.querySelector('.live-notice')?.textContent.includes('状态已变化') && button('部分理解')?.disabled === false, 'review conflict refreshes Current');
assert.equal(writes('/self-review').length, beforeConflictReview + 1);
const fresh = create('BANK', [4]); await go(`/sentences/sessions/${fresh.id}`, '.sentence-study'); await readyPending();
conflict = 'STALE_SENTENCE_ITEM'; input('#sentence-translation', '过期页面输入'); await click('提交译文');
await until(() => document.querySelector('.live-notice')?.textContent.includes('状态已变化') && document.querySelector('#sentence-translation')?.disabled === false, 'stale submission refreshes Current');
assert.equal(document.querySelector('#sentence-translation').value, '');
conflict = 'REQUEST_ID_REUSED'; input('#sentence-translation', '保留原请求'); await click('提交译文');
await until(() => document.querySelector('.sentence-session-error')?.textContent.includes('勿换键重放'), 'key conflict blocks replay'); assert.equal(button('重试原请求'), undefined);
await go('/sentences/sessions/99999', '.sentence-study'); await until(() => document.querySelector('.sentence-session-error')?.textContent.includes('无权访问'), 'inaccessible session');
const openResultReads = calls.filter(call => call.url.endsWith('/result')).length;
await go(`/sentences/sessions/${favoriteSessionId}/result`, '.sentence-result'); await until(() => document.body.textContent.includes('本轮尚未完成'), 'unfinished result gate');
assert.equal(calls.filter(call => call.url.endsWith('/result')).length, openResultReads);
await go('/sentences', '.sentence-catalog'); await until(() => document.querySelector('input[aria-label="选择句子 1"]'), 'bank before atomic failure');
document.querySelector('input[aria-label="选择句子 1"]').click(); questions[0].active = false; const createdBeforeUnavailable = sessions.size;
await click('练习所选 1 句'); await until(() => document.querySelector('.sentence-launch-error')?.textContent.includes('整轮未创建'), 'atomic unavailable selection'); assert.equal(sessions.size, createdBeforeUnavailable);
bankEmpty = true; await click('刷新列表'); await until(() => document.querySelector('.state-panel')?.textContent.includes('题库暂无'), 'empty bank'); assert.equal(button('从题库开始').disabled, true);
bankEmpty = false; loseCreate = true; await click('刷新列表'); await until(() => button('从题库开始')?.disabled === false, 'bank restored');
const createBeforeLost = creates().length; await click('从题库开始'); await until(() => document.querySelector('.sentence-launch-error')?.textContent.includes('创建结果尚未确认'), 'unknown creation');
assert.equal(button('从题库开始').disabled, true); assert.equal(creates().length, createBeforeLost + 1);
await go('/sentences/records', '.sentence-records'); await until(() => document.querySelectorAll('.sentence-session-row').length >= 2, 'recover creation via list');
await click('已完成'); await until(() => document.querySelectorAll('.sentence-session-row a[href$="/result"]').length === 3, 'completed sessions separate');
assert.equal(creates().length, createBeforeLost + 1);
const refreshBefore = calls.filter(call => call.url === '/auth/refresh').length; unauthorizedReads = 2;
await Promise.all([sentencesApi.questions({ page: 1, size: 10 }), sentencesApi.favorites({ page: 1, size: 10 })]);
assert.equal(calls.filter(call => call.url === '/auth/refresh').length, refreshBefore + 1, 'reuse shared single-flight JWT refresh');
failRead = '/favorites'; await go('/sentences/favorites', '.sentence-catalog'); await until(() => document.querySelector('.state-panel')?.textContent.includes('读取暂时失败'), 'read failure');
await click('重新加载'); await until(() => document.querySelector('.sentence-question-row'), 'read retry');
assert.equal(calls.filter(call => call.url.startsWith(`${base}/`)).every(call => call.authenticated), true);
assert.equal(calls.some(call => /^\/dictation/.test(call.url)), false);
console.log('PASS stale/key/session conflicts, incomplete result gate, whole-create rejection, empty data, unknown creation list recovery, read retry and shared JWT refresh');
// Successful writes followed by failed reads must be recovered with GET, not submitted again.
const readFailureSession = create('BANK', [5]);
await go(`/sentences/sessions/${readFailureSession.id}`, '.sentence-study'); await readyPending();
input('#sentence-translation', '保存成功后读取失败的输入'); failRead = '/current'; const submissionsBeforeReadFailure = writes('/submission').length;
await click('提交译文'); await until(() => document.querySelector('.sentence-session-error')?.textContent.includes('操作已保存'), 'known submission save/read failure');
assert.equal(button('重试原请求'), undefined);
await click('重新同步题目'); await readyReview(); assert.equal(writes('/submission').length, submissionsBeforeReadFailure + 1);
failRead = '/current'; const reviewsBeforeReadFailure = writes('/self-review').length;
await click('意思基本一致'); await until(() => document.querySelector('.sentence-session-error')?.textContent.includes('操作已保存'), 'known self-review save/read failure');
await click('重新同步题目'); await until(() => document.querySelector('.sentence-result-stats'), 'GET-only completion recovery');
assert.equal(writes('/self-review').length, reviewsBeforeReadFailure + 1);
await go(`/sentences/sessions/${favoriteSessionId}`, '.sentence-study'); await readyReview();
await click('意思基本一致'); await until(() => document.querySelector('.sentence-result-stats'), 'understood favorite result');
assert.equal(favoriteSet().has(3), true, 'UNDERSTOOD never automatically cancels a favorite');
const paginationSession = create('BANK', questions.filter(question => question.active).map(question => question.sentenceId));
for (const item of paginationSession.items) {
  await sentencesApi.submit(paginationSession.id, item.itemId, { action: 'REVEAL', requestId: crypto.randomUUID() });
  await sentencesApi.selfReview(paginationSession.id, item.itemId, { assessment: 'PARTIAL', requestId: crypto.randomUUID() });
}
await go(`/sentences/sessions/${paginationSession.id}/result`, '.sentence-result');
await until(() => document.querySelectorAll('.sentence-result .sentence-history-row').length === 10, 'result first page');
assert.deepEqual([...document.querySelectorAll('.sentence-result-stats dd')].map(node => Number(node.textContent)), [11, 11, 0, 11, 11, 11]);
document.querySelector('.sentence-result > .pagination [aria-label="下一页"]').click();
await until(() => document.querySelectorAll('.sentence-result .sentence-history-row').length === 1, 'result second page');
assert.deepEqual(calls.filter(call => call.url === `${base}/sessions/${paginationSession.id}/result`).at(-1).params, { page: 2, size: 10 });
await go('/sentences/review', '.sentence-catalog'); await until(() => document.querySelectorAll('.sentence-question-row').length === 10, 'queue first page');
const firstQueueId = document.querySelector('.sentence-question-row input:not(:disabled)').getAttribute('aria-label');
document.querySelector('.sentence-question-row input:not(:disabled)').click();
document.querySelector('.sentence-catalog .pagination [aria-label="下一页"]').click();
await until(() => document.querySelectorAll('.sentence-question-row').length === 2, 'queue second page');
document.querySelector('.sentence-question-row input:not(:disabled)').click();
await until(() => button('练习所选 2 句')?.disabled === false, 'queue selection retained across pages');
assert.ok(firstQueueId);
assert.equal(calls.some(call => /(?:dictation|learning)/.test(call.url) && call.method !== 'get'), false);
console.log('PASS saved-write/failed-read GET-only recovery, complete result pagination, truthful totals and cross-page review queue selection');
app.unmount(); await window.happyDOM.close();
console.log('Sentence frontend checks passed. Real backend, real browser geometry and content review are not verified.');
