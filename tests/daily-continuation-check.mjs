// Real Vue pages with scripted server snapshots; this is not a deployed-backend audit.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';
import { AxiosError } from 'axios';
const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent', 'KeyboardEvent']) Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window); globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', define: { 'import.meta.env.VITE_UI_PREVIEW': '"false"' }, logLevel: 'error', build: { target: 'es2022', outDir: '.qa-continuation-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/app-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { app, router, http, api, dailyApi } = await import('../.qa-continuation-dist/ui.js');
const document = window.document, fallback = http.defaults.adapter, calls = [];
const day = '2026-10-28', clone = value => structuredClone(value);
const task = (changes = {}) => ({ batchId: 700, learningDate: day, dailyTarget: 20, taskType: 'DAILY', studyMode: 'RECOGNITION', modeVersion: 0, trainingCount: 0, status: 'COMPLETED', totalCount: 3, completedCount: 3, skippedCount: 0, answerCount: 3, unfamiliarCount: 0, newWordTarget: 10, reviewLimit: 10, newCount: 3, reviewCount: 0, nextItemId: null, ...changes });
const overview = (current, changes = {}) => ({ learningDate: day, dailyTarget: 20, activeCount: 30, dueCount: 0, newCount: 20, newWordTarget: 10, reviewLimit: 10, reviewBacklogCount: 0, overdueReviewCount: 0, unassignedCount: 20, canAddMore: false, needsMoreWords: false, task: current, ...changes });
let current = overview(null), serverGoal = { dailyTarget: 20, completedCount: 0, remainingCount: 20, reached: false, targetSource: 'SETTING', batchId: null, taskStatus: null };
let nextStart, startEmpty = false, afterJoin, answerSnapshots = [], heldStart, display = 0;
const setGoal = (completedCount, remainingCount, reached) => { serverGoal = { dailyTarget: 20, completedCount, remainingCount, reached, targetSource: 'TASK_SNAPSHOT', batchId: 700, taskStatus: current.task?.status ?? null }; };
const starts = () => calls.filter(call => call.url === '/learning/today/start');
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  calls.push({ url: config.url, method: config.method, body: clone(body ?? null), params: config.params });
  const ok = data => ({ config, status: 200, headers: {}, data: { code: 'OK', data: clone(data) } });
  if (config.url === '/learning/settings') return ok({ dailyTarget: 20, newWordTarget: 10, reviewLimit: 10, preferredStudyMode: 'RECOGNITION', pronunciation: { autoPlay: false, accent: 'US', playbackRate: 1, repeatCount: 1 } });
  if (config.url === '/learning/today') return ok(current);
  if (config.url === '/learning/statistics/summary') return ok({ learningDate: day, source: 'DAILY', goal: serverGoal });
  if (config.url === '/learning/today/start') {
    if (heldStart) await heldStart;
    if (startEmpty) { startEmpty = false; current = overview(null, { unassignedCount: 0, newCount: 0, needsMoreWords: true }); throw new AxiosError('empty', 'ERR_BAD_RESPONSE', config, undefined, { config, status: 409, headers: {}, data: { code: 'NO_DAILY_WORDS', message: '请添加单词到学习计划', data: null } }); }
    assert.ok(nextStart, 'start must be an explicit, expected action'); current = clone(nextStart); nextStart = undefined; return ok(current.task);
  }
  if (config.url === '/learning-batches/700/daily') return ok(current.task);
  if (config.url.endsWith('/training/items') || config.url.endsWith('/training/attempts')) return ok({ page: config.params.page, size: config.params.size, total: 0, records: [] });
  if (config.url.endsWith('/training/next')) return ok({ itemId: current.task.nextItemId, wordId: 1004, word: 'abundant', mode: 'RECOGNITION', modeVersion: 0, presentationId: `display-${++display}`, attemptNo: 1, phase: 'QUESTION', answerRevealed: false, hintUsed: false, extraTraining: false, itemStatus: 'PENDING', completionReason: null, progress: current.task });
  if (config.url.endsWith('/training-answer')) {
    const id = current.task.nextItemId;
    assert.ok(answerSnapshots.length, 'answer must consume a server snapshot');
    current = clone(answerSnapshots.shift());
    const count = current.task.completedCount; setGoal(count, Math.max(0, 20 - count), count >= 20);
    return ok({ trainingId: current.task.trainingCount, itemId: id, wordId: 1004, mode: 'RECOGNITION', action: 'ANSWER', verdict: 'SELF_ASSESSED', input: null, selfAssessment: 1, word: 'abundant', translation: '丰富的', hintUsed: false, extraTraining: false, attemptNo: 1, itemStatus: 'DONE', completionReason: 'RECALLED', reviewLogId: null, affectsSchedule: true, answeredAt: `${day}T12:00:00`, progress: current.task });
  }
  if (config.url === '/learning-plan/words' && config.method === 'post') {
    const response = await fallback(config);
    if (afterJoin) { current = clone(afterJoin); afterJoin = undefined; }
    return response;
  }
  return fallback(config);
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) { const end = Date.now() + 7000; while (!predicate()) { if (Date.now() > end) throw new Error(`${label}: ${document.body.textContent}`); await delay(10); } }
function input(selector, value) { const node = document.querySelector(selector); assert.ok(node, selector); node.value = value; node.dispatchEvent(new window.Event('input', { bubbles: true })); }
const visible = node => !node.closest('[style*="display: none"]');
const button = text => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text && visible(node));
async function click(text) { await until(() => button(text) && !button(text).disabled, text); button(text).click(); }
async function visit(path, predicate) { if (router.currentRoute.value.path === path) await router.push('/records'); await router.push(path); await until(predicate, path); }
const ready = () => document.querySelector('.daily-training-rating button')?.disabled === false;
await until(() => document.querySelector('#username'), 'login'); input('#username', 'continuation_reader'); input('#password', 'example123'); await click('登录');
await until(() => document.querySelector('.daily-equation'), 'today');
await visit('/learn', () => button('开始今日学习'));
assert.equal(starts().length, 0);
await visit('/learn', () => button('开始今日学习')); assert.equal(starts().length, 0, 'entry and reentry do not start');
startEmpty = true; await click('开始今日学习');
await until(() => document.querySelector('.learning-empty .daily-needs-words'), 'normal empty start');
assert.equal(document.querySelector('.learning-error'), null); assert.ok(document.querySelector('.learning-empty a[href="/books"]'));
await visit('/today', () => document.querySelector('.today-cta a[href="/books"]'));
assert.equal(button('开始学习'), undefined); assert.match(document.querySelector('.daily-needs-words').textContent, /加入学习计划/);
// Cover the same empty-start race through the homepage action.
current = overview(null); await visit('/today', () => button('开始学习')); startEmpty = true; await click('开始学习');
await until(() => document.querySelector('.today-hero .daily-needs-words'), 'today empty start'); assert.equal(document.querySelector('.today-hero [role=alert]'), null);
console.log('PASS entry/reentry GET only and NO_DAILY_WORDS from both start entries becomes a normal plan-add empty state');

