import { createDictationExamFixture } from './helpers/dictation-exam-fixture.mjs';
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
const { router, http, api, dailyApi, dictationApi, DictationStats, app } = await import('../.qa-dictation-dist/ui.js');
const document = window.document, fixture = createDictationExamFixture(), fallback = http.defaults.adapter;
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  const result = await fixture.handle(config.url, config.method, body, config.params);
  if (!result) return fallback(config);
  if (config.url.startsWith('/dictation/')) assert.ok(config.headers.get('Authorization')?.startsWith('Bearer '));
  if (result.networkError) throw new AxiosError('lost response', 'ECONNABORTED', config);
  const response = { config, status: result.status, headers: {}, data: { code: result.error?.code || 'OK', message: result.error?.message || 'fixture', data: result.data ?? null } };
  if (result.error) throw new AxiosError(response.data.message, 'ERR_BAD_RESPONSE', config, undefined, response);
  return response;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, label) { const end = Date.now() + 8000; while (!test()) { if (Date.now() > end) throw new Error(`${label}: ${document.body.textContent}`); await sleep(10); } }
function input(selector, value) { const node = document.querySelector(selector); assert.ok(node, selector); node.value = value; node.dispatchEvent(new window.Event('input', { bubbles: true })); }
function button(text) { return [...document.querySelectorAll('button')].find(node => { const label = node.cloneNode(true); label.querySelectorAll('kbd[aria-hidden=true]').forEach(k => k.remove()); return label.textContent.trim() === text && !node.closest('[style*="display: none"]'); }); }
async function click(text) { await until(() => button(text)?.disabled === false, text); button(text).click(); }
async function visit(path, ready) { if (router.currentRoute.value.path === path) await router.push('/records/dictation'); await router.push(path); await until(ready, path); }
const ready = () => document.querySelector('#dictation-input')?.disabled === false;
const writes = () => fixture.calls.filter(call => call.method === 'put' && call.url.startsWith('/dictation/'));
const creates = () => fixture.calls.filter(call => call.method === 'post' && call.url === '/dictation/batches');
const nexts = () => fixture.calls.filter(call => call.url.endsWith('/next'));
const scores = () => [...document.querySelectorAll('.dictation-stats dd')].map(node => node.textContent);
async function login() { await until(() => document.querySelector('#username'), 'login'); input('#username', 'dictation_reader'); input('#password', 'example123'); await click('登录'); await until(() => document.querySelector('.daily-equation'), 'authenticated'); }
async function fresh(ids = [1001, 1011], changes = {}) { const state = fixture.addTask(ids, changes); await visit(`/dictation/${state.task.batchId}`, ready); return state; }
await login(); const dailyBefore = await dailyApi.today();
await visit('/dictation', () => document.querySelectorAll('.dictation-plan-row').length === 10);
assert.equal(creates().length, 0); input('#dictation-count', '0'); await click('从计划开始测验'); await until(() => document.querySelector('.inline-error')?.textContent.includes('1～100'), 'count validation'); assert.equal(creates().length, 0);
document.querySelector('input[aria-label="默写选词 apple"]').click();
document.querySelector('.dictation-home .wordlist-sheet [aria-label="下一页"]').click();
await until(() => document.querySelector('input[aria-label="默写选词 abandon"]'), 'cross-page selection');
for (const word of ['abandon', 'adapt', 'adjust']) document.querySelector(`input[aria-label="默写选词 ${word}"]`).click();
await until(() => button('测验所选 4 词')?.disabled === false, 'four selected'); button('测验所选 4 词').click(); button('测验所选 4 词').click(); await until(ready, 'created');
const mainId = Number(router.currentRoute.value.params.batchId), main = fixture.tasks.get(mainId);
assert.equal(creates().length, 1); assert.deepEqual(creates()[0].body, { source: 'PLAN', wordIds: [1001, 1011, 1012, 1013] });
assert.match(document.querySelector('.dictation-prompt').textContent, /目标词/); assert.equal(document.querySelector('.dictation-card').textContent.includes('apple'), false);
assert.equal(document.querySelector('.dictation-card').textContent.includes('连续命中'), false);
const beforeBlank = writes().length; await click('提交答案'); await until(() => document.querySelector('#dictation-validation'), 'blank validation'); assert.equal(writes().length, beforeBlank);
fixture.loseAction = 'ANSWER'; input('#dictation-input', '  aple  '); button('提交答案').click(); button('不会／看答案').click();
await until(() => button('重试原请求'), 'unknown answer'); const originalBody = structuredClone(writes().at(-1).body);
assert.equal(originalBody.input, '  aple  '); assert.equal(originalBody.attemptNo, 1); assert.equal(fixture.events.length, 1);
const beforePendingNext = nexts().length;
document.querySelector('[aria-label="打开账户菜单"]').click(); await click('退出登录'); await login();
fixture.day = '2026-10-29';
await visit(`/dictation/${mainId}`, () => button('重试原请求'));
assert.equal(nexts().length, beforePendingNext); await click('重试原请求'); await until(ready, 'exact retry advances');
assert.deepEqual(writes().at(-1).body, originalBody); assert.equal(fixture.events.length, 1);
assert.equal(document.querySelector('.dictation-submit-notice').textContent, '已提交'); assert.equal(document.querySelector('.dictation-feedback'), null); assert.equal(document.querySelector('.dictation-expected'), null);
assert.equal(document.querySelector('#dictation-input').value, ''); assert.equal(main.task.passedCount, null); assert.equal(main.task.needsPracticeCount, null); assert.equal(main.task.accuracy, null);
assert.equal((await dictationApi.mistakes({ page: 1, size: 10 })).total, 0); assert.equal((await dictationApi.history(1001, { page: 1, size: 10 })).total, 0);
// Null grades render as unpublished, including an actual 0% result only when published.
const { createApp, h } = await import('vue'); const mount = document.createElement('div'); document.body.append(mount);
const stats = createApp({ render: () => h(DictationStats, { task: main.task }) }); stats.mount(mount);
assert.deepEqual([...mount.querySelectorAll('dd')].map(node => node.textContent), ['4', '1', '未公布', '未公布', '1', '未公布']); stats.unmount(); mount.remove();
fixture.loseAction = 'REVEAL'; await click('不会／看答案'); await until(() => button('重试原请求'), 'unknown reveal'); const revealBody = structuredClone(writes().at(-1).body); assert.equal('input' in revealBody, false);
await click('重试原请求'); await until(() => document.querySelector('.dictation-expected')?.textContent === 'abandon', 'reveal retry');
assert.deepEqual(writes().at(-1).body, revealBody); assert.equal(fixture.events.length, 2); assert.equal(document.querySelector('#dictation-input'), null); assert.match(document.querySelector('.dictation-verdict').textContent, /未答/); assert.equal(main.task.passedCount, null);
await click('下一题'); await until(ready, 'reveal consumes its question');
fixture.failNextAfterAnswer = true; input('#dictation-input', 'server-accepted-spelling'); await click('提交答案');
await until(() => button('重新获取题目'), 'confirmed answer then failed next'); assert.equal(button('重试原请求'), undefined); const afterSaveWrites = writes().length;
await click('重新获取题目'); await until(ready, 'read-only next recovery'); assert.equal(writes().length, afterSaveWrites); assert.equal(fixture.events.length, 3); assert.equal(document.querySelector('.dictation-expected'), null);
input('#dictation-input', ' Adjust '); await click('提交答案'); await until(() => document.querySelector('.dictation-result .dictation-stats'), 'published result');
assert.deepEqual(scores(), ['4', '4', '2', '2', '4', '50%']); assert.equal(document.querySelectorAll('.dictation-result .dictation-word-row').length, 4);
for (const label of ['正确', '错误', '未答']) assert.ok(document.querySelector('.dictation-result').textContent.includes(label));
assert.equal(document.body.textContent.includes('连续命中'), false); assert.equal(document.body.textContent.includes('已掌握'), false);
const mainSnapshot = structuredClone({ task: main.task, words: main.words });
const beforeCompletedNext = nexts().length; await visit(`/dictation/${mainId}`, () => document.querySelector('.dictation-result')); assert.equal(nexts().length, beforeCompletedNext, 'completed refresh never reopens a question');
console.log('PASS single submission locks, raw/exact retries across relogin/day, hidden ordinary feedback/null scores, REVEAL consumes one chance, read-only next recovery and final 50% publication');

