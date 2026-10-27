// Explicit API fixtures and actual Vue components; no claim of real browser geometry or backend validation.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';
import { AxiosError } from 'axios';
const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
}
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', define: { 'import.meta.env.VITE_UI_PREVIEW': '"false"' }, logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-words-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/app-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { router, http, api, dailyApi, wordsApi, app } = await import('../.qa-words-dist/ui.js');
const document = window.document;
const fixture = http.defaults.adapter;
const calls = [];
let override;
http.defaults.adapter = async config => {
  calls.push({ method: config.method, url: config.url, params: config.params, body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data });
  if (config.url === '/sentence-translation/word-links/summary') return { config, status: 200, headers: {}, data: { code: 'OK', message: 'fixture', data: JSON.parse(config.data).wordIds.map(wordId => ({ wordId, sentenceCount: 0 })) } };
  if (/^\/words\/\d+\/sentences$/.test(config.url)) return { config, status: 200, headers: {}, data: { code: 'OK', message: 'fixture', data: { ...config.params, total: 0, records: [] } } };
  return override ? override(config) : fixture(config);
};
async function until(predicate, label) {
  const deadline = Date.now() + 9000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}\n${document.body.textContent}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
function input(selector, value) {
  const element = document.querySelector(selector); assert.ok(element, selector);
  element.value = value; element.dispatchEvent(new window.Event('input', { bubbles: true }));
}
function button(text, root = document) { return [...root.querySelectorAll('button')].find(element => element.textContent.trim() === text); }
function click(text, root = document) { const element = button(text, root); assert.ok(element, text); assert.equal(element.disabled, false, text); element.click(); }
async function readyClick(text, selector) { await until(() => button(text, selector ? document.querySelector(selector) : document)?.disabled === false, `ready ${text}`); click(text, selector ? document.querySelector(selector) : document); }
function check(element, checked = true) { assert.ok(element); assert.equal(element.disabled, false); element.checked = checked; element.dispatchEvent(new window.Event('change', { bubbles: true })); }
function error(config, code, message, status = 409) { return new AxiosError(message, 'ERR_BAD_RESPONSE', config, undefined, { config, status, headers: {}, data: { code, message, data: null } }); }
const dialog = () => document.querySelector('[role="dialog"]');
const weakPage = () => wordsApi.weak({ source: 'DAILY', page: 1, size: 100 });
const weakWrites = () => calls.filter(call => call.url === '/learning/weak-words/practice' && call.method === 'post');
const resultStats = () => [...document.querySelectorAll('.result-stat strong')].map(element => element.textContent);
async function dailyAnswer(taskId, result) { const progress = await dailyApi.task(taskId); const item = await dailyApi.item(taskId, progress.nextItemId); const saved = await dailyApi.answer(taskId, item.itemId, { result, attemptNo: item.nextAttemptNo, requestId: crypto.randomUUID() }); return { item, saved }; }
async function weakSource(label) { await readyClick(label, '.weak-words-page'); await until(() => !document.querySelector('.weak-words-sheet .state-panel')?.textContent.includes('正在整理'), `source ${label} loaded`); }

await until(() => document.querySelector('#username'), 'login');
input('#username', 'words_reader'); input('#password', 'example123'); click('登录');
await until(() => document.querySelector('.daily-equation'), 'authenticated');
await router.push('/words/1001');
await until(() => document.querySelector('.word-detail-heading h1')?.textContent === 'abandon', 'word detail');
assert.match(document.querySelector('.word-plan-panel').textContent, /尚未加入/);
assert.match(document.querySelector('.word-detail-page').textContent, /尚未收录/);
assert.ok(calls.some(call => call.url === '/words/1001' && call.method === 'get'));
click('学习历史'); await until(() => dialog()?.textContent.includes('不能解释为从未学习'), 'empty history caution');
assert.ok(calls.some(call => call.url === '/learning-plan/words/1001/history' && call.params.page === 1));
document.querySelector('button[aria-label="关闭弹窗"]').click(); await until(() => !dialog(), 'history close');
const personal = await api.createBook({ name: '阅读生词', description: null });
await api.collectWords(personal.id, [1001]);
await dailyApi.join(personal.id, [1001]);
await router.push('/books'); await until(() => document.querySelector('.library-grid'), 'away from detail');
await router.push('/words/1001');
await until(() => document.querySelector('.personal-book-links a')?.textContent === '阅读生词', 'own personal book links');
assert.match(document.querySelector('.word-plan-panel').textContent, /未学/);
assert.equal((await wordsApi.detail(1001)).plan.started, false);
assert.equal((await wordsApi.detail(1001)).plan.due, false);
await router.push('/words/999999');
await until(() => document.querySelector('.word-detail-page .state-panel')?.textContent.includes('单词不存在'), 'missing word detail');
console.log('PASS word detail, private books, plan-null/unstarted states, history reuse and inaccessible word');

