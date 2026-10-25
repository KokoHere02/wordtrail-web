// Contract fixtures test frontend behavior only; they are never a runtime fallback or backend verification.
import assert from 'node:assert/strict';
import { build } from 'vite';
import { AxiosError } from 'axios';
import { effectScope } from 'vue';
class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
globalThis.sessionStorage = new MemoryStorage();
await build({ configFile: false, mode: 'api', logLevel: 'warn', build: { ssr: 'tests/training-entry.ts', target: 'es2022', outDir: '.qa-daily-dist', emptyOutDir: true } });
const { dailyTrainingApi, dailyApi, http, useDailyTraining } = await import('../.qa-daily-dist/training-entry.js');
const clone = value => JSON.parse(JSON.stringify(value));
const base = () => ({ batchId: 45, learningDate: '2026-10-25', dailyTarget: 1, taskType: 'DAILY', status: 'IN_PROGRESS', totalCount: 1, completedCount: 0, skippedCount: 0, answerCount: 0, unfamiliarCount: 0, newCount: 1, reviewCount: 0, nextItemId: 123, studyMode: 'RECOGNITION', modeVersion: 0, trainingCount: 0 });
let state, presentation, number, pendingHook, nextError, nextHook, calls, records, learningDate, noTask, revealedModes, reason;
function reset(mode = 'RECOGNITION') { state = { ...base(), studyMode: mode }; presentation = undefined; number = 1; pendingHook = undefined; nextError = undefined; nextHook = undefined; calls = []; records = new Map(); learningDate = state.learningDate; noTask = false; revealedModes = new Set(); reason = null; lastExtra = false; sessionStorage.data.clear(); }
const groups = [{ partOfSpeech: 'n.', meaning: '苹果' }];
function question(extra = false) {
  presentation ??= `p-${state.modeVersion}-${number}`;
  return { itemId: 123, mode: state.studyMode, modeVersion: state.modeVersion, presentationId: presentation, attemptNo: number,
    phase: state.studyMode === 'RECOGNITION' ? revealedModes.has(state.studyMode) ? 'AWAITING_SELF_ASSESSMENT' : 'QUESTION' : 'AWAITING_INPUT',
    answerRevealed: revealedModes.has(state.studyMode), itemStatus: state.completedCount ? 'DONE' : 'PENDING', completionReason: reason,
    ...(state.studyMode !== 'DICTATION' || revealedModes.has(state.studyMode) ? { wordId: 999, word: 'apple', phonetic: '/ˈæpəl/' } : {}),
    ...(state.studyMode !== 'RECOGNITION' || revealedModes.has(state.studyMode) ? { translation: '苹果', translationGroups: groups } : {}), hintUsed: state.studyMode !== 'DICTATION' || number > 1, extraTraining: extra, progress: clone(state) };
}
function answer(body, progress = {}) {
  Object.assign(state, progress); state.trainingCount++;
  if (body.action === 'REVEAL') revealedModes.add(state.studyMode); else revealedModes.delete(state.studyMode);
  const result = { trainingId: state.trainingCount, itemId: 123, wordId: 999, mode: state.studyMode, action: body.action,
    verdict: body.action === 'REVEAL' ? 'REVEALED' : state.studyMode === 'RECOGNITION' ? 'SELF_ASSESSED' : 'CORRECT',
    input: body.input ?? null, selfAssessment: body.result ?? null, word: 'apple', translation: '苹果', translationGroups: groups,
    hintUsed: state.studyMode !== 'DICTATION' || number > 1, extraTraining: lastExtra, attemptNo: body.attemptNo,
    itemStatus: state.completedCount ? 'DONE' : 'PENDING', completionReason: reason,
    reviewLogId: body.action === 'REVEAL' || lastExtra ? null : 200, affectsSchedule: false, answeredAt: '2026-10-25T12:00:00', progress: clone(state) };
  number++; presentation = undefined; records.set(body.requestId, clone(result)); return result;
}
let lastExtra = false;
function failure(config, code, status = 409) { throw new AxiosError(code, 'ERR_BAD_RESPONSE', config, null, { status, data: { code, message: code }, headers: {}, config }); }
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  calls.push({ url: config.url, method: config.method, body: body === undefined ? undefined : clone(body), params: config.params });
  const ok = data => ({ data: { code: 'OK', message: 'ok', data: clone(data) }, status: 200, statusText: 'OK', headers: {}, config });
  if (config.url === '/learning/today') return ok({ learningDate, dailyTarget: 1, activeCount: 1, dueCount: 0, newCount: 1, unassignedCount: 0, canAddMore: state.status === 'COMPLETED', task: noTask ? null : state });
  if (config.url === '/learning/settings') return ok({ dailyTarget: 1, preferredStudyMode: 'FOLLOW_TYPING' });
  if (config.url === '/learning/today/start') { noTask = false; return ok(state); }
  if (config.url === '/learning-batches/45/daily') return ok(state);
  if (config.url.endsWith('/daily/mode')) {
    if (body.expectedVersion !== state.modeVersion) return failure(config, 'STALE_STUDY_MODE');
    if (state.studyMode !== body.mode) { state.studyMode = body.mode; state.modeVersion++; presentation = undefined; }
    return ok(state);
  }
  if (config.url.endsWith('/training/next')) {
    if (nextHook) await nextHook(config);
    if (nextError) return failure(config, nextError);
    lastExtra = body?.itemId === 123; return ok(question(lastExtra));
  }
  if (config.url.endsWith('/training-answer')) {
    if (pendingHook) return pendingHook(config, body, ok);
    if (records.has(body.requestId)) return ok({ ...records.get(body.requestId), progress: state });
    return ok(answer(body));
  }
  if (config.url.endsWith('/correction')) { revealedModes.clear(); return ok({ logId: 201, itemId: 123, result: body.result, translation: '苹果', answeredAt: '2026-10-25T12:01:00', correction: true, progress: state }); }
  if (config.url.endsWith('/training/attempts')) return ok({ page: 1, size: 20, total: records.size, records: [...records.values()] });
  if (config.url === '/learning/statistics/training') return ok({ learningDate, completedWordCount: state.completedCount, modes: [] });
  throw new Error(`Unexpected endpoint ${config.method} ${config.url}`);
};
let count = 0;
async function check(name, run) { reset(); await run(); count++; console.log(`PASS ${name}`); }
function session() { const scope = effectScope(); const value = scope.run(() => useDailyTraining(7)); return { scope, s: value }; }
const writes = () => calls.filter(c => c.url.endsWith('/training-answer'));