await visit('/dictation/mistakes', () => document.querySelectorAll('.dictation-word-row').length === 2);
await click('默写历史'); await until(() => document.querySelector('.dictation-history-event'), 'published history'); assert.equal(document.querySelector('.dictation-history-event').textContent.includes('连续命中'), false);
document.querySelector('[aria-label="关闭弹窗"]').click(); await until(() => !document.querySelector('[role=dialog]'), 'history close');
for (const node of document.querySelectorAll('.dictation-word-row input')) node.click(); await click('重测所选 2 词'); await until(ready, 'new mistake test');
const repeatId = Number(router.currentRoute.value.params.batchId); assert.notEqual(repeatId, mainId); assert.deepEqual(creates().at(-1).body, { source: 'MISTAKES', wordIds: [1001, 1011] });
assert.equal((await dictationApi.mistakes({ page: 1, size: 10 })).total, 2);
input('#dictation-input', 'apple'); await click('提交答案'); await until(ready, 'first retest answer advances'); assert.equal((await dictationApi.mistakes({ page: 1, size: 10 })).total, 2, 'unfinished retest cannot clear old published mistakes');
input('#dictation-input', 'abandon'); await click('提交答案'); await until(() => document.querySelector('.dictation-stats'), 'new score'); assert.deepEqual(scores(), ['2', '2', '2', '0', '2', '100%']);
assert.deepEqual({ task: main.task, words: main.words }, mainSnapshot); assert.equal((await dictationApi.mistakes({ page: 1, size: 10 })).total, 0);
console.log('PASS published history and fresh MISTAKES retest, no early mistake clearing, one correct input per word, immutable original score/answers');

