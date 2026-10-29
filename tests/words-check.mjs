import { seedHistoricalPractice } from './helpers/legacy-practice.mjs';
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
const dialog = () => document.querySelector('[role="dialog"]');
const weakPage = () => wordsApi.weak({ source: 'DAILY', page: 1, size: 100 });
const weakWrites = () => calls.filter(call => call.url === '/learning/weak-words/practice' && call.method === 'post');
async function dailyAnswer(taskId, result) { const progress = await dailyApi.task(taskId); const item = await dailyApi.item(taskId, progress.nextItemId); const saved = await dailyApi.answer(taskId, item.itemId, { result, attemptNo: item.nextAttemptNo, requestId: crypto.randomUUID() }); return { item, saved }; }

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
assert.equal(document.querySelector('.weak-data-scope'), null);
assert.equal(document.querySelector('.weak-words-page').textContent.includes('记录范围'), false);
assert.equal(document.querySelector('.weak-words-page .word-sentence-practice'), null);
assert.equal(button('默写所选').disabled, true);
assert.equal(document.querySelector('.weak-words-page').textContent.includes('关联句子'), false);
assert.match(document.querySelector('.weak-word-row').textContent, /累计作答 1 次/);
assert.equal(document.body.textContent.includes('已掌握'), false);
check(document.querySelector('.weak-word-row a[href="/words/1001"]').closest('.weak-word-row').querySelector('input'));
await until(() => document.querySelector('.weak-selected-count').textContent.includes('1'), 'word selected');
assert.equal(button('默写所选').disabled, false);
await readyClick('清空选择', '.weak-words-page');
assert.equal(document.querySelector('[aria-label="薄弱词来源"]'), null);
assert.equal(document.querySelector('.weak-words-page h1'), null);
assert.equal(document.querySelector('.weak-words-page').textContent.includes('历史认读专项'), false);
assert.ok(calls.filter(call => call.url === '/learning/weak-words').every(call => call.params.source === 'DAILY'));
let rejectGet = true;
override = async config => { if (rejectGet && config.url === '/learning/weak-words') { rejectGet = false; throw new AxiosError('network', 'ERR_NETWORK', config); } return fixture(config); };
click('刷新'); await until(() => document.querySelector('.weak-words-sheet .state-panel')?.textContent.includes('暂时无法连接'), 'weak GET failure');
await readyClick('重新加载', '.weak-words-sheet');
await until(() => document.querySelectorAll('.weak-word-row').length === 3, 'read-only retry'); override = undefined;
console.log('PASS daily-only weak list without retired source, page heading or sentence controls; corrected results, paused/removed words and retry');

