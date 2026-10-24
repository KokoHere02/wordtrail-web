// Actual Vue workspace with explicit server fixtures; local guided spelling has no write endpoint.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';
import { AxiosError } from 'axios';
const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent', 'KeyboardEvent']) Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window); globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', define: { 'import.meta.env.VITE_UI_PREVIEW': '"false"' }, logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-sentences-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/sentences-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { router, http, app } = await import('../.qa-sentences-dist/ui.js');
const document = window.document, calls = [];
const clone = value => JSON.parse(JSON.stringify(value));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, label) { const end = Date.now() + 8000; while (!test()) { if (Date.now() > end) throw new Error(`Timeout ${label}\n${document.body.textContent}`); await delay(10); } }
function input(selector, value, caret = value.length) { const node = document.querySelector(selector); assert.ok(node, selector); node.value = value; if (node.type !== 'number' && node.setSelectionRange) node.setSelectionRange(caret, caret); node.dispatchEvent(new window.Event('input', { bubbles: true })); }
function button(text) { return [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text && !node.closest('[aria-hidden="true"]')); }
async function click(text) { await until(() => button(text) && !button(text).disabled, text); button(text).click(); }
function enter(selector, options = {}) { document.querySelector(selector).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true, ...options })); }
async function tab(id) { document.querySelector(`#mode-tab-${id}`).click(); await until(() => document.querySelector(`#mode-tab-${id}`).getAttribute('aria-selected') === 'true', id); }
const fallback = http.defaults.adapter;
const ok = (config, data) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data: clone(data) } });
const groups = [{ partOfSpeech: 'adj.', meaning: '丰富的；充裕的' }];
let dailyAnswered = false, dictAnswered = false, issued = 0, sentenceStage = 0, planState = 'ready';
let dailyExtra = false;
let holdCreate = false, releaseCreate;
const daily = () => ({ batchId: 50, learningDate: '2026-10-24', dailyTarget: 2, taskType: 'DAILY', status: 'IN_PROGRESS', totalCount: dailyExtra ? 3 : 2, completedCount: dailyAnswered ? 1 : 0, skippedCount: 0, answerCount: dailyAnswered ? 1 : 0, unfamiliarCount: 0, newCount: 2, reviewCount: 0, nextItemId: dailyAnswered ? 52 : 51 });
const dailyItem = id => ({ itemId: id, wordId: id === 51 ? 1001 : 1002, word: id === 51 ? 'abundant' : 'quiet', phonetic: null, itemType: 'NEW', learningStatus: id === 51 && dailyAnswered ? 'DONE' : 'PENDING', result: id === 51 && dailyAnswered ? 1 : null, answerCount: id === 51 && dailyAnswered ? 1 : 0, nextAttemptNo: id === 51 && dailyAnswered ? null : 1, nextItemId: daily().nextItemId, correctableLogId: id === 51 && dailyAnswered ? 71 : null, reinforcementRemaining: null, attemptLimit: 6, completionReason: id === 51 && dailyAnswered ? 'RECALLED' : null });
const dict = () => ({ batchId: 91, bookId: null, taskType: 'PRACTICE', practiceMode: 'DICTATION', status: 'IN_PROGRESS', totalCount: 2, completedCount: 0, passedCount: 0, needsPracticeCount: 0, attemptCount: dictAnswered ? 1 : 0, nextItemId: 92, attemptLimit: 6, createdAt: '2026-10-24T12:00:00', completedAt: null });
const sentence = () => ({ sessionId: 650, selectionSource: 'BANK', status: 'IN_PROGRESS', totalCount: 2, submissionCount: sentenceStage > 0 ? 1 : 0, answerCount: sentenceStage > 0 ? 1 : 0, revealCount: 0, selfReviewCount: sentenceStage > 1 ? 1 : 0, completedCount: sentenceStage > 1 ? 1 : 0, understoodCount: 0, partialCount: sentenceStage > 1 ? 1 : 0, notUnderstoodCount: 0, nextItemId: sentenceStage > 1 ? 802 : 801, createdAt: '2026-10-24T12:00:00', completedAt: null });
const page = (records, params = { page: 1, size: 10 }) => ({ page: params.page, size: params.size, total: records.length, records });
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  calls.push({ url: config.url, method: config.method, body: clone(body ?? null) });
  if (config.url === '/learning/today') return ok(config, { learningDate: '2026-10-24', dailyTarget: 2, activeCount: 2, dueCount: 0, newCount: 2, unassignedCount: 0, canAddMore: false, task: daily() });
  if (config.url === '/learning-batches/50/daily') return ok(config, daily());
  if (/\/daily\/items\/\d+$/.test(config.url)) return ok(config, dailyItem(Number(config.url.split('/').at(-1))));
  if (config.url === '/learning-batches/50/daily/items/51/answer') { dailyAnswered = true; return ok(config, { logId: 71, itemId: 51, result: body.result, translation: '丰富的', translationGroups: groups, correction: false, answeredAt: '2026-10-24T12:00:00', progress: daily() }); }
  if (config.url === '/words/1001') return ok(config, { id: 1001, word: 'abundant', phonetic: null, translation: '丰富的', translationGroups: groups, personalBooks: [], plan: null });
  if (config.url === '/learning-plan/words' && planState === 'failed') { planState = 'ready'; throw new AxiosError('explicit temporary failure', 'ERR_NETWORK', config); }
  if (config.url === '/learning-plan/words' && planState === 'empty') return ok(config, page([], config.params));
  if (config.url === '/learning-plan/words') return ok(config, page([{ wordId: 1001, word: 'abundant', phonetic: null, translation: '丰富的', translationGroups: groups, planStatus: 'ACTIVE', firstLearnedAt: '2026-10-20T12:00:00', joinedAt: '2026-10-20T12:00:00', lastLearnedAt: null, lastResult: null, nextReviewAt: null, reviewLevel: 0 }], config.params));
  if (config.url === '/dictation/batches') { if (config.method === 'post' && holdCreate) return new Promise(resolve => { releaseCreate = () => resolve(ok(config, dict())); }); return ok(config, config.method === 'post' ? dict() : page([dict()], config.params)); }
  if (config.url === '/dictation/batches/91') return ok(config, dict());
  if (config.url === '/dictation/batches/91/next') { issued++; return ok(config, { itemId: 92, prompt: '丰富的', promptGroups: groups, presentationId: `presentation-${issued}`, nextAttemptNo: dictAnswered ? 2 : 1, correctStreak: 0, requiredCorrectStreak: 2, attemptLimit: 6 }); }
  if (config.url === '/dictation/batches/91/items/92/answer') { dictAnswered = true; return ok(config, { logId: 97, itemId: 92, action: body.action, submittedAnswer: body.input ?? null, expectedWord: 'abundant', verdict: 'CORRECT', attemptNo: body.attemptNo, correctStreak: 1, itemStatus: 'RELEARNING', completionReason: null, answeredAt: '2026-10-24T12:00:00', translation: '丰富的', translationGroups: groups, affectsSchedule: false, progress: dict() }); }
  if (config.url === '/sentence-translation/sessions') return ok(config, config.method === 'post' ? sentence() : page([sentence()], config.params));
  if (config.url === '/sentence-translation/sessions/650') return ok(config, sentence());
  if (config.url.endsWith('/sessions/650/current')) return ok(config, { itemId: sentenceStage > 1 ? 802 : 801, sentenceId: sentenceStage > 1 ? 2 : 1, status: sentenceStage === 1 ? 'AWAITING_REVIEW' : 'PENDING', englishText: sentenceStage > 1 ? 'I read every day.' : 'I missed the bus.', difficulty: 1, source: '原创样例', sourceReference: null, linkedWords: [], attemptId: sentenceStage === 1 ? 777 : null, action: sentenceStage === 1 ? 'ANSWER' : null, translation: sentenceStage === 1 ? '我错过了公交车。' : null, referenceTranslation: sentenceStage === 1 ? '我没赶上公交车。' : null, explanation: sentenceStage === 1 ? 'miss 表示没赶上。' : null, selfAssessment: null, submittedAt: null, personalNote: { content: '', errorTags: [], attemptId: null, version: 0, updatedAt: null } });
  if (config.url.endsWith('/submission')) { sentenceStage = 1; return ok(config, { sentenceId: 1, progress: sentence() }); }
  if (config.url.endsWith('/self-review')) { sentenceStage = 2; return ok(config, { sentenceId: 1, progress: sentence(), reviewSchedule: null }); }
  if (config.url.endsWith('/management/access')) return ok(config, { canManage: false });
  return fallback(config);
};
const writes = suffix => calls.filter(call => call.method !== 'get' && call.url.endsWith(suffix));
await until(() => document.querySelector('#username'), 'login'); input('#username', 'workspace_reader'); input('#password', 'example123'); await click('登录'); await until(() => document.querySelector('.daily-equation'), 'home');
await router.push('/learn'); await until(() => document.querySelector('.learning-word')?.textContent === 'abundant', 'recognition');
assert.deepEqual([...document.querySelectorAll('.main-nav > a')].map(node => node.getAttribute('aria-label')), ['今日', '学习', '内容库', '记录']);
const root = document.querySelector('.study-workspace');
document.querySelector('.learning-word').dispatchEvent(new window.KeyboardEvent('keydown', { key: '3', bubbles: true }));
await until(() => document.querySelector('.learning-word')?.textContent === 'quiet', 'recognition advances after server save');
assert.equal(writes('/answer').length, 1); assert.match(document.querySelector('.workspace-progress').textContent, /1 \/ 2/);
document.querySelector('#mode-tab-dictation').focus(); document.querySelector('#mode-tab-dictation').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
await until(() => document.querySelector('#mode-tab-spelling').getAttribute('aria-selected') === 'true', 'arrow switches tabs'); assert.equal(document.activeElement.id, 'mode-tab-spelling');
await until(() => button('开始跟练'), 'guided setup'); input('.guided-spelling input[type=number]', '0'); await click('开始跟练'); await until(() => document.querySelector('.guided-spelling > .inline-error'), 'count validation'); input('.guided-spelling input[type=number]', '10');
planState = 'failed'; await click('开始跟练'); await until(() => document.querySelector('.guided-spelling .state-panel[role=alert]'), 'guided read failure');
planState = 'empty'; await click('重新加载'); await until(() => document.querySelector('.guided-spelling .state-panel')?.textContent.includes('暂无可跟练'), 'empty guided plan'); assert.equal(document.querySelector('.guided-spelling').textContent.includes('本轮跟练完成'), false);
planState = 'ready'; await click('开始跟练'); await until(() => document.querySelector('#guided-spelling-input'), 'guided input');
assert.equal(document.querySelectorAll('.guided-spelling .letter-slot').length, 8); assert.equal(document.querySelectorAll('.guided-spelling input[type=text]').length, 1);
input('#guided-spelling-input', 'abun'); const guidedField = document.querySelector('#guided-spelling-input');
await tab('dictation'); await until(() => document.querySelector('.workspace-dictation-mode .workspace-start'), 'dictation setup');
await click('选择默写内容'); await until(() => document.querySelector('.dictation-plan-row'), 'dictation selection'); holdCreate = true; await click('从计划开始默写'); await until(() => releaseCreate, 'create in flight'); await tab('spelling'); releaseCreate(); await delay(40); assert.equal(document.querySelector('#mode-tab-spelling').getAttribute('aria-selected'), 'true', 'late create does not hijack the selected tab'); assert.equal(issued, 0, 'hidden creation does not POST next'); await tab('dictation'); await until(() => document.querySelector('#dictation-input')?.disabled === false, 'dictation question'); assert.equal(issued, 1);
input('#dictation-input', 'abun'); await tab('spelling'); assert.equal(document.querySelector('#guided-spelling-input'), guidedField); assert.equal(guidedField.value, 'abun'); assert.equal(root, document.querySelector('.study-workspace'));
input('#guided-spelling-input', 'abu'); await until(() => document.querySelector('.guided-spelling .letter-slot.is-caret') === document.querySelectorAll('.guided-spelling .letter-slot')[3], 'caret follows native deletion');
guidedField.dispatchEvent(new window.Event('compositionstart', { bubbles: true })); input('#guided-spelling-input', 'abundant'); enter('#guided-spelling-input'); assert.ok(document.querySelector('.guided-original'), 'composition Enter does not submit'); guidedField.dispatchEvent(new window.Event('compositionend', { bubbles: true })); enter('#guided-spelling-input'); await until(() => !document.querySelector('.guided-original'), 'copy hides original'); assert.equal(document.querySelector('#guided-spelling-input').value, '');
input('#guided-spelling-input', 'wrong'); enter('#guided-spelling-input'); await until(() => document.querySelector('.guided-spelling .inline-error'), 'local mismatch'); input('#guided-spelling-input', 'abundant'); enter('#guided-spelling-input'); await until(() => document.querySelector('.guided-spelling .workspace-answer-actions')?.textContent.includes('已完成本词'), 'local recall');
await tab('dictation'); assert.equal(document.querySelector('#dictation-input').value, 'abun'); assert.equal(issued, 1, 'tab return does not POST next');
const dailyWrites = writes('/daily/items/51/answer').length;
document.querySelector('#dictation-input').dispatchEvent(new window.KeyboardEvent('keydown', { key: '3', bubbles: true })); assert.equal(writes('/daily/items/51/answer').length, dailyWrites, 'hidden recognition ignores shortcuts');
input('#dictation-input', 'abundant'); enter('#dictation-input'); await until(() => document.querySelector('.dictation-feedback'), 'server dictation result'); assert.equal(writes('/items/92/answer').length, 1); assert.equal(writes('/items/92/answer')[0].body.presentationId, 'presentation-1');
await tab('sentences'); await until(() => document.querySelector('a[href="/sentences/sessions/650"]'), 'sentence resume'); document.querySelector('a[href="/sentences/sessions/650"]').click(); await until(() => document.querySelector('#sentence-translation')?.disabled === false, 'sentence pending');
input('#sentence-translation', '我错过了公交车。'); const sentenceField = document.querySelector('#sentence-translation'); await tab('recognition'); assert.equal(document.querySelector('.learning-word').textContent, 'quiet'); await tab('sentences'); assert.equal(sentenceField, document.querySelector('#sentence-translation')); assert.equal(sentenceField.value, '我错过了公交车。');
assert.equal(document.querySelector('.sentence-reference'), null); enter('#sentence-translation', { ctrlKey: true, isComposing: true }); assert.equal(writes('/submission').length, 0); enter('#sentence-translation', { ctrlKey: true }); await until(() => document.querySelector('.sentence-reference'), 'reference in place'); assert.equal(writes('/submission').length, 1);
await click('部分理解'); await until(() => document.querySelector('.sentence-study-card')?.dataset.itemId === '802', 'self review advances'); assert.equal(document.querySelector('#sentence-translation').value, ''); assert.equal(document.querySelector('.sentence-reference'), null);
input('#sentence-translation', '下一题的未提交译文'); await router.push('/books'); await until(() => document.querySelector('.library-page'), 'content library'); await router.push('/learn'); await until(() => document.querySelector('.study-workspace'), 'workspace restored'); assert.equal(document.querySelector('#sentence-translation').value, '下一题的未提交译文'); assert.equal(issued, 1);
await tab('dictation'); assert.ok(document.querySelector('.dictation-feedback')); await click('隐藏答案，下一题'); await until(() => document.querySelector('#dictation-input')?.disabled === false, 'explicit next'); assert.equal(issued, 2); assert.equal(document.querySelector('.dictation-feedback'), null);
assert.equal(calls.some(call => /spelling|guided/.test(call.url)), false, 'guided mode does not invent an endpoint');
await router.push('/learn/50'); await until(() => document.querySelector('.workspace-progress').textContent.includes('1 / 2'), 'explicit daily task');
await router.push('/today'); await until(() => document.querySelector('.daily-equation'), 'leave cached daily task'); dailyExtra = true;
const answersBeforeContinue = writes('/daily/items/51/answer').length;
await router.push('/learn/50'); await until(() => document.querySelector('.workspace-progress').textContent.includes('1 / 3'), 'same batch continuation refreshes the cached task'); assert.equal(writes('/daily/items/51/answer').length, answersBeforeContinue);
console.log('PASS four-tab state/DOM identity retention, authoritative recognition auto-next, native single-input slots/paste/deletion/caret and two-stage guided recall');
console.log('PASS inactive shortcut isolation, no next POST on tab return, server dictation receipt, hidden sentence answers, IME-safe Ctrl+Enter, self-review and content navigation recovery');
app.unmount(); await window.happyDOM.close();
console.log('Workspace Vue fixture checks passed; physical browser layout is separate.');