// These are server-provided allocations, not a frontend selection algorithm.
for (const [newWordTarget, reviewLimit, newCount, reviewCount, totalCount] of [[10, 10, 3, 17, 20], [10, 10, 17, 3, 20], [10, 0, 0, 10, 10], [0, 10, 10, 0, 10]]) {
  const target = newWordTarget + reviewLimit;
  current = overview(task({ status: 'IN_PROGRESS', dailyTarget: target, completedCount: 0, newWordTarget, reviewLimit, newCount, reviewCount, totalCount, nextItemId: 701 }), { dailyTarget: target }); setGoal(0, target, false); serverGoal.dailyTarget = target;
  const before = starts().length;
  await visit('/today', () => document.querySelector('.daily-assigned-counts'));
  assert.match(document.querySelector('.daily-assigned-counts').textContent, new RegExp(`新词 ${newCount} · 复习 ${reviewCount}`));
  await click('继续学习'); await until(ready, 'queue restore'); assert.equal(starts().length, before, 'ongoing task resumes without start');
}
console.log('PASS both substitution directions and zero-preference categories display actual server newCount/reviewCount and resume the shared queue');

current = overview(task(), { unassignedCount: 0, newCount: 0, needsMoreWords: true }); setGoal(3, 17, false);
await visit('/records/700', () => document.querySelector('.live-daily-result .daily-goal-status'));
assert.match(document.querySelector('.daily-goal-status').textContent, /还差 17/); assert.equal(current.task.dailyTarget, 20);
assert.ok(document.querySelector('.result-ctas a[href="/books"]')); assert.equal(button('继续学习'), undefined);
const personal = await api.createBook({ name: '仅收藏', description: null }); await api.collectWords(personal.id, [1004]);
assert.equal((await dailyApi.today()).needsMoreWords, true, 'collecting alone never joins a plan');
afterJoin = overview(task(), { unassignedCount: 17, newCount: 17, canAddMore: true });
const writesBeforeJoin = starts().length;
await visit('/books/1', () => document.querySelector('input[aria-label="选择 abundant"]'));
document.querySelector('input[aria-label="选择 abundant"]').click(); await click('加入学习计划');
await until(() => document.querySelector('.live-notice a[href="/learn"]'), 'joined and progress reloaded');
const joinedIndex = calls.findLastIndex(call => call.url === '/learning-plan/words' && call.method === 'post');
assert.ok(calls.slice(joinedIndex + 1).some(call => call.url === '/learning/today')); assert.equal(starts().length, writesBeforeJoin);
await visit('/learn', () => button('继续学习'));
assert.match(document.querySelector('.daily-goal-status').textContent, /还差 17/); assert.equal(starts().length, writesBeforeJoin);
nextStart = overview(task({ status: 'IN_PROGRESS', totalCount: 20, completedCount: 3, newCount: 20, nextItemId: 704 }), { unassignedCount: 0, newCount: 0 });
let release; heldStart = new Promise(resolve => { release = resolve; }); const continueButton = button('继续学习'); await click('继续学习');
continueButton.click(); await until(() => starts().length === writesBeforeJoin + 1, 'duplicate-start guard'); release(); heldStart = undefined;
await until(ready, 'appended queue'); assert.equal(current.task.batchId, 700); assert.equal(current.task.dailyTarget, 20); assert.equal(current.task.totalCount, 20);
answerSnapshots = Array.from({ length: 17 }, (_, index) => overview(task({ status: index === 16 ? 'COMPLETED' : 'IN_PROGRESS', totalCount: 20, completedCount: 4 + index, newCount: 20, trainingCount: 4 + index, nextItemId: index === 16 ? null : 705 + index }), { unassignedCount: index === 16 ? 20 : 0, newCount: index === 16 ? 20 : 0, canAddMore: index === 16 }));
for (let n = 0; n < 17; n++) { await until(ready, 'answer enabled'); document.querySelector('.daily-training-rating button').click(); await until(() => document.querySelector('.daily-training-feedback'), 'saved'); document.querySelector('.daily-training-feedback > .btn').click(); }
await until(() => button('继续学习') && document.querySelector('.learning-empty .daily-goal-status')?.textContent.includes('已达成'), 'completed queue still allows continuation');
assert.equal(current.task.completedCount, 20); assert.ok(calls.filter(call => call.url === '/learning/today').length > 4);
console.log('PASS original goal survives a 3-word shortage; collection differs from joining; join re-GETs progress; explicit append and answers retain one batch without duplicate clicks');