const finalLost = await fresh([1001]); finalLost.decisions = ['CORRECT']; fixture.loseAction = 'ANSWER';
input('#dictation-input', 'Apple'); await click('提交答案'); await until(() => button('重试原请求'), 'unknown final answer');
const finalBody = structuredClone(writes().at(-1).body), finalEvents = fixture.events.length, finalNexts = nexts().length;
assert.equal(finalLost.task.canContinue, false); assert.equal(finalLost.task.status, 'COMPLETED');
await visit(`/dictation/${finalLost.task.batchId}`, () => button('重试原请求')); assert.equal(nexts().length, finalNexts);
await click('重试原请求'); await until(() => document.querySelector('.dictation-result .dictation-stats'), 'completed receipt recovery');
assert.deepEqual(writes().at(-1).body, finalBody); assert.equal(fixture.events.length, finalEvents); assert.equal(scores().at(-1), '100%');
console.log('PASS final-answer timeout retains exact retry even when canContinue=false; published replay opens results without reopening or recounting');

const legacy = fixture.addTask([1001], { singleAttempt: false, canContinue: false, status: 'IN_PROGRESS', completedCount: 0, passedCount: 0, needsPracticeCount: 1, attemptCount: 6, accuracy: null });
legacy.words.push({ itemId: legacy.entries[0].itemId, wordId: 1001, word: 'apple', translation: '苹果', translationGroups: [], lastVerdict: 'INCORRECT', lastInput: 'old', attemptCount: 6, correctStreak: 0, learningStatus: 'RELEARNING', completionReason: null, learningDate: '2026-10-24', answeredAt: '2026-10-24T10:00:00' });
const legacyBefore = JSON.stringify(legacy.task), beforeLegacy = nexts().length;
await visit(`/dictation/${legacy.task.batchId}`, () => document.querySelector('.dictation-readonly')); assert.equal(nexts().length, beforeLegacy); assert.equal(document.querySelector('#dictation-input'), null);
await visit(`/dictation/${legacy.task.batchId}/result`, () => document.querySelector('.dictation-result .dictation-word-row')); assert.equal(scores().at(-1), '—'); assert.equal(JSON.stringify(legacy.task), legacyBefore);
assert.equal(document.querySelector('.dictation-result a[href="/dictation/' + legacy.task.batchId + '"]'), null);
await visit('/records/dictation', () => document.querySelector('.dictation-task-list'));
const oldRow = [...document.querySelectorAll('.dictation-task-row')].find(row => row.textContent.includes(`#${legacy.task.batchId}`)); assert.ok(oldRow.querySelector('a[href$="/result"]')); assert.equal(oldRow.textContent.includes('继续测验'), false);
const blocked = fixture.addTask([1001], { canContinue: false }); await visit(`/dictation/${blocked.task.batchId}`, () => document.querySelector('.dictation-submit-notice')); assert.equal(document.querySelector('#dictation-input'), null);
const legacyError = fixture.addTask([1001]); fixture.legacyOnce = true; await visit(`/dictation/${legacyError.task.batchId}`, () => document.querySelector('.dictation-readonly')); assert.equal(button('重试原请求'), undefined);
console.log('PASS singleAttempt/canContinue control all continuation, legacy IN_PROGRESS results remain readable with null accuracy, legacy error guides a fresh test without resetting records');

