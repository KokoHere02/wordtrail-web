import assert from 'node:assert/strict';
import { build } from 'vite';
import { AxiosError } from 'axios';
class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
globalThis.sessionStorage = new MemoryStorage();
globalThis.localStorage = new MemoryStorage();
await build({ configFile: false, mode: 'mock', logLevel: 'warn', build: { ssr: 'tests/test-entry.ts', target: 'es2022', outDir: '.qa-daily-dist', emptyOutDir: true } });
const { api, dailyApi, http, tokens, useDailySession } = await import('../.qa-daily-dist/test-entry.js');
tokens.set(await api.login({ username: 'daily_test', password: 'example123' }));
let passed = 0;
async function check(name, run) { await run(); console.log(`PASS ${name}`); passed++; }
await check('today GET does not create a task; empty plan does not create a task', async () => {
  assert.equal((await dailyApi.today()).task, null);
  await assert.rejects(dailyApi.start(), e => e.code === 'NO_DAILY_WORDS');
  assert.equal((await dailyApi.today()).task, null);
});
await check('plan atomic joining, duplicates, pause and reactivation', async () => {
  await assert.rejects(dailyApi.join(1, [1001, 999999]), e => e.code === 'INVALID_PARAMETER');
  assert.equal((await dailyApi.today()).activeCount, 0);
  const joined = await dailyApi.join(1, [1001, 1001, 1002]);
  assert.equal(joined.addedCount, 2);
  assert.equal((await dailyApi.join(1, [1001])).unchangedCount, 1);
  await dailyApi.updatePlan(1001, 'PAUSED');
  assert.equal((await dailyApi.today()).activeCount, 1);
  assert.equal((await dailyApi.join(1, [1001])).reactivatedCount, 1);
});
let session = useDailySession(1);
let batchId, firstItemId;
await check('start is idempotent; queue and meanings come from API', async () => {
  await session.open();
  batchId = session.progress.value.batchId;
  firstItemId = session.item.value.itemId;
  assert.equal((await dailyApi.start()).batchId, batchId);
  assert.equal(session.progress.value.totalCount, 2);
  assert.equal(session.receipt.value, undefined);
  assert.equal('translation' in session.item.value, false);
});
const fixture = http.defaults.adapter;
let failedBody;
await check('unknown write outcome is persisted; repeated clicks are blocked', async () => {
  let count = 0;
  http.defaults.adapter = async config => {
    if (config.url.endsWith('/answer')) {
      count++;
      failedBody = config.data;
      // Simulate a committed answer whose response was lost.
      await fixture(config);
      throw new AxiosError('timeout', AxiosError.ECONNABORTED, config);
    }
    return fixture(config);
  };
  await Promise.all([session.answer(3), session.answer(1)]);
  assert.equal(count, 1);
  assert.equal(session.progress.value.answerCount, 0);
  assert.equal(session.receipt.value, undefined);
  assert.ok(session.pending.value);
  await session.answer(1);
  assert.equal(count, 1);
});
await check('reload retries the exact original request and uses current progress', async () => {
  session = useDailySession(1);
  await session.open();
  assert.equal(session.item.value.itemId, firstItemId);
  let retriedBody;
  http.defaults.adapter = async config => { if (config.url.endsWith('/answer')) retriedBody = config.data; return fixture(config); };
  await session.retry();
  assert.equal(retriedBody, failedBody);
  assert.equal(session.progress.value.answerCount, 1);
  assert.equal(session.progress.value.completedCount, 0);
  assert.match(session.receipt.value.translation, /放弃/);
  assert.equal(session.item.value.itemId, firstItemId);
  assert.equal(session.pending.value, undefined);
  assert.equal(sessionStorage.getItem('wordory.daily.pending.1'), null);
});
await check('unknown words reappear with the same itemId and backend attemptNo', async () => {
  http.defaults.adapter = fixture;
  await session.next();
  assert.notEqual(session.item.value.itemId, firstItemId);
  await session.answer(1);
  assert.equal(session.progress.value.completedCount, 1);
  await session.next();
  assert.equal(session.item.value.itemId, firstItemId);
  assert.equal(session.item.value.nextAttemptNo, 2);
  assert.equal(session.receipt.value, undefined);
  assert.equal(session.item.value.result, 3); // non-null does not mean done
  await session.answer(1);
  assert.equal(session.progress.value.status, 'COMPLETED');
  assert.equal(session.progress.value.answerCount, 3);
  assert.equal(session.progress.value.completedCount, 2);
});
await check('correcting last answer reopens completed task and retains original ANSWER log', async () => {
  const originalLog = session.correctableLogId.value;
  assert.ok(originalLog);
  await session.correct();
  assert.equal(session.progress.value.status, 'IN_PROGRESS');
  assert.equal(session.progress.value.answerCount, 3);
  assert.equal(session.progress.value.completedCount, 1);
  assert.equal(session.correctableLogId.value, originalLog);
  assert.notEqual(session.receipt.value.logId, originalLog);
  await session.next();
  assert.equal(session.item.value.itemId, firstItemId);
  assert.equal(session.item.value.nextAttemptNo, 3);
  await session.answer(3);
  assert.equal(session.progress.value.status, 'COMPLETED');
  assert.equal(session.progress.value.unfamiliarCount, 1);
  assert.equal(session.progress.value.answerCount, 4);
});
await check('completed start does not create another daily task; stats and plans persist', async () => {
  assert.equal((await dailyApi.start()).batchId, batchId);
  const overview = await dailyApi.today();
  assert.equal(overview.task.answerCount, 4);
  assert.equal((await dailyApi.tasks({ page: 1, size: 10, status: 'COMPLETED' })).total, 1);
  assert.equal((await dailyApi.plan({ page: 1, size: 10, status: 'ACTIVE', learningStatus: 'LEARNED' })).total, 2);
});
await check('pending writes are scoped per user', async () => {
  sessionStorage.setItem('wordory.daily.pending.1', JSON.stringify({ batchId, item: session.item.value, kind: 'answer', body: { result: 1, attemptNo: 1, requestId: 'pending_test' } }));
  assert.equal(useDailySession(2).pending.value, undefined);
  sessionStorage.removeItem('wordory.daily.pending.1');
});
await check('stale queue is reconciled instead of changing the request key', async () => {
  const current = useDailySession(10);
  let writes = 0;
  http.defaults.adapter = async config => {
    if (config.url.endsWith('/answer')) { writes++; throw new AxiosError('stale', 'ERR_BAD_RESPONSE', config, undefined, { config, status: 409, statusText: 'Conflict', headers: {}, data: { code: 'STALE_DAILY_ANSWER', message: '队列已变化', data: null } }); }
    const response = await fixture(config);
    if (config.url === `/learning-batches/${batchId}/daily`) response.data.data = { ...response.data.data, status: 'IN_PROGRESS', nextItemId: firstItemId };
    if (config.url === `/learning-batches/${batchId}/daily/items/${firstItemId}`) response.data.data = { ...response.data.data, learningStatus: 'RELEARNING', nextAttemptNo: 3 };
    return response;
  };
  await current.open(batchId);
  await current.answer(1);
  assert.equal(writes, 1);
  assert.equal(current.pending.value, undefined);
  assert.equal(current.receipt.value, undefined);
  assert.match(current.error.value, /队列已变化/);
});
await check('expired writes stop and do not submit again', async () => {
  const current = useDailySession(11);
  let writes = 0;
  http.defaults.adapter = async config => {
    if (config.url.endsWith('/answer')) { writes++; throw new AxiosError('expired', 'ERR_BAD_RESPONSE', config, undefined, { config, status: 409, statusText: 'Conflict', headers: {}, data: { code: 'DAILY_TASK_EXPIRED', message: '历史任务只读', data: null } }); }
    const response = await fixture(config);
    if (config.url === `/learning-batches/${batchId}/daily`) response.data.data = { ...response.data.data, status: 'IN_PROGRESS', nextItemId: firstItemId };
    if (config.url === `/learning-batches/${batchId}/daily/items/${firstItemId}`) response.data.data = { ...response.data.data, learningStatus: 'RELEARNING', nextAttemptNo: 3 };
    return response;
  };
  await current.open(batchId);
  await current.answer(1);
  assert.equal(current.expired.value, true);
  assert.equal(current.pending.value, undefined);
  await current.answer(1);
  assert.equal(writes, 1);
});
http.defaults.adapter = fixture;
tokens.set(await api.login({ username: 'enhanced_daily', password: 'example123' }));
await check('an item skipped between progress and detail reads is never presented for answering', async () => {
  const task = { batchId: 900000, learningDate: '2026-10-20', dailyTarget: 2, taskType: 'DAILY', status: 'IN_PROGRESS', totalCount: 2, completedCount: 0, skippedCount: 1, answerCount: 0, unfamiliarCount: 0, newCount: 2, reviewCount: 0, nextItemId: 91 };
  let reads = 0;
  let writes = 0;
  http.defaults.adapter = async config => {
    let data;
    if (config.url.endsWith('/daily')) data = { ...task, nextItemId: ++reads === 1 ? 91 : 92 };
    else if (config.url === '/learning/today') data = { learningDate: task.learningDate };
    else if (config.url.endsWith('/items/91')) data = { itemId: 91, wordId: 1001, word: 'abandon', phonetic: null, itemType: 'NEW', learningStatus: 'SKIPPED', result: null, answerCount: 0, nextAttemptNo: null, nextItemId: 92, correctableLogId: null };
    else if (config.url.endsWith('/items/92')) data = { itemId: 92, wordId: 1002, word: 'absorb', phonetic: null, itemType: 'NEW', learningStatus: 'PENDING', result: null, answerCount: 0, nextAttemptNo: 1, nextItemId: 92, correctableLogId: null };
    else { writes++; throw new Error('Unexpected write'); }
    return { config, status: 200, statusText: 'OK', headers: {}, data: { code: 'OK', message: '成功', data } };
  };
  const current = useDailySession(30);
  await current.open(task.batchId);
  assert.equal(current.item.value.itemId, 92);
  assert.equal(current.progress.value.completedCount, 0);
  assert.equal(current.progress.value.skippedCount, 1);
  assert.equal(writes, 0);
  assert.match(current.notice.value, /跳过的词不计为完成/);
  http.defaults.adapter = fixture;
});
let enhancedTask;
await check('settings use integer JSON and existing tasks keep their target snapshot', async () => {
  assert.equal((await dailyApi.settings()).dailyTarget, 20);
  for (const target of [0, 201, 1.5, '20', null]) await assert.rejects(dailyApi.saveSettings(target), e => e.code === 'INVALID_PARAMETER');
  await dailyApi.saveSettings(2);
  await dailyApi.join(1, [1001, 1002, 1003]);
  enhancedTask = await dailyApi.start();
  assert.equal(enhancedTask.dailyTarget, 2);
  assert.equal(enhancedTask.totalCount, 2);
  await dailyApi.saveSettings(200);
  assert.equal((await dailyApi.settings()).dailyTarget, 200);
  assert.equal((await dailyApi.today()).dailyTarget, 2);
  assert.deepEqual(await dailyApi.start(), enhancedTask);
});
await check('plan prefix, literal characters and sort whitelist match documented query names', async () => {
  const query = { page: 1, size: 10, status: 'ACTIVE', learningStatus: 'ALL', keyword: 'abs', sortBy: 'joined_at', direction: 'ASC' };
  assert.deepEqual((await dailyApi.plan(query)).records.map(word => word.wordId), [1002, 1003]);
  assert.equal((await dailyApi.plan({ ...query, keyword: '%' })).total, 0);
  await assert.rejects(dailyApi.plan({ ...query, sortBy: 'word' }), e => e.code === 'INVALID_PARAMETER');
  assert.equal((await dailyApi.plan({ ...query, keyword: '', status: 'PAUSED', learningStatus: 'DUE' })).total, 0);
});
await check('bulk status validates atomically and paused pending items restore without extra answers', async () => {
  await assert.rejects(dailyApi.updatePlanStatus([1001, 99999], 'PAUSED'), e => e.code === 'PLAN_WORD_NOT_FOUND');
  assert.equal((await dailyApi.task(enhancedTask.batchId)).skippedCount, 0);
  const changed = await dailyApi.updatePlanStatus([1001, 1001], 'PAUSED');
  assert.equal(changed.requestedCount, 1);
  assert.equal(changed.changedCount, 1);
  let task = await dailyApi.task(enhancedTask.batchId);
  assert.equal(task.status, 'IN_PROGRESS');
  assert.equal(task.completedCount, 0);
  assert.equal(task.skippedCount, 1);
  await dailyApi.updatePlanStatus([1001], 'ACTIVE');
  task = await dailyApi.task(enhancedTask.batchId);
  assert.equal(task.nextItemId, enhancedTask.nextItemId);
  assert.equal(task.skippedCount, 0);
  assert.equal(task.answerCount, 0);
  await dailyApi.updatePlan(1001, 'REMOVED');
  await assert.rejects(dailyApi.updatePlan(1001, 'ACTIVE'), e => e.code === 'INVALID_PLAN_TRANSITION');
  assert.equal((await dailyApi.join(1, [1001])).reactivatedCount, 1);
});
await check('PLAN_WORD_UNAVAILABLE clears pending retry and fetches server next item', async () => {
  const current = useDailySession(31);
  await current.open(enhancedTask.batchId);
  assert.equal(current.item.value.wordId, 1001);
  http.defaults.adapter = async config => {
    if (config.url.endsWith('/answer')) throw new AxiosError('timeout', AxiosError.ECONNABORTED, config);
    return fixture(config);
  };
  await current.answer(1);
  const originalRequest = current.pending.value.body.requestId;
  http.defaults.adapter = fixture;
  await dailyApi.updatePlan(1001, 'PAUSED');
  await current.retry();
  assert.equal(current.pending.value, undefined);
  assert.equal(current.item.value.wordId, 1002);
  assert.equal(current.progress.value.skippedCount, 1);
  assert.equal(current.progress.value.answerCount, 0);
  assert.equal(sessionStorage.getItem('wordory.daily.pending.31'), null);
  assert.ok(originalRequest);
  assert.match(current.notice.value, /停止重试旧答案/);
  await dailyApi.updatePlan(1001, 'ACTIVE');
});
await check('task progress, daily statistics and history distinguish correction from normal answers', async () => {
  const current = useDailySession(32);
  await current.open(enhancedTask.batchId);
  await current.answer(1);
  const originalLog = current.receipt.value.logId;
  await current.correct();
  assert.equal(current.progress.value.completedCount, 0);
  assert.equal(current.progress.value.answerCount, 1);
  assert.equal(current.progress.value.unfamiliarCount, 0);
  let stats = await dailyApi.statistics(enhancedTask.learningDate);
  assert.equal(stats.unfamiliarCount, 1); // includes reinforcement, unlike task progress
  assert.equal(stats.answerCount, 1);
  const events = await dailyApi.history(1001, { page: 1, size: 10 });
  assert.equal(events.total, 2);
  assert.equal(events.records[0].eventType, 'CORRECTION');
  assert.equal(events.records[0].correctsLogId, originalLog);
  assert.equal(events.records[0].scheduleAvailable, false);
  assert.equal(events.records[1].eventType, 'ANSWER');
  const words = await dailyApi.statisticsWords({ date: enhancedTask.learningDate, page: 1, size: 10 });
  assert.equal(words.total, 1);
  assert.equal(words.records[0].lastResult, 3);
  assert.equal(words.records[0].answerCount, 1);
  await dailyApi.updatePlanStatus([1001, 1002], 'PAUSED');
  const task = await dailyApi.task(enhancedTask.batchId);
  assert.equal(task.status, 'COMPLETED');
  assert.equal(task.completedCount, 0);
  assert.equal(task.skippedCount, 2);
  assert.equal(task.nextItemId, null);
  await dailyApi.updatePlanStatus([1001, 1002], 'ACTIVE');
  assert.equal((await dailyApi.task(enhancedTask.batchId)).status, 'COMPLETED');
  stats = await dailyApi.statistics(enhancedTask.learningDate);
  assert.equal(stats.answerCount, 1);
  assert.equal(stats.hasLearningActivity, true);
  assert.equal((await dailyApi.history(999999, { page: 1, size: 10 })).total, 0);
});
await check('calendar returns full leap month without creating daily tasks and PRACTICE stays separate', async () => {
  const before = await dailyApi.tasks({ page: 1, size: 100, status: 'COMPLETED' });
  const calendar = await dailyApi.calendar('2024-02');
  assert.equal(calendar.days.length, 29);
  assert.equal(calendar.days[28].learningDate, '2024-02-29');
  assert.ok(calendar.days.every(day => !day.hasLearningActivity));
  const snapshot = await dailyApi.statistics(enhancedTask.learningDate);
  const practice = await api.create({ bookId: 1, selectionType: 'MANUAL', wordIds: [1003] });
  const progress = await api.progress(practice.batchId);
  await api.answer(practice.batchId, progress.nextItemId, 1);
  assert.deepEqual(await dailyApi.statistics(enhancedTask.learningDate), snapshot);
  assert.deepEqual(await dailyApi.tasks({ page: 1, size: 100, status: 'COMPLETED' }), before);
});
console.log(`${passed} daily integration checks passed (explicit fixture adapter, not real backend validation).`);
