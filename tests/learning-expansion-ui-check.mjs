// Mounted real Vue pages with explicit fixtures. No claim of live API integration.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';
import { AxiosError } from 'axios';
const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent', 'KeyboardEvent']) Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window); globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', define: { 'import.meta.env.VITE_UI_PREVIEW': '"false"' }, logLevel: 'error', build: { target: 'es2022', outDir: '.qa-expansion-ui-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/app-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { app, router, http } = await import('../.qa-expansion-ui-dist/ui.js');
const document = window.document, calls = [], created = new Map();
const fallback = http.defaults.adapter, clone = value => JSON.parse(JSON.stringify(value));
const ok = (config, data) => ({ config, status: 200, headers: {}, data: { code: 'OK', data: clone(data) } });
const page = (records, params) => ({ page: params?.page || 1, size: params?.size || 20, total: records.length, records });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, label) { const deadline = Date.now() + 6000; while (!test()) { if (Date.now() > deadline) throw new Error(`Timeout ${label}: ${document.body.textContent}`); await delay(10); } }
function input(selector, value) { const element = document.querySelector(selector); assert.ok(element, selector); element.value = value; element.dispatchEvent(new window.Event('input', { bubbles: true })); }
function change(selector, value) { const element = document.querySelector(selector); assert.ok(element, selector); element.value = value; element.dispatchEvent(new window.Event('change', { bubbles: true })); }
function button(text) { return [...document.querySelectorAll('button')].find(b => (b.textContent.trim() === text || b.getAttribute('aria-label') === text) && !b.closest('[style*="display: none"]')); }
async function click(text) { await until(() => button(text) && !button(text).disabled, text); button(text).click(); }
let pronunciation = { autoPlay: false, accent: 'US', playbackRate: 1, repeatCount: 1 };
let allocation = { newWordTarget: 10, reviewLimit: 20 }, dailyCalls = 0, createLoss = true, revealed = false, eventNo = 1;
const task = { batchId: 90, taskType: 'PRACTICE', learningDate: null, dailyTarget: 0, studyMode: 'LISTEN_DICTATION', modeVersion: 0, status: 'IN_PROGRESS', totalCount: 1, completedCount: 0, skippedCount: 0, answerCount: 0, trainingCount: 0, unfamiliarCount: 0, newCount: 1, reviewCount: 0, nextItemId: 900 };
const daily = { ...task, batchId: 50, taskType: 'DAILY', learningDate: '2026-10-27', dailyTarget: 15, newWordTarget: 5, reviewLimit: 10 };
const issue = (id, reason = 'SPELLING_ERROR', category = 'ERROR') => ({ wordId: id, word: 'apple', reason, category, lastInput: 'aple', translation: '苹果', mode: 'DICTATION', trainingId: 10, batchId: 50, itemId: 500, lastOccurredAt: '2026-10-27T10:00:00', occurrenceCount: 3 });
let zipFailure = true, downloads = 0, heldExport;
const originalCreate = URL.createObjectURL;
URL.createObjectURL = () => { downloads++; return 'blob:fixture-download'; }; URL.revokeObjectURL = () => {};
window.HTMLAnchorElement.prototype.click = function () { if (!this.download) this.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); };
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  calls.push({ url: config.url, method: config.method, body: clone(body ?? null), params: config.params });
  if (config.url === '/learning/settings' && config.method === 'get') return ok(config, { dailyTarget: allocation.newWordTarget + allocation.reviewLimit, ...allocation, pronunciation });
  if (config.url === '/learning/settings/allocation') { allocation = body; return ok(config, { dailyTarget: body.newWordTarget + body.reviewLimit, ...body, pronunciation }); }
  if (config.url === '/learning/settings/pronunciation') { pronunciation = body; return ok(config, { dailyTarget: 30, ...allocation, pronunciation }); }
  if (config.url === '/learning/today') { dailyCalls++; return ok(config, { learningDate: '2026-10-27', dailyTarget: 15, newWordTarget: 5, reviewLimit: 10, reviewBacklogCount: 25, overdueReviewCount: 9, activeCount: 40, dueCount: 30, newCount: 10, unassignedCount: 25, canAddMore: false, task: daily }); }
  if (config.url === '/learning-batches/50/daily') { dailyCalls++; return ok(config, daily); }
  if (config.url === '/learning/consolidation/summary') return ok(config, ['SPELLING_ERROR', 'ANSWER_REVEALED', 'UNRECOGNIZED', 'ATTEMPT_LIMIT'].map(reason => ({ category: 'ERROR', reason, wordCount: reason === 'SPELLING_ERROR' ? 1 : 0 })));
  if (config.url === '/learning/consolidation/issues') {
    assert.equal(config.params.category, 'ERROR');
    return ok(config, { page: config.params.page, size: 20, total: 21, records: config.params.page === 2 ? [issue(2)] : [issue(1), issue(1, 'ANSWER_REVEALED')] });
  }
  if (config.url === '/learning/consolidation/batches') {
    if (config.method === 'get') return ok(config, page([task], config.params));
    assert.equal('count' in body && 'wordIds' in body, false);
    if (!created.has(body.requestId)) created.set(body.requestId, clone(task));
    if (createLoss) { createLoss = false; throw new Error('lost create response'); }
    return ok(config, created.get(body.requestId));
  }
  if (config.url === '/learning/consolidation/batches/90') return ok(config, task);
  if (config.url.endsWith('/90/next') || config.url.endsWith('/50/daily/training/next')) {
    const progress = config.url.includes('/consolidation/') ? task : daily;
    return ok(config, { itemId: 900, mode: progress.studyMode, modeVersion: progress.modeVersion, attemptNo: eventNo, presentationId: `display-${eventNo}`, phase: 'AWAITING_INPUT', answerRevealed: revealed, hintUsed: revealed,
      // Even an unexpected payload with semantic fields must not expose the initial listening answer.
      word: 'secretspelling', phonetic: 'secretphonetic', translation: '隐藏释义', wordId: 88, audioUrl: '/api/learning-batches/90/training/items/900/audio?presentationId=x&modeVersion=0', pronunciation, progress, itemStatus: 'PENDING', completionReason: null, extraTraining: false });
  }
  if (config.url.endsWith('/900/answer')) { revealed = true; task.trainingCount++; eventNo++; return ok(config, { action: 'REVEAL', word: 'secretspelling', trainingId: 1, progress: task }); }
  if (config.url.endsWith('/90/mode')) { task.studyMode = body.mode; task.modeVersion++; return ok(config, task); }
  if (config.url.endsWith('/90/items')) return ok(config, page([{ itemId: 900, sortOrder: 1, itemStatus: 'PENDING', completionReason: null, current: true, canExtraTrain: false, answerCount: 0, trainingCount: task.trainingCount }], config.params));
  if (config.url.endsWith('/90/attempts')) return ok(config, page([], config.params));
  if (config.url === '/me/learning-data/export') {
    if (heldExport) await heldExport;
    if (zipFailure) throw new AxiosError('failed', 'ERR_BAD_RESPONSE', config, null, { config, status: 403, headers: {}, data: new Blob([JSON.stringify({ code: 'FORBIDDEN', message: '导出未授权' })]) });
    return { config, status: 200, headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="learning.zip"' }, data: new Blob([new Uint8Array([80, 75, 3, 4, 80, 75, 5, 6, ...Array(18).fill(0)])]) };
  }
  return fallback(config);
};
await until(() => document.querySelector('#username'), 'login'); input('#username', 'fixture_reader'); input('#password', 'fixture123'); await click('登录'); await until(() => document.querySelector('.daily-equation'), 'home');
await router.push('/consolidation'); await until(() => document.querySelectorAll('.consolidation-issue').length === 2, 'issue rows');
assert.match(document.querySelector('.consolidation-issue').textContent, /aple.*单词默写.*发生 3 次/s); assert.equal(calls.filter(c => c.url.endsWith('/issues')).at(-1).params.category, 'ERROR');
assert.equal(document.querySelector('.consolidation-page h1'), null);
assert.ok(!document.querySelector('.consolidation-page').textContent.includes('待验证'));
assert.equal(document.querySelectorAll('.consolidation-summary > div').length, 4);
const reasonSelect = document.querySelector('.consolidation-reason-select [role=combobox]'); reasonSelect.click();
await until(() => document.querySelectorAll('.consolidation-reason-select [role=option]').length === 5, 'four supported reasons');
assert.ok(!document.querySelector('.consolidation-reason-select').textContent.includes('验证'));
reasonSelect.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
const modeSelect = document.querySelector('.consolidation-controls [role=combobox]'); modeSelect.click();
modeSelect.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
modeSelect.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await until(() => modeSelect.textContent.includes('听音默写') && !document.querySelector('.consolidation-controls [role=listbox]'), 'keyboard mode selection');
assert.equal(calls.filter(c => c.url.endsWith('/batches') && c.method === 'post').length, 0, 'selecting a mode never submits the form');
const checks = [...document.querySelectorAll('.consolidation-issue input')]; checks[0].click(); checks[1].click(); await until(() => document.querySelector('.consolidation-controls').textContent.includes('已选 1 个不同单词'), 'word deduplication');
document.querySelector('.consolidation-page section[aria-label="巩固词项"] button[aria-label="下一页"]').click(); await until(() => document.querySelectorAll('.consolidation-issue').length === 1, 'page two');
assert.equal(calls.filter(c => c.url.endsWith('/issues')).at(-1).params.page, 2);
document.querySelector('.consolidation-issue input').click(); await click('巩固所选单词');
await until(() => button('重试原创建请求') && !button('重试原创建请求').disabled && document.querySelector('.consolidation-controls').textContent.includes('创建结果尚未确认'), 'uncertain create'); const firstCreate = calls.filter(c => c.url.endsWith('/batches') && c.method === 'post')[0]; assert.deepEqual(firstCreate.body.wordIds, [1, 2]);
assert.ok(document.querySelector('.consolidation-controls fieldset').disabled); assert.ok(document.querySelector('.consolidation-reason-select [role=combobox]').disabled);
await router.push('/today'); await router.push('/consolidation');
await until(() => button('重试原创建请求') && document.querySelector('.consolidation-controls').textContent.includes('已选 2 个不同单词'), 'pending create restored');
await click('重试原创建请求');
await until(() => router.currentRoute.value.path === '/consolidation/batches/90' && document.querySelector('.daily-training-card'), 'shared practice page');
assert.equal(created.size, 1); assert.deepEqual(calls.filter(c => c.url.endsWith('/batches') && c.method === 'post')[1].body, firstCreate.body);
const before = dailyCalls, card = document.querySelector('.daily-training-card');
assert.equal(card.querySelector('.learning-word'), null); assert.equal(card.querySelector('.word-meaning'), null); assert.ok(!card.textContent.includes('secret')); assert.ok(!card.textContent.includes('隐藏释义')); assert.equal(document.querySelector('button[aria-label="显示中文释义"]').disabled, true);
assert.equal(card.querySelectorAll('.letter-slot').length, 1, 'listening does not expose answer length');
const reveal = [...document.querySelectorAll('button')].find(b => b.textContent.includes('不会／看答案')); reveal.click();
await until(() => document.querySelector('.daily-assisted-note'), 'assisted listening'); assert.equal(document.querySelector('.learning-word').textContent, 'secretspelling');
const writes = calls.filter(c => c.url.endsWith('/900/answer')).length;
await router.push('/consolidation'); await router.push('/consolidation/batches/90'); await until(() => document.querySelector('.daily-assisted-note'), 'reentered reveal');
assert.equal(calls.filter(c => c.url.endsWith('/900/answer')).length, writes); assert.equal(dailyCalls, before, 'practice never reads DAILY');
await router.push('/settings'); await until(() => document.querySelector('#new-word-target'), 'allocation settings');
assert.equal(document.querySelectorAll('.settings-nav [role=tab]').length, 3);
await click('增加每日新词'); assert.equal(document.querySelector('#new-word-target').value, '11');
await click('减少每日新词'); assert.equal(document.querySelector('#new-word-target').value, '10');
input('#new-word-target', '200'); await delay(0); assert.equal(button('增加每日新词').disabled, true);
input('#new-word-target', '0'); await delay(0); assert.equal(button('减少每日新词').disabled, true);
input('#new-word-target', '0'); input('#review-limit', '0'); await click('保存每日配额'); await until(() => document.querySelector('.settings-page').textContent.includes('合计为 1～200'), 'invalid sum'); assert.equal(calls.filter(c => c.url.endsWith('/allocation')).length, 0);
input('#new-word-target', '12'); input('#review-limit', '18'); await click('保存每日配额'); await until(() => document.querySelector('.live-notice')?.textContent.includes('30 词'), 'saved allocation');
assert.ok(!calls.some(c => c.method === 'put' && c.url === '/learning/settings'));
await click('发音与播放');
const audioForm = document.querySelector('.pronunciation-form'); audioForm.querySelector('input[type=checkbox]').click(); change('.pronunciation-form select', 'UK'); input('.pronunciation-form input[min="0.5"]', '.75'); input('.pronunciation-form input[min="1"]', '2'); await click('保存发音设置'); await until(() => audioForm.textContent.includes('已保存'), 'saved audio');
assert.deepEqual(calls.filter(c => c.url.endsWith('/pronunciation')).at(-1).body, { autoPlay: true, accent: 'UK', playbackRate: .75, repeatCount: 2 });
await click('每日配额'); assert.equal(document.querySelector('#new-word-target').value, '12'); assert.equal(document.querySelector('#review-limit').value, '18');
await click('数据管理');
await click('导出 ZIP'); await until(() => document.querySelector('.settings-page').textContent.includes('导出未授权'), 'export error'); assert.equal(downloads, 0); assert.ok(!document.body.textContent.includes('导出文件已下载'));
zipFailure = false; await click('导出 ZIP'); await until(() => document.body.textContent.includes('导出文件已下载'), 'ZIP download'); assert.equal(downloads, 1);
let releaseExport; heldExport = new Promise(resolve => { releaseExport = resolve; });
const exportCount = calls.filter(c => c.url === '/me/learning-data/export').length;
await click('导出 ZIP');
await until(() => calls.filter(c => c.url === '/me/learning-data/export').length === exportCount + 1, 'export request');
await router.push('/today'); await until(() => document.querySelector('.daily-equation'), 'snapshot home');
releaseExport(); await delay(20); assert.equal(downloads, 1, 'leaving settings cancels late downloads');
assert.doesNotMatch(document.querySelector('.today-hero').textContent, /每轮偏好|当前任务策略|未编入今日任务|逾期复习|逾期指/);
assert.match(document.querySelector('.daily-assigned-counts').textContent, /新词 1 · 复习 0/); assert.equal(daily.newWordTarget, 5);
app.unmount(); URL.createObjectURL = originalCreate; await window.happyDOM.close();
console.log('PASS mounted Vue: four real issue reasons, pagination, recent input, deduplicated selection, exact lost-create retry');
console.log('PASS mounted Vue: shared PRACTICE isolation, listening answer/length masking, assisted refresh without repeat REVEAL');
console.log('PASS mounted Vue: allocation validation/snapshot, actual pronunciation PUT body, ZIP auth failure and successful download');
