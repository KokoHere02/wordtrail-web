// Real HTTP only. This read-only audit does not start tasks, reveal answers or submit training.
import assert from 'node:assert/strict';
import { build } from 'vite';

const username = process.env.WORDTRAIL_LIVE_USERNAME;
const password = process.env.WORDTRAIL_LIVE_PASSWORD;
if (!username || !password) {
  console.error('NOT RUN: set WORDTRAIL_LIVE_USERNAME and WORDTRAIL_LIVE_PASSWORD for a dedicated test account. No fixture or default account is used.');
  process.exit(2);
}
process.env.VITE_ENABLE_MOCK = 'false';
process.env.VITE_API_BASE_URL = process.env.WORDTRAIL_API_BASE_URL || 'http://localhost:8080/api';
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await build({ configFile: false, mode: 'api', logLevel: 'error', build: { ssr: 'tests/training-entry.ts', target: 'es2022', outDir: '.qa-daily-live-dist', emptyOutDir: true } });
const { request, tokens, dailyApi, dailyTrainingApi, consolidationApi, followTypingApi } = await import('../.qa-daily-live-dist/training-entry.js');
let pair;
try {
  pair = await request('POST', '/auth/login', { username, password });
  tokens.set(pair);
  const [followStats, followBatches] = await Promise.all([followTypingApi.statistics(), followTypingApi.batches({ page: 1, size: 20, status: 'IN_PROGRESS' })]);
  for (const key of ['answerCount', 'correctCount', 'practicedWordCount', 'completedWordCount']) assert.equal(typeof followStats[key], 'number', `013 follow statistics.${key} required`);
  for (const row of followBatches.records) { assert.equal(row.studyMode, 'FOLLOW_TYPING'); assert.equal(row.taskType, 'PRACTICE'); assert.equal(row.learningDate, null); assert.equal(row.dailyTarget, 0); assert.equal(typeof row.followTypingTarget, 'number'); }
  console.log('PASS real HTTP: section 36 read-only independent follow batches and date statistics; no follow round created or answered.');
  const [settings, issues, counts, practice] = await Promise.all([
    dailyApi.settings(), consolidationApi.issues({ page: 1, size: 20, category: 'ERROR' }),
    consolidationApi.summary(), consolidationApi.batches({ page: 1, size: 20, status: 'IN_PROGRESS' }),
  ]);
  assert.ok('newWordTarget' in settings && 'reviewLimit' in settings, '012 allocation settings required');
  for (const key of ['autoPlay', 'accent', 'playbackRate', 'repeatCount']) assert.ok(key in settings.pronunciation, `012 pronunciation.${key} required`);
  assert.deepEqual(counts.map(row => row.reason).sort(), ['SPELLING_ERROR', 'ANSWER_REVEALED', 'UNRECOGNIZED', 'ATTEMPT_LIMIT'].sort());
  for (const row of issues.records) assert.equal(row.category, 'ERROR');
  for (const row of practice.records) { assert.equal(row.taskType, 'PRACTICE'); assert.equal(row.dailyTarget, 0); assert.equal(row.learningDate, null); }
  const zip = await fetch(`${process.env.VITE_API_BASE_URL}/me/learning-data/export`, { headers: { Authorization: `Bearer ${tokens.access()}` } });
  assert.equal(zip.status, 200); assert.match(zip.headers.get('content-type') || '', /application\/zip/);
  assert.match(zip.headers.get('content-disposition') || '', /filename/i);
  const zipBytes = new Uint8Array(await zip.arrayBuffer()); assert.deepEqual([...zipBytes.slice(0, 4)], [80, 75, 3, 4]);
  console.log('PASS real HTTP: section 31–34 read-only settings, issue categories, practice isolation and authenticated ZIP transport. No personal content is logged.');
  const [summary, trends, daily, calendar, today] = await Promise.all([
    request('GET', '/learning/statistics/summary', undefined, { source: 'DAILY' }),
    request('GET', '/learning/statistics/trends', undefined, { source: 'DAILY', days: 7 }),
    dailyApi.statistics(), dailyApi.calendar(), dailyApi.today(),
  ]);
  for (const key of ['todayTrainingCount', 'todayAnswerCount', 'todayStudiedCount', 'todayCompletedCount', 'todayRecalledCount']) assert.equal(typeof summary[key], 'number', `new backend required: summary.${key}`);
  for (const key of ['reviewBacklogCount', 'overdueReviewCount']) assert.equal(typeof today[key], 'number', `012 today.${key} required`);
  assert.equal(typeof today.needsMoreWords, 'boolean', 'sections 5.2/32 latest backend required: today.needsMoreWords; restart the new build first');
  assert.equal(today.needsMoreWords && today.canAddMore, false);
  if (today.task?.status === 'IN_PROGRESS') { assert.equal(today.needsMoreWords, false); assert.equal(today.canAddMore, false); }
  for (const key of ['trainingCount', 'answerCount', 'studiedCount', 'completedCount', 'recalledCount']) assert.equal(typeof daily[key], 'number', `new backend required: daily.${key}`);
  for (const key of ['totalTrainingCount', 'totalRecalledCount']) assert.equal(typeof trends[key], 'number', `new backend required: trends.${key}`);
  for (const day of [...calendar.days, ...trends.records]) {
    assert.equal(typeof day.trainingCount, 'number'); assert.equal(typeof day.recalledCount, 'number'); assert.equal(typeof day.hasLearningActivity, 'boolean');
  }
  const batchId = Number(process.env.WORDTRAIL_LIVE_BATCH_ID || today.task?.batchId);
  if (batchId > 0) {
    let page = 1, total = 0;
    do {
      const items = await dailyTrainingApi.items(batchId, page, 20); total = items.total;
      assert.equal(items.page, page);
      for (const row of items.records) {
        assert.equal(typeof row.current, 'boolean'); assert.equal(typeof row.canExtraTrain, 'boolean');
        assert.equal(typeof row.trainingCount, 'number');
        if (row.itemStatus !== 'DONE') for (const key of ['wordId', 'word', 'phonetic', 'translation']) assert.equal(row[key], undefined, `hidden item ${row.itemId}.${key}`);
        if (row.canExtraTrain) assert.equal(row.itemStatus, 'DONE');
      }
      if (!items.records.length) break;
    } while (page++ * 20 < total);
    console.log(`PASS real HTTP: training/items pagination and answer masking (${total} items).`);
  } else console.log('NOT RUN: item audit requires an existing DAILY batch; no task was created.');
  console.log('PASS real HTTP: section 30 statistics contract. This audit performs no next/ANSWER/REVEAL and does not replace interactive training verification.');
} catch (error) {
  console.error(`FAIL real HTTP: ${error instanceof Error ? error.message : 'request failed'}`);
  process.exitCode = 1;
} finally {
  if (pair?.refreshToken) {
    try { await request('POST', '/auth/logout', { refreshToken: pair.refreshToken }); }
    catch { console.error('Audit session logout was not confirmed.'); process.exitCode = 1; }
  }
}