const dictionary = (await api.words(1, { page: 1, size: 12, learningStatus: 'ALL' })).records;
const archived = seedHistoricalPractice(localStorage, 'words_reader', dictionary);
const archiveBefore = localStorage.getItem('wordtrail.mock.words_reader');
assert.equal('practice' in wordsApi, false);
const practiceWeak = await wordsApi.weak({ source: 'PRACTICE', page: 1, size: 10 });
assert.equal(practiceWeak.total, 12); assert.equal(practiceWeak.records.length, 10);
assert.deepEqual(await weakPage(), weakSnapshot);
assert.deepEqual(await dailyApi.task(daily.batchId), dailySnapshot);
assert.deepEqual(await wordsApi.detail(1001), planSnapshot);
const practiceSecondPage = await wordsApi.weak({ source: 'PRACTICE', page: 2, size: 10 });
assert.equal(practiceSecondPage.records.length, 2, 'historical data API remains readable');
const readsBeforeRefresh = calls.length;
await readyClick('刷新', '.weak-words-page');
await until(() => document.querySelectorAll('.weak-word-row').length === 3, 'daily weak list remains isolated');
assert.ok(calls.slice(readsBeforeRefresh).filter(call => call.url === '/learning/weak-words').every(call => call.params.source === 'DAILY'));
assert.equal(document.querySelector('.weak-words-page').textContent.includes('历史认读专项'), false);
assert.equal(document.querySelector('.weak-selection-footer'), null);
assert.equal(document.querySelector('.practice-launch-notice'), null);
assert.equal(weakWrites().length, 0);
const archivedDailyRow = [...document.querySelectorAll('.weak-word-row')].find(row => row.querySelector('a')?.getAttribute('href') === '/words/1001');
click('学习历史', archivedDailyRow);
await until(() => dialog()?.querySelector('.history-event'), 'archived word history');
assert.match(dialog().textContent, /历史认读专项/);
document.querySelector('button[aria-label="关闭弹窗"]').click();
await until(() => !dialog(), 'history closed');
for (const path of ['/learning', '/study/900', '/learning/900/result', '/study/900/items/900001']) {
  const countBefore = calls.length;
  await router.push(path);
  await until(() => document.querySelector('.retired-practice'), 'retired link');
  assert.match(document.querySelector('.retired-practice').textContent, /独立认读专项已下线/);
  assert.equal(calls.slice(countBefore).some(call => call.url.startsWith('/learning-batches') || call.url.endsWith('/start')), false);
}
assert.equal(localStorage.getItem('wordtrail.mock.words_reader'), archiveBefore, 'history and old links leave archived batches and events intact');
// Missing events still produce incomplete coverage; do not invent missing history.
archived.events = []; localStorage.setItem('wordtrail.mock.words_reader', JSON.stringify(archived));
const incomplete = await wordsApi.weak({ source: 'PRACTICE', page: 1, size: 100 });
assert.equal(incomplete.total, 0); assert.equal(incomplete.statisticsComplete, false); assert.equal(incomplete.incompleteWordCount, 12);
override = async config => {
  const response = await fixture(config);
  if (config.url === '/learning/weak-words') Object.assign(response.data.data, { statisticsComplete: false, incompleteWordCount: 2 });
  return response;
};
await router.push('/weak-words'); await until(() => document.querySelector('.weak-incomplete-notice'), 'daily coverage warning');
assert.match(document.querySelector('.weak-incomplete-notice').textContent, /2 个词的历史记录不完整/);
assert.equal(document.querySelector('.weak-words-page').textContent.includes('历史认读专项'), false);
override = undefined;
assert.equal(weakWrites().length, 0);
console.log('PASS archived PRACTICE data/history remain readable while weak UI stays daily-only; coverage and retired links remain read-only');

// The selected words start the existing independent dictation flow, never a retired recognition or sentence task.
const beforeLaunch = calls.length;
// The legacy word-query adapter does not implement /dictation; supply the documented exam snapshots explicitly.
const exam = { batchId: 901, bookId: null, taskType: 'PRACTICE', practiceMode: 'DICTATION', status: 'IN_PROGRESS', totalCount: 1, completedCount: 0, passedCount: null, needsPracticeCount: null, attemptCount: 0, singleAttempt: true, canContinue: true, accuracy: null, nextItemId: 901001, attemptLimit: 1, createdAt: '2026-10-28T16:00:00', completedAt: null };
override = async config => {
  const ok = data => ({ config, status: 200, headers: {}, data: { code: 'OK', data } });
  if (config.url === '/dictation/batches' && config.method === 'post') return ok(exam);
  if (config.url === '/dictation/batches/901') return ok(exam);
  if (config.url === '/dictation/batches/901/next') return ok({ itemId: 901001, prompt: '放弃', promptGroups: [{ partOfSpeech: 'v.', meaning: '放弃' }], presentationId: 'weak-exam-display', nextAttemptNo: 1, correctStreak: 0, requiredCorrectStreak: 1, attemptLimit: 1 });
  return fixture(config);
};
check(document.querySelector('.weak-word-row a[href="/words/1001"]').closest('.weak-word-row').querySelector('input'));
await readyClick('默写所选', '.weak-words-page');
await until(() => document.querySelector('#dictation-input'), 'selected weak word opens independent dictation');
const creates = calls.slice(beforeLaunch).filter(call => call.url === '/dictation/batches' && call.method === 'post');
assert.equal(creates.length, 1);
assert.deepEqual(creates[0].body, { source: 'PLAN', wordIds: [1001] });
assert.deepEqual(await dailyApi.task(daily.batchId), dailySnapshot, 'independent dictation does not change daily progress');
assert.deepEqual(await weakPage(), weakSnapshot, 'creating a test does not clear weak words');
assert.equal(calls.slice(beforeLaunch).some(call => call.url === '/learning/weak-words/practice' || call.url.includes('/word-practice')), false);
console.log('PASS weak-word selection launches existing independent dictation with exact word IDs while retaining daily and weak-word progress');
app.unmount(); await window.happyDOM.close();
