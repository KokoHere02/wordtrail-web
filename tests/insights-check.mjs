// Actual Vue components + explicit fixtures; browser geometry and real backend are separate checks.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';
import { AxiosError } from 'axios';
const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent', 'KeyboardEvent']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
}
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', define: { 'import.meta.env.VITE_UI_PREVIEW': '"false"' }, logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-insights-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/app-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { router, http, insightsApi, app } = await import('../.qa-insights-dist/ui.js');
const document = window.document;
const fixture = http.defaults.adapter;
const calls = [];
let override;
http.defaults.adapter = async config => { calls.push({ method: config.method, url: config.url, params: config.params }); return override ? override(config) : fixture(config); };
async function until(predicate, label) {
  const deadline = Date.now() + 9000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error(`Timed out: ${label}\n${document.body.textContent}`); await new Promise(resolve => setTimeout(resolve, 20)); }
}
function input(selector, value) { const element = document.querySelector(selector); assert.ok(element); element.value = value; element.dispatchEvent(new window.Event('input', { bubbles: true })); }
function click(text, root = document) { const element = [...root.querySelectorAll('button')].find(button => button.textContent.trim() === text); assert.ok(element, text); assert.equal(element.disabled, false, text); element.click(); }
const offset = (day, n) => { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + n); return date.toISOString().slice(0, 10); };
const insightCalls = () => calls.filter(call => ['/learning/statistics/trends', '/learning/statistics/summary'].includes(call.url));
const streaks = () => [...document.querySelectorAll('.insights-streak-grid strong')].map(element => element.textContent);
const response = (config, data) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: 'fixture', data } });
await until(() => document.querySelector('#username'), 'login');
input('#username', 'insights_reader'); input('#password', 'example123'); click('登录');
await until(() => document.querySelector('.daily-equation'), 'authenticated');
await router.push('/statistics');
await until(() => document.querySelector('.learning-summary') && document.querySelectorAll('[data-trend-index]').length === 7, 'initial empty insights');
assert.deepEqual(streaks(), ['0', '0', '0']);
assert.match(document.querySelector('.insights-goal').textContent, /今日尚未创建任务/);
assert.match(document.querySelector('.trend-zero-note').textContent, /本窗口暂无已记录/);
assert.equal(insightCalls().some(call => call.method !== 'get'), false);
assert.deepEqual(insightCalls().find(call => call.url.endsWith('/summary')).params, { source: 'DAILY' });
assert.deepEqual(insightCalls().find(call => call.url.endsWith('/trends')).params, { source: 'DAILY', days: 7 });