await dailyApi.join(1, [1002, 1003]); await dailyApi.join(2, [2001]);
const daily = await dailyApi.start();
await dailyAnswer(daily.batchId, 2); await dailyAnswer(daily.batchId, 3); await dailyAnswer(daily.batchId, 1);
const last = await dailyAnswer(daily.batchId, 3);
const originalDetail = await dailyApi.item(daily.batchId, last.item.itemId);
const beforeCorrection = await weakPage();
await dailyApi.correct(daily.batchId, last.item.itemId, { result: 2, logId: originalDetail.correctableLogId, requestId: crypto.randomUUID() });
const afterCorrection = await weakPage();
const oldWord = beforeCorrection.records.find(word => word.wordId === 2001), newWord = afterCorrection.records.find(word => word.wordId === 2001);
assert.equal(newWord.lastResult, 2); assert.equal(newWord.answerCount, 1);
assert.equal(newWord.lastAnswerLogId, oldWord.lastAnswerLogId); assert.equal(newWord.lastAnsweredAt, oldWord.lastAnsweredAt);
await dailyApi.updatePlan(1002, 'PAUSED'); await dailyApi.updatePlan(2001, 'REMOVED');
assert.equal((await weakPage()).total, 3, 'plan status never filters event weak words');
assert.equal((await wordsApi.detail(2001)).plan.due, false);
assert.equal((await wordsApi.detail(2001)).plan.planStatus, 'REMOVED');
const dailySnapshot = await dailyApi.task(daily.batchId);
const weakSnapshot = await weakPage();
const planSnapshot = await wordsApi.detail(1001);
await router.push('/weak-words');
await until(() => document.querySelectorAll('.weak-word-row').length === 3, 'daily weak view');
assert.match(document.querySelector('.weak-data-scope').textContent, /记录范围/);
assert.match(document.querySelector('.weak-word-row').textContent, /本来源累计作答 1 次/);
assert.equal(document.body.textContent.includes('已掌握'), false);
check(document.querySelector('input[aria-label="选择薄弱词 abandon"]'));
await weakSource('认识专项');
await until(() => document.querySelector('.weak-words-sheet .state-panel')?.textContent.includes('暂无已记录的薄弱词'), 'empty practice source');
assert.match(document.querySelector('.weak-selected-count').textContent, /0/);
await weakSource('每日学习');
await until(() => document.querySelectorAll('.weak-word-row').length === 3, 'daily source restored');
let rejectGet = true;
override = async config => { if (rejectGet && config.url === '/learning/weak-words') { rejectGet = false; throw new AxiosError('network', 'ERR_NETWORK', config); } return fixture(config); };
click('刷新'); await until(() => document.querySelector('.weak-words-sheet .state-panel')?.textContent.includes('暂时无法连接'), 'weak GET failure');
await readyClick('重新加载', '.weak-words-sheet');
await until(() => document.querySelectorAll('.weak-word-row').length === 3, 'read-only retry'); override = undefined;
console.log('PASS source isolation, corrected effective result and original answer time, paused/removed weak words, loading/empty/error retry');

