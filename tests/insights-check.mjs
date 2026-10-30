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
const streaks = () => [...document.querySelectorAll('.overview-streaks strong')].map(element => element.textContent.trim().replace(/\s*天$/, '').trim());
const response = (config, data) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: 'fixture', data } });
await until(() => document.querySelector('#username'), 'login');
input('#username', 'insights_reader'); input('#password', 'example123'); click('登录');
await until(() => document.querySelector('.daily-equation'), 'authenticated');
await router.push('/statistics');
await until(() => document.querySelector('.overview-streaks strong') && document.querySelectorAll('.statistics-bar-column').length === 7, 'initial empty insights');
assert.deepEqual(streaks(), ['0', '0', '0']);
assert.match(document.querySelector('.overview-day').textContent, /暂无学习活动/);
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
await until(() => streaks().join(',') === '6,14,58', 'server streaks');
await until(() => document.querySelectorAll('.statistics-bar-column').length === 7, 'server trend');
assert.deepEqual(streaks(), ['6', '14', '58']);
assert.match(document.querySelector('.overview-calendar').textContent, /学习日历/);
const summaryCallsBeforeWindow = insightCalls().filter(call => call.url.endsWith('/summary')).length;
click('最近 30 天'); await until(() => document.querySelectorAll('.statistics-bar-column').length === 30, '30-day trend');
assert.equal(insightCalls().filter(call => call.url.endsWith('/summary')).length, summaryCallsBeforeWindow);
assert.deepEqual(insightCalls().at(-1).params, { source: 'DAILY', days: 30 });
assert.equal(document.querySelector('.statistics-overview').textContent.includes('历史认读专项'), false);
failSummary = true; click('刷新统计');
await until(() => document.querySelector('.overview-streaks [role="alert"]'), 'summary error');
await until(() => document.querySelector('.statistics-bars'), 'trend survives summary error');
failSummary = false; click('重新加载', document.querySelector('.overview-streaks'));
await until(() => document.querySelector('.overview-streaks strong'), 'summary retry');
failTrend = true; click('最近 7 天');
await until(() => document.querySelector('.overview-trend [role="alert"]'), 'trend error');
failTrend = false; click('重新加载', document.querySelector('.overview-trend'));
await until(() => document.querySelectorAll('.statistics-bar-column').length === 7, 'trend retry');
hold = config => config.url.endsWith('/trends');
click('最近 30 天'); await until(() => pending.length === 1, 'held 30');
click('最近 7 天'); await until(() => pending.length === 2, 'held 7');
pending[1].resolve(makeResponse(pending[1].config));
await until(() => document.querySelectorAll('.statistics-bar-column').length === 7, 'newer trend');
pending[0].resolve(makeResponse(pending[0].config)); await new Promise(resolve => setTimeout(resolve, 50));
assert.equal(document.querySelectorAll('.statistics-bar-column').length, 7);
hold = undefined; pending.length = 0;
activityCase = 'reveal'; click('刷新统计');
await until(() => document.querySelector('.overview-calendar-grid button[aria-label*="2032-03-01"][aria-label*="有学习活动"]'), 'reveal activity calendar');
assert.match(document.querySelector('.overview-calendar-grid button[aria-label*="2032-03-01"]').getAttribute('aria-label'), /完成 0 词/);
assert.equal(insightCalls().some(call => call.method !== 'get'), false);
assert.equal(calls.filter(call => call.url === '/learning/today/start').length, 0);
console.log('PASS overview streaks, trend windows, activity with zero completion, read errors, retry and stale responses');
console.log('Learning insights Vue DOM / explicit fixture checks passed. Real backend and mobile geometry are not verified.');
app.unmount(); await window.happyDOM.close();