// Explicit service fixtures for historical streaks, missing logs, future events and cross-batch practice.
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
const dailyState = { plan: [], tasks: [], events: {}, nextId: 100000, latestLog: null, dailyTarget: 200 };
let nextLog = 300000;
function dailyFixture(day, wordIds, recorded) {
  const batchId = dailyState.nextId++;
  const items = wordIds.map(wordId => ({ itemId: dailyState.nextId++, wordId, word: `word${wordId}`, phonetic: null, itemType: 'NEW', learningStatus: 'DONE', result: 1, answerCount: 1, nextAttemptNo: null, nextItemId: null, correctableLogId: null, reinforcementRemaining: 0, attemptLimit: 6, completionReason: 'RECALLED' }));
  const task = { batchId, learningDate: day, dailyTarget: 20, taskType: 'DAILY', status: 'COMPLETED', totalCount: items.length, completedCount: items.length, skippedCount: 0, answerCount: items.length, unfamiliarCount: 0, newCount: items.length, reviewCount: 0, nextItemId: null };
  dailyState.tasks.push({ task, items, queue: [] });
  if (recorded) for (const item of items) {
    const logId = nextLog++;
    dailyState.events[`event${logId}`] = { signature: 'fixture', batchId, receipt: {}, wordId: item.wordId, history: { logId, batchId, itemId: item.itemId, wordId: item.wordId, learningDate: day, answeredAt: `${day}T09:00:00`, result: 1, taskType: 'DAILY', eventType: 'ANSWER', correctsLogId: null, attemptNo: 1, affectsSchedule: true, scheduleBefore: null, scheduleAfter: null, scheduleAvailable: false } };
  }
}
for (const n of [-40, -39, -38, -37, -10, -4, -3, -2, -1]) dailyFixture(offset(today, n), [1001], true);
dailyFixture(today, [1001, 1002, 1003, 1004, 1005, 1006, 1007], false);
dailyFixture(offset(today, -100), [1010], false);
dailyFixture(offset(today, 1), [2001], true);
localStorage.setItem('wordory.mock.daily.insights_reader', JSON.stringify(dailyState));
const storedDaily = localStorage.getItem('wordory.mock.daily.insights_reader');
const summary = await insightsApi.summary('DAILY');
assert.deepEqual([summary.currentStreak, summary.longestStreak, summary.totalStudyDays], [4, 4, 9]);
assert.equal(summary.hasStudiedToday, false, 'yesterday streak survives a day not yet started');
assert.deepEqual([summary.todayCompletedCount, summary.todayAnswerCount, summary.todayStudiedCount], [7, 0, 0]);
assert.deepEqual(summary.goal, { dailyTarget: 20, completedCount: 7, remainingCount: 13, reached: false, targetSource: 'TASK_SNAPSHOT', batchId: dailyState.tasks.find(entry => entry.task.learningDate === today).task.batchId, taskStatus: 'COMPLETED' });
const seven = await insightsApi.trends('DAILY', 7), thirty = await insightsApi.trends('DAILY', 30);
assert.deepEqual([seven.records.length, seven.totalCompletedCount, seven.totalAnswerCount], [7, 11, 4]);
assert.deepEqual([thirty.records.length, thirty.totalCompletedCount, thirty.totalAnswerCount], [30, 12, 5]);
assert.equal(seven.records.at(-1).hasRecordedAnswers, false);
assert.equal(seven.coverage.statisticsComplete, false); assert.equal(seven.coverage.incompleteWordCount, 8);
assert.equal(seven.coverage.firstRecordedAt.slice(0, 10), offset(today, -40));
assert.equal(localStorage.getItem('wordory.mock.daily.insights_reader'), storedDaily, 'new queries never persist settings, logs or tasks');
await assert.rejects(insightsApi.trends('ALL', 7), error => error.code === 'INVALID_PARAMETER');
for (const value of ['', 8, '7.0', 30.5]) await assert.rejects(insightsApi.trends('DAILY', value), error => error.code === 'INVALID_PARAMETER');

const practiceState = { batches: [], nextId: 10, events: [], requests: {}, nextLogId: 500000 };
for (const [index, day] of [offset(today, -1), today, today].entries()) {
  const id = index + 1, itemId = id * 1000 + 1, logId = 500000 + index;
  practiceState.batches.push({ id, bookId: null, selectionType: 'MANUAL', status: 'COMPLETED', createdAt: `${offset(today, -3)}T12:00:00`, updatedAt: `${today}T12:00:00`, items: [{ itemId, wordId: 1001, word: 'abandon', phonetic: null, meaning: 'v. 放弃', sortOrder: 1, result: 1, answered: true, answeredAt: `${day}T10:00:00`, nextItemId: null }] });
  practiceState.events.push({ logId, batchId: id, itemId, wordId: 1001, learningDate: day, answeredAt: `${day}T10:00:00`, result: 1, taskType: 'PRACTICE', eventType: 'ANSWER', correctsLogId: null, attemptNo: index + 1, affectsSchedule: false, scheduleBefore: null, scheduleAfter: null, scheduleAvailable: false });
}
practiceState.events.push({ ...practiceState.events[2], logId: 500004, eventType: 'CORRECTION', correctsLogId: 500002, answeredAt: `${today}T11:00:00` });
practiceState.batches.push({ ...practiceState.batches[0], id: 9, items: [{ ...practiceState.batches[0].items[0], itemId: 9001, wordId: 1003, result: 3 }] });
localStorage.setItem('wordtrail.mock.insights_reader', JSON.stringify(practiceState));
const storedPractice = localStorage.getItem('wordtrail.mock.insights_reader');
const practice = await insightsApi.summary('PRACTICE'), practiceTrend = await insightsApi.trends('PRACTICE', 7);
assert.deepEqual([practice.currentStreak, practice.totalStudyDays, practice.todayCompletedCount, practice.todayAnswerCount, practice.todayStudiedCount], [2, 2, 1, 2, 1]);
assert.equal(practice.goal, null);
assert.deepEqual([practiceTrend.totalCompletedCount, practiceTrend.totalAnswerCount], [2, 3], 'same word completes on two dates, twice today counts two answers');
assert.equal(practice.coverage.incompleteWordCount, 1);
assert.equal(localStorage.getItem('wordtrail.mock.insights_reader'), storedPractice);
assert.deepEqual((await insightsApi.summary('DAILY')).goal, summary.goal, 'PRACTICE cannot offset daily goal');
console.log('PASS explicit read-only service fixtures: source/date aggregation, retained yesterday streak, all-history counts, zero-fill, future exclusion, legacy evidence and goal snapshots');

