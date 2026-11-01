// Explicit protocol fixtures verify frontend behavior, not a deployed backend.
import assert from 'node:assert/strict';
import { build } from 'vite';
import { effectScope } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { AxiosError } from 'axios';
const storage = new Map();
globalThis.sessionStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
globalThis.window = { location: { origin: 'http://localhost:5173' } };
await build({ configFile: false, mode: 'api', logLevel: 'error', build: { ssr: 'tests/training-entry.ts', target: 'es2022', outDir: '.qa-expansion-dist', emptyOutDir: true } });
const { http, ApiError, tokens, consolidationApi: api, dailyApi, useDailyTraining, useAudioPlayer, preparePronunciation, usePronunciation, audioPath, exportLearningData } = await import('../.qa-expansion-dist/training-entry.js');
tokens.set({ accessToken: 'fixture-bearer', refreshToken: 'fixture-refresh', user: { id: 7 } });
const clone = value => JSON.parse(JSON.stringify(value));
const pronunciation = { autoPlay: false, accent: 'UK', playbackRate: .75, repeatCount: 2 };
let task = { batchId: 95, taskType: 'PRACTICE', learningDate: null, dailyTarget: 0, status: 'IN_PROGRESS', totalCount: 1, completedCount: 0, answerCount: 0, trainingCount: 0, studyMode: 'LISTEN_DICTATION', modeVersion: 1, skippedCount: 0, unfamiliarCount: 0, newCount: 1, reviewCount: 0, nextItemId: 123 };
let eventNo = 1, revealed = false, lostAnswer = false, stale = false, completion = false, binaryCase = 'audio', heldAudio, audioError, heldSettings;
const calls = [], answered = new Map(), created = new Map();
const prompt = () => ({ itemId: 123, mode: task.studyMode, modeVersion: task.modeVersion, presentationId: `p${task.modeVersion}-${eventNo}`, attemptNo: eventNo,
  phase: task.studyMode === 'RECOGNITION' ? revealed ? 'AWAITING_SELF_ASSESSMENT' : 'QUESTION' : 'AWAITING_INPUT', answerRevealed: revealed, hintUsed: revealed,
  itemStatus: completion ? 'DONE' : 'PENDING', completionReason: completion ? 'ASSISTED' : null, extraTraining: completion,
  ...(revealed || task.studyMode === 'FOLLOW_TYPING' ? { word: 'apple', wordId: 88, translation: '苹果', phonetic: '/apple/' } : {}),
  audioUrl: `/api/learning-batches/95/training/items/123/audio?presentationId=p${task.modeVersion}-${eventNo}&modeVersion=${task.modeVersion}&accent=UK`, pronunciation, progress: clone(task) });