current = overview(task({ totalCount: 200, completedCount: 200, newCount: 3, reviewCount: 197 }), { unassignedCount: 5, canAddMore: true }); setGoal(200, 0, true);
await visit('/today', () => button('继续学习'));
await until(() => document.querySelector('.daily-goal-status')?.textContent.includes('已达成'), 'server achievement');
const before205 = starts().length;
nextStart = overview(task({ status: 'IN_PROGRESS', totalCount: 205, completedCount: 200, newCount: 3, reviewCount: 202, nextItemId: 901 }), { unassignedCount: 0 });
await click('继续学习'); await until(ready, '205 total'); assert.equal(starts().length, before205 + 1); assert.equal(current.task.totalCount, 205); assert.equal(current.task.dailyTarget, 20); assert.match(document.querySelector('.workspace-progress').textContent, /200 \/ 205/);
answerSnapshots = Array.from({ length: 5 }, (_, index) => overview(task({ status: index === 4 ? 'COMPLETED' : 'IN_PROGRESS', totalCount: 205, completedCount: 201 + index, newCount: 3, reviewCount: 202, trainingCount: 201 + index, nextItemId: index === 4 ? null : 902 + index }), { unassignedCount: index === 4 ? 1 : 0, canAddMore: index === 4 }));
for (let n = 0; n < 5; n++) { await until(ready, '205 answer'); document.querySelector('.daily-training-rating button').click(); await until(() => document.querySelector('.daily-training-feedback'), '205 saved'); document.querySelector('.daily-training-feedback > .btn').click(); }
await visit('/records/700', () => button('继续学习'));
assert.match(document.querySelector('.session-stat-grid').textContent, /205 \/ 205/);
nextStart = overview(task({ status: 'IN_PROGRESS', totalCount: 206, completedCount: 205, newCount: 3, reviewCount: 203, nextItemId: 910 }), { unassignedCount: 0 });
await click('继续学习'); await until(ready, 'repeat beyond 205'); assert.equal(current.task.totalCount, 206); assert.equal(current.task.batchId, 700);
console.log('PASS reached goals and 200 completed words do not block 205/206 cumulative totals or repeated continuation from today and results');

// Assert the server goal, not local task arithmetic, is the source of achievement text.
current = overview(task({ totalCount: 205, completedCount: 205 }), { needsMoreWords: true, unassignedCount: 0 }); setGoal(205, 7, false);
await visit('/today', () => document.querySelector('.daily-goal-status')?.textContent.includes('还差 7'));
assert.equal(document.querySelector('.today-hero').textContent.includes('每日目标已达成'), false);
console.log('PASS goal.reached/remainingCount are used verbatim, independently of task status/counters');
await visit('/settings', () => document.querySelector('#new-word-target'));
input('#new-word-target', '200'); input('#review-limit', '1'); await click('保存每日配额');
await until(() => document.querySelector('#allocation-error')?.textContent.includes('合计为 1～200'), 'per-round configuration still bounded');
assert.equal(calls.some(call => call.url.endsWith('/allocation')), false);
console.log('PASS cumulative totals over 200 do not relax the independent 1–200 configuration validation');
app.unmount(); await window.happyDOM.close();