// This simulated server date intentionally differs from the device clock.
const serverDay = '2032-03-01';
let phase = 'unfinished', empty = false, recordsMissing = false, activityCase;
let failSummary = false, failTrend = false;
const pending = [];
let hold;
const coverage = source => ({ dataScope: source === 'DAILY' ? 'RECORDED_ANSWERS_AND_DAILY_ITEMS' : 'RECORDED_ANSWERS', coverageScope: 'ALL_RETAINED_SOURCE_ITEMS', statisticsComplete: source === 'PRACTICE', incompleteWordCount: source === 'DAILY' ? 2 : 0, firstRecordedAt: '2018-02-03T09:00:00', lastRecordedAt: '2032-02-29T10:00:00' });
function summaryData(source) {
  if (activityCase) return { learningDate: serverDay, source, currentStreak: 1, longestStreak: 1, totalStudyDays: 1, hasStudiedToday: true,
    todayTrainingCount: 1, todayAnswerCount: activityCase === 'wrong' ? 1 : 0, todayStudiedCount: 1, todayCompletedCount: 0, todayRecalledCount: 0,
    goal: { dailyTarget: 20, completedCount: 0, remainingCount: 20, reached: false, targetSource: 'TASK_SNAPSHOT', batchId: 801, taskStatus: 'IN_PROGRESS' }, coverage: coverage(source) };
  const completedCount = phase === 'over' ? 22 : phase === 'setting' ? 0 : 7;
  const dailyTarget = phase === 'setting' ? 50 : 20;
  return { learningDate: serverDay, source, currentStreak: source === 'DAILY' ? 6 : 2, longestStreak: source === 'DAILY' ? 14 : 9, totalStudyDays: source === 'DAILY' ? 58 : 12, hasStudiedToday: source === 'PRACTICE' || phase === 'over', todayStudiedCount: source === 'PRACTICE' ? 2 : phase === 'over' ? 22 : 0, todayCompletedCount: source === 'PRACTICE' ? 2 : completedCount, todayAnswerCount: source === 'PRACTICE' ? 3 : phase === 'over' ? 24 : 0, todayTrainingCount: source === 'PRACTICE' ? 3 : phase === 'over' ? 25 : 0, todayRecalledCount: 0, goal: source === 'PRACTICE' ? null : { dailyTarget, completedCount, remainingCount: phase === 'over' ? 0 : dailyTarget - completedCount, reached: phase === 'over', targetSource: phase === 'setting' ? 'SETTING' : 'TASK_SNAPSHOT', batchId: phase === 'setting' ? null : 801, taskStatus: phase === 'setting' ? null : phase === 'over' ? 'IN_PROGRESS' : 'COMPLETED' }, coverage: coverage(source) };
}
function trendData(source, days) {
  if (activityCase) {
    const records = Array.from({ length: days }, (_, index) => ({ learningDate: offset(serverDay, index - days + 1), trainingCount: index === days - 1 ? 1 : 0,
      answerCount: activityCase === 'wrong' && index === days - 1 ? 1 : 0, completedCount: 0, recalledCount: 0, studiedCount: index === days - 1 ? 1 : 0,
      hasRecordedAnswers: activityCase === 'wrong' && index === days - 1, hasLearningActivity: index === days - 1 }));
    return { source, days, from: records[0].learningDate, to: serverDay, records, totalTrainingCount: 1, totalAnswerCount: activityCase === 'wrong' ? 1 : 0, totalCompletedCount: 0, totalRecalledCount: 0, coverage: coverage(source) };
  }
  const records = Array.from({ length: days }, (_, index) => ({ learningDate: offset(serverDay, index - days + 1), completedCount: empty ? 0 : index === days - 1 ? source === 'DAILY' ? 7 : 2 : index === 0 ? 1 : 0, answerCount: empty ? 0 : index === days - 1 ? source === 'DAILY' ? 0 : 3 : index === 0 ? 2 : 0, studiedCount: empty ? 0 : index === days - 1 ? source === 'DAILY' ? 0 : 2 : index === 0 ? 1 : 0, trainingCount: empty ? 0 : index === 0 ? 2 : source === 'PRACTICE' && index === days - 1 ? 3 : 0, recalledCount: 0, hasLearningActivity: !empty && (index === 0 || source === 'PRACTICE' && index === days - 1), hasRecordedAnswers: !empty && (index === 0 || source === 'PRACTICE' && index === days - 1) }));
  return { source, days, from: records[0].learningDate, to: serverDay, totalCompletedCount: empty ? 0 : source === 'DAILY' ? 8 : 3, totalAnswerCount: empty ? 0 : source === 'DAILY' ? 2 : 5, totalTrainingCount: records.reduce((sum, row) => sum + row.trainingCount, 0), totalRecalledCount: 0, coverage: coverage(source), records: recordsMissing ? [] : records };
}
const makeResponse = config => response(config, config.url.endsWith('/summary') ? summaryData(config.params.source) : trendData(config.params.source, config.params.days));
override = async config => {
  if (activityCase && config.url === '/learning/statistics/daily') return response(config, { learningDate: serverDay, trainingCount: 1, answerCount: activityCase === 'wrong' ? 1 : 0, studiedCount: 1, completedCount: 0, recalledCount: 0, newCompletedCount: 0, reviewCompletedCount: 0, unfamiliarCount: 0, hasLearningActivity: true, statisticsComplete: true, incompleteWordCount: 0 });
  if (activityCase && config.url === '/learning/statistics/calendar') return response(config, { month: serverDay.slice(0, 7), statisticsComplete: true, days: [{ learningDate: serverDay, trainingCount: 1, answerCount: activityCase === 'wrong' ? 1 : 0, completedCount: 0, recalledCount: 0, hasLearningActivity: true, statisticsComplete: true, incompleteWordCount: 0 }] });
  if (!config.url.startsWith('/learning/statistics/trends') && !config.url.endsWith('/statistics/summary')) return fixture(config);
  if (hold?.(config)) return new Promise(resolve => pending.push({ config, resolve }));
  if (config.url.endsWith('/summary') && failSummary || config.url.endsWith('/trends') && failTrend) throw new AxiosError('fixture network error', 'ERR_NETWORK', config);
  return makeResponse(config);
};
click('刷新统计');
await until(() => document.querySelector('.insights-summary-heading')?.textContent.includes(serverDay), 'server date shown');
await until(() => document.querySelector('.trend-readout time')?.textContent === serverDay, 'chart uses returned date');
assert.deepEqual(streaks(), ['6', '14', '58']);
assert.match(document.querySelector('.insights-today-status').textContent, /尚无学习活动/);
assert.match(document.querySelector('.insights-goal-status').textContent, /当前任务已结束/);
assert.match(document.querySelector('.insights-goal-progress').textContent, /剩余目标 13 词/);
assert.equal(document.querySelector('.insights-goal-reached').textContent.includes('已达到'), false);
assert.match(document.querySelector('.insights-coverage').textContent, /2018-02-03/);
assert.match(document.querySelector('.insights-coverage').textContent, /不限于当前 7／30 天/);
assert.equal(document.querySelector('.insights-today-status').classList.contains('recorded'), false);
const summaryCallsBeforeWindow = insightCalls().filter(call => call.url.endsWith('/summary')).length;
click('最近 30 天'); await until(() => document.querySelectorAll('[data-trend-index]').length === 30, '30 days');
assert.equal(insightCalls().filter(call => call.url.endsWith('/summary')).length, summaryCallsBeforeWindow);
assert.deepEqual(insightCalls().at(-1).params, { source: 'DAILY', days: 30 });
assert.equal(document.querySelectorAll('.trend-data-table tbody tr').length, 30);
const point = document.querySelector('[data-trend-index="0"]'); point.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await until(() => document.querySelector('.trend-readout time').textContent === offset(serverDay, -29), 'point click reads server data');
point.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
await until(() => document.querySelector('.trend-readout time').textContent === offset(serverDay, -28), 'keyboard chart selection');
console.log('PASS Vue server dates, independent streaks, task-ended versus goal-reached, coverage range, 7/30 window and accessible chart readout');