const practiceSeed = await api.create({ bookId: 1, selectionType: 'MANUAL', wordIds: Array.from({ length: 12 }, (_, index) => 1001 + index) });
let seedProgress = await api.progress(practiceSeed.batchId);
for (let index = 0; index < 12; index++) seedProgress = await api.answer(practiceSeed.batchId, seedProgress.nextItemId, index === 11 ? 1 : 2, crypto.randomUUID());
assert.deepEqual(await weakPage(), weakSnapshot);
assert.deepEqual(await dailyApi.task(daily.batchId), dailySnapshot);
assert.deepEqual(await wordsApi.detail(1001), planSnapshot);
await router.push(`/learning/${practiceSeed.batchId}/result`);
await until(() => document.querySelector('.result-stats'), 'source practice result');
assert.deepEqual(resultStats(), ['12', '12', '12', '11']);
await until(() => document.querySelectorAll('.result-row').length === 10, 'result word first page');
document.querySelector('.practice-result-page button[aria-label="下一页"]').click();
await until(() => document.querySelectorAll('.result-row').length === 2, 'result words paginate');
click('认识'); await until(() => document.querySelectorAll('.result-row').length === 1, 'result filter resets pagination');
await router.push('/weak-words'); await until(() => document.querySelectorAll('.weak-word-row').length === 3, 'weak return');
await weakSource('认识专项'); await until(() => document.querySelectorAll('.weak-word-row').length === 10, 'practice first page');
check(document.querySelector('.weak-word-row input'));
document.querySelector('.weak-words-page button[aria-label="下一页"]').click();
await until(() => document.querySelectorAll('.weak-word-row').length === 1, 'practice second page');
check(document.querySelector('.weak-word-row input'));
await until(() => document.querySelector('.weak-selected-count')?.textContent.includes('2'), 'weak selection crosses pages');
let changed = true;
override = async config => { if (changed && config.url === '/learning/weak-words/practice') { changed = false; throw error(config, 'WEAK_WORD_SELECTION_CHANGED', '所选词已变化，整批未创建'); } return fixture(config); };
const beforeChanged = weakWrites().length;
await readyClick('专项巩固 2 词');
await until(() => document.querySelector('.live-notice')?.textContent.includes('选择已失效'), 'selection conflict refreshes list');
assert.match(document.querySelector('.weak-selected-count').textContent, /0/);
assert.equal(weakWrites().length, beforeChanged + 1);
override = undefined;
await weakSource('每日学习'); await until(() => document.querySelectorAll('.weak-word-row').length === 3, 'daily after changed selection');
// Select by row ID rather than spelling: different IDs may have the same English word.
const checkById = id => check([...document.querySelectorAll('.weak-word-row')].find(row => row.querySelector(`a[href="/words/${id}"]`))?.querySelector('input'));
checkById(1001); checkById(2001);
await until(() => button('专项巩固 2 词')?.disabled === false, 'cross-book create ready');
const detailsBeforeStudy = calls.filter(call => /^\/words\/\d+$/.test(call.url)).length;
const beforeCreate = weakWrites().length;
button('专项巩固 2 词').click(); button('专项巩固 2 词').click();
await until(() => document.querySelector('.study-word')?.textContent === 'abandon', 'cross-book study');
const crossBatchId = Number(router.currentRoute.value.params.batchId);
assert.equal((await api.progress(crossBatchId)).bookId, null);
assert.equal(weakWrites().length, beforeCreate + 1);
assert.deepEqual(weakWrites().at(-1).body, { source: 'DAILY', wordIds: [1001, 2001] });
assert.equal(calls.some(call => /word-books\/(null|0)(?:\/|$)/.test(call.url)), false);
assert.equal(calls.filter(call => /^\/words\/\d+$/.test(call.url)).length, detailsBeforeStudy, 'study does not query revealed dictionary details');
assert.equal(document.querySelector('.study-meaning'), null);
console.log('PASS weak/result pagination, cross-page selection, atomic selection conflict and single cross-book create with bookId=null');