await check('reading/restoring does not start/append or use legacy/dictation APIs', async () => {
  const { s } = session(); await s.open(); assert.equal(s.question.value.itemId, 123);
  assert.ok(calls.every(c => c.method === 'get' || c.url.endsWith('/training/next')));
  assert.equal(s.question.value.translation, undefined); assert.equal(s.canRate.value, true, 'a fresh recognition question accepts direct self assessment');
  assert.equal(writes().length, 0, 'opening alone never reveals or answers');
});
await check('no task reads saved preference; explicit start alone creates shared task and applies chosen mode', async () => {
  noTask = true; const { s } = session(); await s.open(); assert.equal(s.mode.value, 'FOLLOW_TYPING');
  assert.equal(s.task.value, undefined); assert.ok(calls.every(c => c.method === 'get'));
  await s.changeMode('DICTATION'); assert.ok(!calls.some(c => c.url.endsWith('/mode')));
  await s.start(); assert.equal(s.mode.value, 'DICTATION'); assert.equal(s.question.value.word, undefined);
  assert.equal(calls.filter(c => c.url === '/learning/today/start').length, 1);
  assert.ok(!calls.some(c => c.url.startsWith('/dictation')));
});
await check('recognition REVEAL retains meanings and obtains a fresh presentation before self-rating', async () => {
  const { s } = session(); await s.open(); const old = s.question.value.presentationId;
  await s.action('REVEAL'); assert.equal(s.definition.value.translation, '苹果'); assert.equal(s.canRate.value, true);
  assert.notEqual(s.question.value.presentationId, old); assert.equal(s.question.value.attemptNo, 2);
  assert.deepEqual(Object.keys(writes()[0].body).sort(), ['action', 'attemptNo', 'modeVersion', 'presentationId', 'requestId'].sort());
  pendingHook = (_c, b, ok) => ok(answer(b, { status: 'COMPLETED', completedCount: 1, answerCount: 1, nextItemId: null }));
  await s.action('ANSWER', 1); assert.equal(writes()[1].body.presentationId, s.receipt.value ? 'p-0-2' : 'never');
  assert.equal(s.task.value.completedCount, 1); assert.equal(s.task.value.trainingCount, 2); assert.equal(s.showingFeedback.value, true);
  assert.equal(s.today.value.canAddMore, true, 'completion refreshes today through GET so same-day continue becomes available');
  assert.ok(!calls.some(c => c.url.endsWith('/today/start')));
});
await check('recognition remains answerable after continuing to a fresh QUESTION without automatic REVEAL', async () => {
  const { s } = session(); await s.open();
  for (const result of [3, 2, 1]) {
    assert.equal(s.question.value.phase, 'QUESTION'); assert.equal(s.definition.value, undefined); assert.equal(s.canRate.value, true);
    const identity = s.question.value.presentationId;
    await s.action('ANSWER', result);
    assert.equal(s.showingFeedback.value, true); assert.equal(s.canRate.value, false);
    assert.equal(writes().at(-1).body.presentationId, identity);
    s.continueTraining(); assert.equal(s.canRate.value, true);
  }
  assert.deepEqual(writes().map(call => call.body.result), [3, 2, 1]);
  assert.ok(writes().every(call => call.body.action === 'ANSWER'), 'self assessment does not fabricate REVEAL events');
});
await check('recognition correction uses the returned log ID and does not add a training event', async () => {
  const { s } = session(); await s.open(); await s.action('REVEAL'); await s.action('ANSWER', 1);
  const n = s.task.value.trainingCount; await s.correct(2);
  assert.equal(s.receipt.value, undefined); assert.equal(s.showingFeedback.value, false); assert.equal(s.question.value.phase, 'QUESTION'); assert.equal(s.task.value.trainingCount, n);
  assert.equal(calls.find(c => c.url.endsWith('/correction')).body.logId, 200);
});
await check('recognition familiar feedback does not end reinforcement or deduplicate a reappearing item', async () => {
  const { s } = session(); await s.open(); await s.action('REVEAL'); await s.action('ANSWER', 3);
  assert.equal(s.task.value.completedCount, 0); s.continueTraining();
  assert.equal(s.question.value.itemId, 123); await s.action('REVEAL'); await s.action('ANSWER', 1);
  assert.equal(s.task.value.completedCount, 0); assert.equal(s.task.value.status, 'IN_PROGRESS');
  s.continueTraining(); assert.equal(s.question.value.itemId, 123); assert.equal(s.question.value.attemptNo, 5);
});
await check('mid-task modes share batch, item, position and server counters; dictation never exposes spelling', async () => {
  const { s } = session(); await s.open(); await s.changeMode('DICTATION'); s.input.value = 'app';
  assert.equal(s.task.value.batchId, 45); assert.equal(s.question.value.itemId, 123); assert.equal(s.question.value.word, undefined);
  assert.deepEqual(calls.find(c => c.url.endsWith('/mode')).body, { mode: 'DICTATION', expectedVersion: 0 });
  await s.changeMode('FOLLOW_TYPING'); assert.equal(s.question.value.word, 'apple'); assert.equal(s.question.value.modeVersion, 2);
  await s.changeMode('DICTATION'); assert.equal(s.input.value, 'app'); assert.equal(s.task.value.completedCount, 0);
  assert.ok(!calls.some(c => c.url.includes('/dictation/') || /\/items\/\d+$/.test(c.url)));
});
await check('follow typing wrong is a training event only; correct completion uses server progress', async () => {
  state.studyMode = 'FOLLOW_TYPING'; const { s } = session(); await s.open(); s.input.value = 'aple';
  pendingHook = (_c, b, ok) => { const result = answer(b); result.verdict = 'INCORRECT'; return ok(result); };
  await s.action('ANSWER'); assert.equal(s.task.value.completedCount, 0); assert.equal(s.task.value.answerCount, 0);
  s.continueTraining(); s.input.value = ' apple ';
  pendingHook = (_c, b, ok) => ok(answer(b, { completedCount: 1, status: 'COMPLETED', nextItemId: null, answerCount: 1 }));
  await s.action('ANSWER'); assert.equal(writes()[1].body.input, ' apple '); assert.equal('result' in writes()[1].body, false);
  assert.equal(s.task.value.completedCount, 1); assert.equal(s.receipt.value.mode, 'FOLLOW_TYPING');
});
await check('follow typing training events are not capped by the six effective-feedback limit', async () => {
  state.studyMode = 'FOLLOW_TYPING'; const { s } = session(); await s.open();
  pendingHook = (_c, b, ok) => { const result = answer(b); result.verdict = 'INCORRECT'; return ok(result); };
  for (let index = 0; index < 8; index++) { s.input.value = 'wrong'; await s.action('ANSWER'); s.continueTraining(); }
  assert.equal(s.task.value.completedCount, 0); assert.equal(s.task.value.answerCount, 0);
  assert.equal(s.question.value.attemptNo, 9); assert.equal(s.task.value.trainingCount, 8);
});
await check('completed follow word can switch and append dictation without double-completing goal', async () => {
  state.studyMode = 'FOLLOW_TYPING'; Object.assign(state, { completedCount: 1, status: 'COMPLETED', nextItemId: null, trainingCount: 1 });
  const { s } = session(); await s.open(); await s.extra(123); await s.changeMode('DICTATION');
  assert.equal(s.question.value.extraTraining, true); assert.equal(s.question.value.word, undefined);
  s.input.value = 'apple'; await s.action('ANSWER'); assert.equal(s.receipt.value.extraTraining, true);
  assert.equal(s.task.value.completedCount, 1); assert.equal(s.task.value.trainingCount, 2);
  assert.deepEqual(calls.filter(c => c.url.endsWith('/next')).at(-1).body, { itemId: 123 });
});
await check('new dictation REVEAL does not complete the word; continued hinted input uses new identity', async () => {
  state.studyMode = 'DICTATION'; const { s } = session(); await s.open(); await s.action('REVEAL');
  assert.equal(s.task.value.completedCount, 0); assert.equal(s.receipt.value.word, 'apple'); assert.equal(s.question.value.word, 'apple');
  assert.equal(s.question.value.answerRevealed, true); assert.equal(s.showingFeedback.value, false);
  s.continueTraining(); assert.equal(s.receipt.value, undefined); s.input.value = 'apple';
  pendingHook = (_c, b, ok) => ok(answer(b, { completedCount: 1, status: 'COMPLETED', nextItemId: null }));
  await s.action('ANSWER'); assert.equal(s.receipt.value.hintUsed, true); assert.equal(writes()[1].body.attemptNo, 2);
});
await check('unknown answer response blocks double clicks and mode change; refresh retries exact original bytes/key', async () => {
  state.studyMode = 'DICTATION'; const first = session(); await first.s.open(); first.s.input.value = ' Apple ';
  let release; pendingHook = (c, b) => new Promise((_, reject) => { release = () => { answer(b); reject(new AxiosError('lost response', 'ERR_NETWORK', c)); }; });
  const saving = first.s.action('ANSWER'); await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 10));
  await first.s.action('ANSWER'); await first.s.changeMode('FOLLOW_TYPING'); assert.equal(writes().length, 1);
  release(); await saving; const sent = clone(writes()[0].body); assert.ok(first.s.pending.value); first.scope.stop();
  const restored = session(); pendingHook = undefined; await restored.s.open(); assert.ok(restored.s.pending.value);
  assert.equal(restored.s.question.value, undefined); await restored.s.retry(); assert.deepEqual(writes()[1].body, sent);
  assert.equal(restored.s.task.value.trainingCount, 1); assert.equal(restored.s.pending.value, undefined);
});
await check('a failed next after confirmed save never repeats the successful answer', async () => {
  state.studyMode = 'DICTATION'; const { s } = session(); await s.open(); s.input.value = 'apple';
  nextHook = c => { throw new AxiosError('read timeout', 'ERR_NETWORK', c); };
  await s.action('ANSWER'); assert.equal(s.pending.value, undefined); assert.ok(s.receipt.value); assert.ok(s.error.value);
  nextHook = undefined; await s.open(); assert.equal(writes().length, 1);
});
await check('stale answer refreshes task and presentation without replaying old content', async () => {
  state.studyMode = 'DICTATION'; const { s } = session(); await s.open(); s.input.value = 'apple';
  pendingHook = c => { state.studyMode = 'FOLLOW_TYPING'; state.modeVersion++; presentation = undefined; return failure(c, 'STALE_TRAINING_ANSWER'); };
  await s.action('ANSWER'); assert.equal(s.mode.value, 'FOLLOW_TYPING'); assert.equal(s.pending.value, undefined);
  assert.equal(writes().length, 1); assert.match(s.notice.value, /旧提交/);
});
await check('stale mode version resolves server mode without automatically resending mode write', async () => {
  const { s } = session(); await s.open(); state.modeVersion = 3; state.studyMode = 'DICTATION';
  await s.changeMode('FOLLOW_TYPING'); assert.equal(s.mode.value, 'DICTATION'); assert.equal(s.task.value.modeVersion, 3);
  assert.equal(calls.filter(c => c.url.endsWith('/mode')).length, 1);
});
await check('request-key conflict stops replay and does not generate an automatic replacement answer', async () => {
  state.studyMode = 'DICTATION'; const { s } = session(); await s.open(); s.input.value = 'apple';
  pendingHook = c => failure(c, 'REQUEST_ID_REUSED'); await s.action('ANSWER'); await s.retry();
  assert.equal(writes().length, 1); assert.equal(s.pending.value, undefined); assert.match(s.error.value, /REQUEST_ID_REUSED/);
});
await check('cross-day submit expires and never auto-starts another daily task', async () => {
  const { s } = session(); await s.open(); pendingHook = c => failure(c, 'DAILY_TASK_EXPIRED'); await s.action('REVEAL');
  assert.equal(s.expired.value, true); assert.equal(s.pending.value, undefined); assert.equal(s.question.value, undefined);
  assert.ok(!calls.some(c => c.url.endsWith('/start')));
});
await check('paused/removed plan invalidates old input then uses refreshed queue/skipped progress', async () => {
  state.studyMode = 'DICTATION'; const { s } = session(); await s.open(); s.input.value = 'apple';
  pendingHook = c => { Object.assign(state, { skippedCount: 1, nextItemId: null, status: 'COMPLETED' }); return failure(c, 'PLAN_WORD_UNAVAILABLE'); };
  await s.action('ANSWER'); assert.equal(s.task.value.skippedCount, 1); assert.equal(s.task.value.completedCount, 0);
  assert.equal(s.question.value, undefined); assert.equal(s.pending.value, undefined);
});
await check('missing Chinese prompt allows switching the same word instead of drawing another', async () => {
  state.studyMode = 'DICTATION'; nextError = 'TRAINING_PROMPT_UNAVAILABLE'; const { s } = session(); await s.open();
  assert.equal(s.promptUnavailable.value, true); assert.equal(s.question.value, undefined);
  nextError = undefined; await s.changeMode('FOLLOW_TYPING'); assert.equal(s.question.value.itemId, 123); assert.equal(s.task.value.batchId, 45);
});
await check('historical task is read-only and does not POST a presentation', async () => {
  learningDate = '2026-10-26'; const { s } = session(); await s.open(45);
  assert.equal(s.historical.value, true); assert.ok(!calls.some(c => c.method !== 'get'));
});
await check('late responses from disposed pages cannot overwrite new sessions', async () => {
  let release; nextHook = () => new Promise(resolve => { release = resolve; }); const old = session(); const loading = old.s.open();
  await new Promise(resolve => setTimeout(resolve, 10)); old.scope.stop(); nextHook = undefined;
  state.studyMode = 'DICTATION'; const current = session(); await current.s.open(); release(); await loading;
  assert.equal(current.s.mode.value, 'DICTATION'); assert.equal(current.s.question.value.word, undefined); assert.equal(old.s.question.value, undefined);
});
await check('missing 011 task fields show deployment prerequisite rather than legacy or mock fallback', async () => {
  delete state.modeVersion; const { s } = session(); await s.open(); assert.match(s.error.value, /011/); assert.equal(s.question.value, undefined);
});
await check('recognition reveal restores across new scopes, repeated next and mode changes without extra REVEAL', async () => {
  const first = session(); await first.s.open();
  assert.equal(first.s.question.value.hintUsed, true); assert.equal(first.s.question.value.answerRevealed, false); assert.equal(first.s.canRate.value, true);
  await first.s.action('REVEAL'); const identity = first.s.question.value.presentationId; first.scope.stop();
  const restored = session(); await restored.s.open();
  assert.equal(restored.s.question.value.phase, 'AWAITING_SELF_ASSESSMENT'); assert.equal(restored.s.canRate.value, true);
  await restored.s.open(); assert.equal(restored.s.question.value.presentationId, identity);
  await restored.s.action('REVEAL'); assert.equal(writes().length, 1); assert.equal(restored.s.task.value.trainingCount, 1);
  await restored.s.changeMode('DICTATION'); await restored.s.changeMode('RECOGNITION');
  assert.equal(restored.s.canRate.value, true); assert.equal(writes().length, 1);
});
await check('dictation reveal restores visible assisted input without revealing again', async () => {
  state.studyMode = 'DICTATION'; const first = session(); await first.s.open(); await first.s.action('REVEAL'); first.scope.stop();
  const restored = session(); await restored.s.open();
  assert.equal(restored.s.question.value.phase, 'AWAITING_INPUT'); assert.equal(restored.s.question.value.word, 'apple');
  assert.equal(restored.s.question.value.answerRevealed, true); assert.equal(restored.s.question.value.hintUsed, true);
  await restored.s.action('REVEAL'); assert.equal(writes().length, 1); assert.equal(restored.s.task.value.completedCount, 0);
});
await check('ANSWER_ALREADY_REVEALED refreshes presentation once and continues self assessment', async () => {
  const { s } = session(); await s.open();
  pendingHook = c => { revealedModes.add('RECOGNITION'); return failure(c, 'ANSWER_ALREADY_REVEALED'); };
  await s.action('REVEAL'); assert.equal(writes().length, 1); assert.equal(s.canRate.value, true); assert.equal(s.pending.value, undefined);
  await s.action('REVEAL'); assert.equal(writes().length, 1);
  pendingHook = undefined; await s.action('ANSWER', 2); assert.equal(writes().length, 2); assert.equal(writes()[1].body.action, 'ANSWER');
});
await check('pre-30 question response stops with a restart diagnostic rather than inferring phase', async () => {
  const original = http.defaults.adapter;
  http.defaults.adapter = async config => { const response = await original(config); if (config.url.endsWith('/next')) delete response.data.data.phase; return response; };
  try { const { s } = session(); await s.open(); assert.equal(s.question.value, undefined); assert.match(s.error.value, /重启新版后端/); assert.equal(writes().length, 0); }
  finally { http.defaults.adapter = original; }
});
await check('statistics/history use dedicated exact endpoints and settings PUT retains only dailyTarget', async () => {
  await dailyTrainingApi.statistics('2026-10-25'); await dailyTrainingApi.history(45, 2, 20); await dailyApi.saveSettings(20);
  assert.deepEqual(calls[0].params, { date: '2026-10-25' }); assert.deepEqual(calls[1].params, { page: 2, size: 20 });
  assert.deepEqual(calls[2].body, { dailyTarget: 20 });
});
console.log(`${count} unified DAILY contract scenarios passed (fixtures; not live integration).`);