click('认识专项', document.querySelector('.insights-controls'));
await until(() => document.querySelector('.insights-summary-heading')?.textContent.includes('认识专项') && !document.querySelector('.insights-summary-panel .state-panel'), 'practice summary');
await until(() => document.querySelectorAll('[data-trend-index]').length === 30, 'practice 30-day chart');
assert.deepEqual(streaks(), ['2', '9', '12']);
assert.equal(document.querySelector('.insights-goal'), null);
assert.match(document.querySelector('.insights-practice-note').textContent, /不抵扣每日目标/);
assert.equal(document.querySelector('.daily-statistics-details'), null);
const onlyInsightsFrom = calls.length;
click('最近 7 天'); await until(() => document.querySelectorAll('[data-trend-index]').length === 7, 'practice seven days');
document.querySelector('[data-trend-index="0"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assert.equal(calls.slice(onlyInsightsFrom).some(call => ['/learning/statistics/daily', '/learning/statistics/calendar', '/learning/statistics/words'].includes(call.url)), false);
failSummary = true;
click('刷新统计'); await until(() => document.querySelector('.insights-summary-panel .state-panel')?.getAttribute('role') === 'alert', 'summary error');
await until(() => document.querySelector('.learning-trend-chart'), 'trend survives independent summary error');
failSummary = false; click('重新加载', document.querySelector('.insights-summary-panel'));
await until(() => document.querySelector('.learning-summary'), 'summary read retry');
failTrend = true;
click('最近 30 天'); await until(() => document.querySelector('.insights-trend-panel .state-panel')?.getAttribute('role') === 'alert', 'trend error');
assert.ok(document.querySelector('.learning-summary'));
failTrend = false; click('重新加载', document.querySelector('.insights-trend-panel'));
await until(() => document.querySelectorAll('[data-trend-index]').length === 30, 'trend read retry');
console.log('PASS source switch updates both sections, hides daily-only details/goal, never calls legacy daily details for PRACTICE and handles partial errors');

hold = config => config.url.endsWith('/trends');
click('最近 7 天'); await until(() => pending.length === 1, 'held seven');
assert.ok(document.querySelector('.insights-trend-panel .state-panel'));
click('最近 30 天'); await until(() => pending.length === 2, 'held thirty');
pending[1].resolve(makeResponse(pending[1].config));
await until(() => document.querySelectorAll('[data-trend-index]').length === 30, 'new window response');
pending[0].resolve(makeResponse(pending[0].config));
await new Promise(resolve => setTimeout(resolve, 50));
assert.equal(document.querySelectorAll('[data-trend-index]').length, 30, 'late old window ignored');
pending.length = 0;
hold = config => config.params.source === 'DAILY';
click('每日学习', document.querySelector('.insights-controls')); await until(() => pending.length === 2, 'held daily summary and trend');
click('认识专项', document.querySelector('.insights-controls'));
await until(() => document.querySelector('.insights-summary-heading')?.textContent.includes('认识专项'), 'new practice summary');
const afterSourceSwitch = calls.length;
for (const entry of pending) entry.resolve(makeResponse(entry.config));
await new Promise(resolve => setTimeout(resolve, 250));
assert.deepEqual(streaks(), ['2', '9', '12']);
assert.equal(document.querySelector('.insights-goal'), null);
assert.equal(calls.slice(afterSourceSwitch).some(call => call.url === '/learning/statistics/words'), false, 'unmounted daily details never start a late word query in PRACTICE');
hold = undefined; pending.length = 0;
console.log('PASS late 7/30 and DAILY/PRACTICE responses never replace current source/window');

phase = 'over';
click('每日学习', document.querySelector('.insights-controls'));
await until(() => document.querySelector('.insights-goal-reached')?.textContent === '已达到每日目标', 'goal exceeded');
assert.match(document.querySelector('.insights-goal-progress').textContent, /22\s*\/ 20 词/);
assert.match(document.querySelector('.insights-goal-status').textContent, /当前任务进行中/);
assert.equal(document.querySelector('[aria-label="每日目标进度"][role="progressbar"]').getAttribute('aria-valuenow'), '20');
assert.match(document.querySelector('[aria-label="每日目标进度"][role="progressbar"]').getAttribute('aria-valuetext'), /完成 22 词/);
phase = 'setting'; click('刷新统计');
await until(() => document.querySelector('.insights-goal-heading')?.textContent.includes('当前设置'), 'setting target');
assert.match(document.querySelector('.insights-goal-status').textContent, /今日尚未创建任务/);
assert.match(document.querySelector('.insights-goal-progress').textContent, /剩余目标 50/);
empty = true; click('最近 7 天'); await until(() => document.querySelector('.trend-zero-note'), 'all zero window');
assert.equal(document.querySelectorAll('[data-trend-index]').length, 7);
assert.ok(document.querySelector('.insights-trend-panel .insights-coverage-warning'), 'empty data does not hide incomplete history');
recordsMissing = true; click('最近 30 天'); await until(() => document.querySelector('.trend-empty'), 'empty returned array');
assert.equal(document.querySelectorAll('[data-trend-index]').length, 0, 'UI does not synthesize dates or missing history');
assert.equal(insightCalls().some(call => call.method !== 'get'), false);
assert.equal(insightCalls().some(call => call.url.endsWith('/summary') && Object.hasOwn(call.params, 'days')), false);
assert.equal(calls.filter(call => call.url === '/learning/today/start').length, 0);
console.log('PASS exceeded/setting goals, zero-data and empty-array states, readonly endpoints and no automatic start');
for (const value of ['reveal', 'wrong']) {
  activityCase = value;
  await router.push('/today'); await router.push('/statistics');
  await until(() => document.querySelector('.insights-today-status.recorded') && document.querySelector('.calendar-day.has-activity') && document.querySelector('.statistics-grid'), `${value} activity rendered`);
  assert.deepEqual([...document.querySelectorAll('.insights-today-counts strong')].map(node => node.textContent), ['1', value === 'wrong' ? '1' : '0', '1', '0', '0']);
  assert.match(document.querySelector('.calendar-day.has-activity').getAttribute('aria-label'), /训练 1 次.*完成 0 词.*有学习活动/);
  assert.equal(document.querySelector('.trend-zero-note'), null, 'REVEAL or wrong input is not an empty learning day');
  assert.match(document.querySelector('.trend-readout').textContent, /训练 1 次/);
  const last = document.querySelector('[data-trend-index="6"]');
  assert.match(last.getAttribute('aria-label'), new RegExp(value === 'wrong' ? '有作答' : '无作答'));
  assert.match(last.getAttribute('aria-label'), /有学习活动/);
  assert.match(document.querySelector('.insights-window-totals').textContent, /1窗口训练合计/);
  assert.deepEqual([...document.querySelectorAll('.statistics-grid strong')].slice(0, 5).map(node => node.textContent), ['0', '1', value === 'wrong' ? '1' : '0', '1', '0']);
}
console.log('PASS reveal-only and wrong-only activity in summary, calendar, daily details and trend; no inferred completion or recalled counts');
console.log('Learning insights Vue DOM / explicit fixture checks passed. Real backend and mobile geometry are not verified.');
app.unmount();
await window.happyDOM.close();