let loseAnswer = true;
const answerCalls = [];
override = async config => {
  if (config.url.endsWith('/answer')) {
    answerCalls.push(config.data);
    const response = await fixture(config);
    if (loseAnswer) { loseAnswer = false; throw new AxiosError('timeout after commit', 'ECONNABORTED', config); }
    return response;
  }
  return fixture(config);
};
click('认识');
await until(() => document.querySelector('.form-error')?.textContent.includes('请求超时'), 'unknown saved answer');
assert.equal(document.querySelector('.study-meaning'), null);
await readyClick('重试原请求');
await until(() => document.querySelector('.study-position')?.textContent.includes('第 2'), 'confirmed answer retry advances');
await readyClick('上一词');
await until(() => document.querySelector('.study-meaning'), 'saved answer remains available in history');
assert.match(document.querySelector('.study-position').textContent, /第 1/);
assert.equal(answerCalls[0], answerCalls[1]);
loseAnswer = true;
await readyClick('记错了');
await readyClick('改为不认识');
await until(() => document.querySelector('.form-error')?.textContent.includes('请求超时'), 'unknown correction');
assert.equal(button('下一词').disabled, true);
await readyClick('重试原请求');
await until(() => document.querySelector('.study-position')?.textContent.includes('第 2'), 'confirmed correction retry returns to current word');
await readyClick('上一词');
await until(() => document.querySelector('.recall-forgot')?.getAttribute('aria-pressed') === 'true' && button('下一词')?.disabled === false, 'corrected answer remains available in history');
assert.equal(answerCalls[2], answerCalls[3]);
assert.notEqual(JSON.parse(answerCalls[0]).requestId, JSON.parse(answerCalls[2]).requestId);
override = undefined;
await readyClick('下一词');
await until(() => document.querySelector('.study-position')?.textContent.includes('第 2'), 'second cross-book word');
await readyClick('认识'); await until(() => document.querySelector('.result-stats'), 'last cross-book answer completes the workspace round');
assert.deepEqual(resultStats(), ['2', '2', '2', '1']);
assert.deepEqual(await weakPage(), weakSnapshot);
assert.deepEqual(await dailyApi.task(daily.batchId), dailySnapshot);
assert.deepEqual(await wordsApi.detail(1001), planSnapshot);
const originalResult = await api.result(crossBatchId);
await readyClick('再次练习模糊／不认识的词');
await until(() => document.querySelector('.study-word'), 'relearn null-book practice');
const relearnBatchId = Number(router.currentRoute.value.params.batchId);
assert.notEqual(relearnBatchId, crossBatchId);
assert.equal((await api.progress(relearnBatchId)).bookId, null);
await readyClick('认识'); await until(() => document.querySelector('.result-stats'), 'relearn result');
assert.deepEqual(resultStats(), ['1', '1', '1', '0']);
assert.equal(button('再次练习模糊／不认识的词'), undefined);
assert.deepEqual(await api.result(crossBatchId), originalResult);
assert.deepEqual(await weakPage(), weakSnapshot, 'PRACTICE known does not clear DAILY weak words');
assert.equal((await wordsApi.weak({ source: 'PRACTICE', page: 1, size: 100 })).records.some(word => word.wordId === 1001), false);
console.log('PASS answer/correction retries reuse IDs and count once; null-book results/relearn preserve source and DAILY state');

await router.push('/weak-words'); await until(() => document.querySelectorAll('.weak-word-row').length === 3, 'weak for unknown create');
checkById(1001); await until(() => button('专项巩固 1 词')?.disabled === false, 'one selected');
let loseCreate = true;
override = async config => { const response = await fixture(config); if (loseCreate && config.url === '/learning/weak-words/practice') { loseCreate = false; throw new AxiosError('lost create response', 'ECONNABORTED', config); } return response; };
const beforeLostCreate = weakWrites().length;
click('专项巩固 1 词'); await until(() => document.querySelector('.practice-launch-notice')?.textContent.includes('先检查专项记录'), 'unknown create guidance');
assert.equal(button('专项巩固 1 词').disabled, true);
await readyClick('刷新'); await until(() => document.querySelectorAll('.weak-word-row').length === 3, 'GET refresh does not retry create');
assert.equal(weakWrites().length, beforeLostCreate + 1);
assert.equal(button('专项巩固 1 词').disabled, true);
override = undefined;
document.querySelector('.practice-launch-notice a[href="/learning"]').click();
await until(() => document.querySelector('.batch-card'), 'unknown-created batch visible in records');
await router.push(`/learning/${crossBatchId}/result`); await until(() => document.querySelector('.result-stats'), 'original result for unknown relearn');
let loseRelearn = true;
override = async config => { const response = await fixture(config); if (loseRelearn && config.url.endsWith('/relearn')) { loseRelearn = false; throw new AxiosError('lost relearn response', 'ECONNABORTED', config); } return response; };
const beforeRelearn = calls.filter(call => call.url.endsWith('/relearn')).length;
click('再次练习模糊／不认识的词');
await until(() => document.querySelector('.practice-launch-notice')?.textContent.includes('先检查专项记录'), 'unknown relearn guidance');
assert.equal(button('再次练习模糊／不认识的词').disabled, true);
assert.equal(calls.filter(call => call.url.endsWith('/relearn')).length, beforeRelearn + 1);
override = undefined;
console.log('PASS create and relearn unknown outcomes disable resubmission and expose GET-based record recovery');