const concurrent = await fresh(); const oldItem = concurrent.task.nextItemId; fixture.alreadyOnce = true; input('#dictation-input', 'racing'); await click('提交答案');
await until(ready, 'already answered restores next'); assert.notEqual(concurrent.task.nextItemId, oldItem); assert.equal(fixture.calls.filter(call => call.method === 'put' && call.url.endsWith(`/${oldItem}/answer`)).length, 1); assert.match(document.querySelector('.dictation-submit-notice').textContent, /已提交/);
const stale = await fresh(); fixture.staleOnce = true; input('#dictation-input', 'old presentation'); await click('提交答案'); await until(() => button('重新获取题目'), 'stale answer'); assert.equal(document.querySelector('#dictation-input'), null); const staleBody = writes().at(-1).body; await click('重新获取题目'); await until(ready, 'renewed issuance'); assert.equal(document.querySelector('#dictation-input').value, ''); input('#dictation-input', 'fresh'); await click('提交答案'); await until(ready, 'new action after rejected stale'); assert.notEqual(writes().at(-1).body.presentationId, staleBody.presentationId); assert.equal(writes().at(-1).body.attemptNo, 1);
await fresh(); fixture.reuseOnce = true; input('#dictation-input', 'request conflict'); await click('提交答案'); await until(() => document.querySelector('.dictation-error')?.textContent.includes('原请求已保留'), 'key conflict'); assert.equal(button('重试原请求'), undefined); assert.equal(document.querySelector('#dictation-input'), null);
console.log('PASS already-answered locks old item and re-GETs progress without reanswering; stale/key conflicts never change a retry body/key');

// Existing create, pagination and terminal gates still use server decisions.
fixture.createMode = 'lost'; await visit('/dictation', () => document.querySelector('.dictation-plan-row')); const beforeLost = creates().length; await click('从计划开始测验'); await until(() => document.querySelector('.dictation-launch-error')?.textContent.includes('创建结果尚未确认'), 'lost creation'); assert.equal(button('从计划开始测验').disabled, true); await click('刷新默写记录'); await until(() => document.querySelector('.dictation-task-row'), 'GET list recovery'); assert.equal(creates().length, beforeLost + 1); fixture.createMode = 'normal';
const paged = fixture.addTask(Array.from({ length: 12 }, (_, i) => 1001 + i), { status: 'COMPLETED', canContinue: false, completedCount: 12, passedCount: 0, needsPracticeCount: 12, attemptCount: 12, accuracy: 0 });
paged.words = paged.entries.map(word => ({ itemId: word.itemId, wordId: word.wordId, word: word.word, translation: word.translation, translationGroups: [], lastVerdict: 'INCORRECT', lastInput: 'wrong', attemptCount: 1, correctStreak: 0, learningStatus: 'DONE', completionReason: 'LIMIT_REACHED', learningDate: fixture.day, answeredAt: `${fixture.day}T10:00:00` }));
await visit(`/dictation/${paged.task.batchId}/result`, () => document.querySelectorAll('.dictation-result .dictation-word-row').length === 10); assert.equal(scores().at(-1), '0%'); document.querySelector('.dictation-result [aria-label="下一页"]').click(); await until(() => document.querySelectorAll('.dictation-result .dictation-word-row').length === 2, 'result pagination');
const unfinished = fixture.addTask([1001]); const beforeWords = fixture.calls.filter(call => call.url.endsWith('/result/words')).length; await visit(`/dictation/${unfinished.task.batchId}/result`, () => document.querySelector('.dictation-result .library-empty')); assert.equal(fixture.calls.filter(call => call.url.endsWith('/result/words')).length, beforeWords); assert.ok(document.querySelector('.dictation-result a[href="/dictation/' + unfinished.task.batchId + '"]'));
for (const call of writes()) { assert.equal(call.body.attemptNo, 1); assert.deepEqual(Object.keys(call.body).sort(), (call.body.action === 'REVEAL' ? ['action', 'attemptNo', 'presentationId', 'requestId'] : ['action', 'input', 'attemptNo', 'presentationId', 'requestId']).sort()); }
assert.deepEqual(await dailyApi.today(), dailyBefore); assert.equal(fixture.calls.some(call => call.method !== 'get' && /^\/learning/.test(call.url)), false, 'independent test never writes DAILY, listening or consolidation APIs');
console.log('PASS non-idempotent creation recovery, published 0% versus unpublished null, result pagination, unfinished result gate and DAILY isolation');
app.unmount(); await window.happyDOM.close();