const ok = (config, data) => ({ config, status: 200, headers: {}, data: { code: 'OK', data: clone(data) } });
function fail(config, code, status = 409) { throw new AxiosError(code, 'ERR_BAD_RESPONSE', config, null, { config, status, headers: {}, data: new Blob([JSON.stringify({ code, message: code })], { type: 'application/json' }) }); }
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  calls.push({ url: config.url, method: config.method, body: clone(body ?? null), params: config.params, auth: config.headers.get('Authorization') });
  if (config.url === '/learning/settings') { if (heldSettings) await heldSettings; return ok(config, { dailyTarget: 30, newWordTarget: 10, reviewLimit: 20, pronunciation }); }
  if (config.url === '/learning/settings/allocation') return ok(config, { dailyTarget: body.newWordTarget + body.reviewLimit, ...body, pronunciation });
  if (config.url === '/learning/settings/pronunciation') return ok(config, { dailyTarget: 30, newWordTarget: 10, reviewLimit: 20, pronunciation: body });
  if (config.url === '/learning/consolidation/issues') return ok(config, { page: config.params.page, size: 20, total: 1, records: [{ wordId: 88, word: 'apple', reason: config.params.reason || 'SPELLING_ERROR', lastInput: 'aple' }] });
  if (config.url === '/learning/consolidation/summary') return ok(config, [{ category: 'ERROR', reason: 'SPELLING_ERROR', wordCount: 1 }]);
  if (config.url === '/learning/consolidation/batches' && config.method === 'post') {
    assert.equal('count' in body && 'wordIds' in body, false);
    if (!created.has(body.requestId)) created.set(body.requestId, clone(task));
    return ok(config, created.get(body.requestId));
  }
  if (config.url === '/learning/consolidation/batches/95') return ok(config, task);
  if (config.url.endsWith('/95/mode')) { task.studyMode = body.mode; task.modeVersion++; return ok(config, task); }
  if (config.url.endsWith('/95/next')) return ok(config, prompt());
  if (config.url.endsWith('/items/123/answer')) {
    if (stale) { stale = false; eventNo++; return fail(config, 'STALE_TRAINING_ANSWER'); }
    if (!answered.has(body.requestId)) {
      task.trainingCount++; revealed = body.action === 'REVEAL';
      if (body.action === 'ANSWER') { completion = true; task.completedCount = 1; task.status = 'COMPLETED'; task.answerCount++; }
      const receipt = { ...prompt(), trainingId: task.trainingCount, wordId: 88, word: 'apple', input: body.input ?? null, selfAssessment: null, action: body.action, verdict: revealed ? 'REVEALED' : 'CORRECT', reviewLogId: null, affectsSchedule: false, progress: clone(task) };
      answered.set(body.requestId, receipt); eventNo++;
    }
    if (lostAnswer) { lostAnswer = false; throw new Error('lost response'); }
    return ok(config, answered.get(body.requestId));
  }
  if (config.url.includes('/audio?')) {
    if (heldAudio) await heldAudio;
    if (audioError) return fail(config, audioError, audioError === 'AUDIO_UNAVAILABLE' ? 503 : 409);
    return { config, status: 200, headers: { 'content-type': 'audio/mpeg' }, data: new Blob(['fixture mp3'], { type: 'audio/mpeg' }) };
  }
  if (config.url === '/me/learning-data/export') {
    if (binaryCase === 'auth') return fail(config, 'FORBIDDEN', 403);
    if (binaryCase === 'json') return { config, status: 200, headers: { 'content-type': 'application/json' }, data: new Blob([JSON.stringify({ code: 'EXPORT_FAILED', message: 'export failed' })]) };
    // Minimum ZIP framing suffices for transport checks; no real personal data is represented.
    const bytes = new Uint8Array(binaryCase === 'truncated' ? [80, 75, 3, 4] : [80, 75, 3, 4, 80, 75, 5, 6, ...Array(18).fill(0)]);
    return { config, status: 200, headers: { 'content-type': 'application/zip', 'content-disposition': "attachment; filename*=UTF-8''%E5%AD%A6%E4%B9%A0.zip" }, data: new Blob([bytes], { type: 'application/zip' }) };
  }
  throw new Error(`Unexpected request ${config.method} ${config.url}`);
};
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
const scopes = [];
function session() { const scope = effectScope(); scopes.push(scope); return scope.run(() => useDailyTraining(7, 'CONSOLIDATION')); }
await check('consolidation restores across dates without touching DAILY, settings or schedule', async () => {
  const s = session(); await s.open(95); assert.equal(s.historical.value, false); assert.equal(s.task.value.dailyTarget, 0); assert.equal(s.question.value.word, undefined); assert.equal(s.question.value.translation, undefined);
  assert.ok(calls.every(c => c.url.startsWith('/learning/consolidation/')));
  await s.start(); assert.equal(calls.some(c => c.url.includes('/today')), false);
});
await check('listen reveal refresh restores assisted input without another REVEAL', async () => {
  const s = session(); await s.open(95); await s.action('REVEAL'); assert.equal(s.question.value.word, 'apple'); assert.equal(s.question.value.attemptNo, 2);
  const restored = session(); const before = calls.length; await restored.open(95); await restored.open(95);
  assert.equal(restored.question.value.answerRevealed, true); assert.ok(calls.slice(before).every(c => !c.url.endsWith('/answer')));
});
await check('lost answer locks and retries exact identity, completion stays within PRACTICE', async () => {
  const s = session(); await s.open(95); s.input.value = 'apple'; lostAnswer = true; await s.action('ANSWER'); assert.ok(s.pending.value);
  const body = clone(s.pending.value.body); const restored = session(); await restored.open(95); await restored.retry();
  assert.deepEqual(calls.filter(c => c.url.endsWith('/answer')).at(-1).body, body); assert.equal(restored.task.value.completedCount, 1); assert.equal(restored.canCorrect.value, false);
  assert.equal(calls.some(c => c.url.includes('/daily') || c.url.includes('/today')), false);
});
await check('extra training sends itemId, preserves completion count and changes modes only in practice', async () => {
  const s = session(); await s.open(95); await s.extra(123); await s.changeMode('DICTATION'); assert.equal(s.question.value.itemId, 123);
  assert.equal(calls.filter(c => c.url.endsWith('/next')).at(-1).body.itemId, 123); assert.equal(s.task.value.completedCount, 1);
  stale = true; s.input.value = 'apple'; await s.action('ANSWER'); assert.equal(s.pending.value, undefined); assert.ok(s.question.value); assert.equal(s.showingFeedback.value, false);
});
await check('filters/pagination and create idempotency keep count and wordIds exclusive', async () => {
  const result = await api.issues({ page: 2, size: 20, category: 'ERROR', reason: 'SPELLING_ERROR' }); assert.equal(result.page, 2); assert.equal(result.records[0].lastInput, 'aple');
  const beforeInvalid = calls.length;
  assert.throws(() => api.issues({ page: 1, size: 20, category: 'VERIFICATION' }), /筛选已停用/);
  await assert.rejects(api.create({ requestId: 'retired', category: 'ERROR', reason: 'PENDING_VERIFICATION', mode: 'FOLLOW_TYPING', count: 1 }), /筛选已停用/);
  assert.equal(calls.length, beforeInvalid);
  const body = { requestId: 'stable', category: 'ERROR', mode: 'DICTATION', wordIds: [88] };
  await api.create(body); await api.create(body); assert.equal(created.size, 1);
  await api.create({ requestId: 'count', category: 'ERROR', reason: 'SPELLING_ERROR', mode: 'LISTEN_DICTATION', count: 10 }); assert.equal(created.size, 2);
});
await check('allocation and pronunciation use dedicated PUT endpoints and saved responses', async () => {
  const settings = await dailyApi.allocation(10, 20); assert.equal(settings.dailyTarget, 30); assert.equal(settings.newWordTarget, 10);
  const saved = await dailyApi.pronunciation(pronunciation); assert.deepEqual(saved.pronunciation, pronunciation);
  assert.equal(calls.some(c => c.method === 'put' && c.url === '/learning/settings'), false);
});
await check('a delayed settings GET cannot overwrite a newer saved pronunciation', async () => {
  setActivePinia(createPinia()); const store = usePronunciation(); let release;
  heldSettings = new Promise(resolve => { release = resolve; });
  const reading = store.load(); await new Promise(resolve => setTimeout(resolve, 0));
  const newer = { autoPlay: true, accent: 'US', playbackRate: 1.25, repeatCount: 3 };
  await store.save(newer); release(); await reading; assert.deepEqual(store.value, newer); heldSettings = undefined;
});
const audios = [], revoked = [], objectUrls = [];
let nextReadyState = 4;
globalThis.Audio = class extends EventTarget {
  constructor(src) { super(); this.src = src; this.plays = 0; this.currentTime = 0; this.readyState = nextReadyState; audios.push(this); }
  async play() { this.plays++; if (this.reject) throw new Error('autoplay'); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() {}
};
URL.createObjectURL = () => { const url = `blob:fixture-${objectUrls.length}`; objectUrls.push(url); return url; };
URL.revokeObjectURL = value => revoked.push(value);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
await check('pronunciation has a 300ms silent lead-in at the selected playback rate', async () => {
  const original = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = class {
    async decodeAudioData() { return { numberOfChannels: 2, sampleRate: 1000, duration: .002, length: 2, getChannelData: channel => channel ? new Float32Array([-.5, .25]) : new Float32Array([.5, -.25]) }; }
  };
  try {
    const output = await preparePronunciation(new Blob(['fixture']), 1.5);
    const view = new DataView(await output.arrayBuffer()), lead = 450;
    assert.equal(output.type, 'audio/wav'); assert.equal(view.getUint16(22, true), 2);
    assert.equal(view.getInt16(44 + (lead - 1) * 4, true), 0);
    assert.equal(view.getInt16(44 + lead * 4, true), 16383);
    assert.equal(view.getInt16(44 + lead * 4 + 2, true), -16384);
    assert.equal(view.getInt16(44 + (lead + 1) * 4, true), -8192);
  } finally {
    if (original === undefined) delete globalThis.OfflineAudioContext; else globalThis.OfflineAudioContext = original;
  }
});
await check('first playback waits for decoding and a stopped load never starts', async () => {
  const scope = effectScope(), player = scope.run(() => useAudioPlayer());
  nextReadyState = 0;
  const first = player.play(prompt().audioUrl, pronunciation); await tick();
  const audio = audios.at(-1); assert.equal(player.loading.value, true); assert.equal(audio.plays, 0);
  audio.readyState = 4; audio.dispatchEvent(new Event('canplaythrough')); await first;
  assert.equal(audio.plays, 1); assert.equal(player.loading.value, false);
  const second = player.play(prompt().audioUrl, pronunciation); await tick();
  const stopped = audios.at(-1); assert.equal(stopped.plays, 0); player.stop(); await second;
  stopped.readyState = 4; stopped.dispatchEvent(new Event('canplaythrough')); assert.equal(stopped.plays, 0);
  nextReadyState = 4; scope.stop();
});
await check('stopping during pronunciation decoding does not play the previous word', async () => {
  let release;
  const original = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = class {
    decodeAudioData() { return new Promise(resolve => { release = resolve; }); }
  };
  const scope = effectScope(), player = scope.run(() => useAudioPlayer()), before = audios.length;
  try {
    const pending = player.play(prompt().audioUrl, pronunciation);
    while (!release) await tick();
    player.stop();
    release({ numberOfChannels: 1, sampleRate: 1000, duration: .001, length: 1, getChannelData: () => new Float32Array([.5]) });
    await pending; assert.equal(audios.length, before); assert.equal(player.loading.value, false);
  } finally {
    scope.stop();
    if (original === undefined) delete globalThis.OfflineAudioContext; else globalThis.OfflineAudioContext = original;
  }
});
await check('audio is Bearer Blob only, applies accent/rate and sequential repeats then releases URL', async () => {
  const scope = effectScope(), player = scope.run(() => useAudioPlayer()), revokedBefore = revoked.length;
  await player.play(prompt().audioUrl, pronunciation); const audio = audios.at(-1);
  assert.equal(audio.playbackRate, .75); assert.equal(audio.plays, 1); assert.match(audio.src, /^blob:/);
  audio.onended(); await tick(); assert.equal(audio.plays, 2); audio.onended(); assert.equal(player.speaking.value, false); assert.equal(revoked.length, revokedBefore + 1);
  assert.match(calls.at(-1).url, /accent=UK/); assert.equal(calls.at(-1).auth, 'Bearer fixture-bearer'); scope.stop();
});
await check('stopping during Blob load prevents stale playback and revoke occurs on scope disposal', async () => {
  let release; heldAudio = new Promise(resolve => { release = resolve; });
  const scope = effectScope(), player = scope.run(() => useAudioPlayer()); const before = audios.length;
  const pending = player.play(prompt().audioUrl, pronunciation); await tick(); player.stop(); release(); await pending; assert.equal(audios.length, before);
  heldAudio = undefined; await player.play(prompt().audioUrl, pronunciation); scope.stop(); assert.ok(audios.at(-1).paused); assert.equal(objectUrls.length, revoked.length);
});
await check('audio source validation rejects foreign origin and token query before sending Bearer', async () => {
  const before = calls.length;
  for (const source of ['https://example.com/api/words/88/audio', '/api/words/88/audio?token=secret', '/api/me']) assert.throws(() => audioPath(source, 'US'), ApiError);
  assert.equal(calls.length, before); assert.match(audioPath('/api/words/88/audio', 'US'), /accent=US/);
});
await check('audio source failures expose retry; stale audio triggers presentation recovery once', async () => {
  const scope = effectScope(); let recovered = 0; const player = scope.run(() => useAudioPlayer(() => recovered++));
  audioError = 'AUDIO_UNAVAILABLE'; await player.play(prompt().audioUrl, pronunciation); assert.match(player.error.value, /切换学习方式/); assert.equal(recovered, 0);
  audioError = 'STALE_TRAINING_ANSWER'; await player.play(prompt().audioUrl, pronunciation); assert.equal(recovered, 1); audioError = undefined;
  await player.play(prompt().audioUrl, pronunciation); audios.at(-1).reject = true; audios.at(-1).onended(); await tick(); assert.match(player.error.value, /点击播放/); scope.stop();
});
await check('ZIP honors disposition; JSON errors, auth failures and truncated HTTP 200 never succeed', async () => {
  binaryCase = 'zip'; const file = await exportLearningData(); assert.equal(file.filename, '学习.zip');
  for (const kind of ['json', 'auth', 'truncated']) { binaryCase = kind; await assert.rejects(exportLearningData()); }
  assert.equal(calls.at(-1).auth, 'Bearer fixture-bearer');
});
scopes.forEach(s => s.stop());
console.log(`${checks} expansion protocol scenarios passed (fixtures, not live integration).`);