// Inject an explicit legacy fixture: final detail exists, its normal event does not.
const legacy = { id: 900, bookId: null, selectionType: 'MANUAL', status: 'COMPLETED', createdAt: '2025-01-02T09:00:00', updatedAt: '2025-01-02T09:10:00', items: [{ itemId: 900001, wordId: 1003, word: 'abstract', phonetic: null, meaning: 'adj. 抽象的', sortOrder: 1, result: 1, answered: true, answeredAt: '2025-01-02T09:10:00', nextItemId: null }] };
const stateKey = 'wordtrail.mock.words_reader';
const stored = JSON.parse(localStorage.getItem(stateKey)); stored.batches.push(legacy); localStorage.setItem(stateKey, JSON.stringify(stored));
const incomplete = await wordsApi.weak({ source: 'PRACTICE', page: 1, size: 100 });
assert.equal(incomplete.statisticsComplete, false); assert.equal(incomplete.incompleteWordCount, 1);
assert.equal(incomplete.records.find(word => word.wordId === 1003).statisticsComplete, false);
await router.push('/weak-words'); await until(() => document.querySelectorAll('.weak-word-row').length === 3, 'legacy weak route');
await weakSource('认识专项'); await until(() => document.querySelector('.weak-incomplete-notice'), 'legacy source notice');
assert.match(document.querySelector('.weak-incomplete-notice').textContent, /部分历史缺少记录/);
assert.match(document.querySelector('.weak-data-scope').textContent, /记录范围/);
await router.push('/learning/900/result'); await until(() => document.querySelector('.result-stats'), 'legacy result');
assert.deepEqual(resultStats(), ['1', '1', '0', '0']);
assert.match(document.querySelector('.weak-incomplete-notice').textContent, /0 次不表示从未学习/);
await until(() => document.querySelector('.result-word-feedback')?.textContent.includes('已记录作答 0 次'), 'legacy row shows zero recorded events');

document.querySelector('button[aria-label="打开账户菜单"]').click(); await until(dialog, 'profile'); click('退出登录', dialog());
await until(() => document.querySelector('#username'), 'logout');
input('#username', 'legacy_words'); input('#password', 'example123'); click('登录'); await until(() => document.querySelector('.daily-equation'), 'legacy account');
localStorage.setItem('wordtrail.mock.legacy_words', JSON.stringify({ batches: [{ ...legacy, items: [{ ...legacy.items[0], result: 3 }] }], nextId: 901 }));
await router.push('/weak-words'); await until(() => document.querySelector('.weak-words-sheet .state-panel')?.textContent.includes('暂无已记录'), 'empty daily for isolated user');
await weakSource('认识专项'); await until(() => document.querySelector('.weak-incomplete-notice'), 'empty but incomplete practice');
assert.match(document.querySelector('.weak-words-sheet .state-panel').textContent, /暂无已记录/);
assert.match(document.querySelector('.weak-data-scope').textContent, /暂无已记录的正常作答时间/);
assert.equal((await wordsApi.detail(1001)).personalBooks.length, 0, 'other account personal books remain private');
assert.equal((await wordsApi.detail(1001)).plan, null);
console.log('PASS incomplete rows and source-wide warnings/ranges, empty-but-incomplete source, legacy zero event counts and account isolation');

// A synthetic paginated adapter verifies the UI limit without issuing a create request.
const sample = weakSnapshot.records[0];
override = async config => {
  if (config.url === '/learning/weak-words') {
    const page = Number(config.params.page), size = Number(config.params.size);
    const records = Array.from({ length: 101 }, (_, index) => ({ ...sample, wordId: 5000 + index, word: `word${index}`, source: 'PRACTICE' }));
    return { config, status: 200, headers: {}, data: { code: 'OK', message: 'fixture', data: { ...weakSnapshot, source: 'PRACTICE', page, size, total: 101, records: records.slice((page - 1) * size, page * size) } } };
  }
  return fixture(config);
};
await readyClick('刷新'); await until(() => document.querySelectorAll('.weak-word-row').length === 10, '101-word fixture page');
for (let index = 0; index < 11; index++) {
  check(document.querySelector('.weak-words-page .wordlist-selection input'));
  if (index < 10) { document.querySelector('.weak-words-page button[aria-label="下一页"]').click(); await until(() => document.querySelector('.weak-word-row a')?.textContent === `word${(index + 1) * 10}`, 'next limit page'); }
}
await until(() => document.querySelector('.weak-selected-count')?.textContent.includes('101'), '101 distinct selections');
assert.equal(button('专项巩固 101 词').disabled, true);
check(document.querySelector('.weak-word-row input'), false);
await until(() => button('专项巩固 100 词')?.disabled === false, '100 distinct selections allowed');
assert.equal(weakWrites().length, beforeLostCreate + 1, 'limit check did not create any batch');
override = undefined;
console.log('PASS 1-100 distinct-word limit, cross-page selection and disabled 101-word submission');
console.log('Word detail / weak words / practice Vue DOM and explicit fixture checks passed. Browser layout and real backend are not verified.');
app.unmount(); await window.happyDOM.close();
