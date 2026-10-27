// Actual Vue UI + explicit section-36 service fixtures; not a deployed-backend acceptance test.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';
import { AxiosError } from 'axios';
const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent', 'KeyboardEvent']) Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window); globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', define: { 'import.meta.env.VITE_UI_PREVIEW': '"false"' }, logLevel: 'error', build: { target: 'es2022', outDir: '.qa-follow-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/sentences-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { app, router, http, tokens } = await import('../.qa-follow-dist/ui.js');
const document = window.document, calls = [], tasks = new Map(), creations = new Map(), answers = new Map(), events = [];
const fallback = http.defaults.adapter, clone = value => JSON.parse(JSON.stringify(value));
const root = '/learning/follow-typing/batches', pronunciation = { autoPlay: false, accent: 'US', playbackRate: 1, repeatCount: 1 };
let day = '2026-10-27', loseCreate = true, loseAnswer = false, emptyListOnce = false, staleOnce = false, noWords = false, paused = false;
const daily = { batchId: 50, taskType: 'DAILY', learningDate: '2026-10-27', dailyTarget: 1, status: 'IN_PROGRESS', totalCount: 1, completedCount: 0, skippedCount: 0, answerCount: 0, unfamiliarCount: 0, newCount: 1, reviewCount: 0, nextItemId: 501, studyMode: 'FOLLOW_TYPING', modeVersion: 0, trainingCount: 0 };
const initialDaily = clone(daily);
function create(body) {
  const id = 901 + tasks.size;
  const progress = { ...daily, batchId: id, taskType: 'PRACTICE', learningDate: null, dailyTarget: 0, newCount: 0, reviewCount: 0, followTypingTarget: body.count, totalCount: 2, nextItemId: 101 };
  const state = { progress, items: [{ id: 101, word: 'apple', status: 'PENDING' }, { id: 102, word: 'banana', status: 'PENDING' }], nonce: 0, extra: undefined };
  tasks.set(id, state); creations.set(body.requestId, id); return state;
}
function failure(config, code) { throw new AxiosError(code, 'ERR_BAD_RESPONSE', config, null, { config, status: 409, headers: {}, data: { code, message: code } }); }
const page = (rows, params = {}) => ({ page: params.page || 1, size: params.size || 20, total: rows.length, records: rows.slice(((params.page || 1) - 1) * (params.size || 20), (params.page || 1) * (params.size || 20)) });
const row = (state, item) => ({ itemId: item.id, wordId: item.id, word: item.word, phonetic: '/test/', translation: '单词释义', sortOrder: item.id - 100, itemType: 'NEW', itemStatus: item.status, completionReason: item.status === 'DONE' ? 'FOLLOW_TYPED' : null, current: state.progress.nextItemId === item.id, canExtraTrain: item.status === 'DONE' && state.progress.status !== 'ABANDONED', trainingCount: events.filter(e => e.progress.batchId === state.progress.batchId && e.itemId === item.id).length, answerCount: item.status === 'DONE' ? 1 : 0 });
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  calls.push({ url: config.url, method: config.method, body: clone(body ?? null), params: config.params });
  const ok = value => ({ config, status: 200, headers: {}, data: { code: 'OK', data: clone(value) } });
  if (config.url === '/learning/settings') return ok({ dailyTarget: 1, preferredStudyMode: 'RECOGNITION', newWordTarget: 1, reviewLimit: 0, pronunciation });
  if (config.url === '/learning/today') return ok({ learningDate: '2026-10-27', dailyTarget: 1, activeCount: 2, newCount: 2, dueCount: 0, unassignedCount: 0, canAddMore: false, reviewBacklogCount: 0, overdueReviewCount: 0, task: daily });
  if (config.url === '/learning-batches/50/daily') return ok(daily);
  if (config.url.endsWith('/50/daily/mode')) { assert.notEqual(body.mode, 'FOLLOW_TYPING'); daily.studyMode = body.mode; daily.modeVersion++; return ok(daily); }
  if (config.url.endsWith('/50/daily/training/next')) return ok({ itemId: 501, mode: daily.studyMode, modeVersion: daily.modeVersion, presentationId: 'daily', attemptNo: 1, phase: daily.studyMode === 'RECOGNITION' ? 'QUESTION' : 'AWAITING_INPUT', answerRevealed: false, hintUsed: false, itemStatus: 'PENDING', completionReason: null, extraTraining: false, word: daily.studyMode === 'RECOGNITION' ? 'existing' : undefined, translation: '每日单词', progress: daily });
  if (config.url === '/learning/follow-typing/statistics') {
    const date = config.params?.date || day, rows = events.filter(event => event.answeredAt.startsWith(date)), correct = rows.filter(event => event.verdict === 'CORRECT');
    return ok({ learningDate: date, answerCount: rows.length, correctCount: correct.length, inputAccuracy: rows.length ? correct.length / rows.length : null, practicedWordCount: new Set(rows.map(r => r.wordId)).size, completedWordCount: new Set(correct.map(r => r.wordId)).size, lastPracticedAt: rows.at(-1)?.answeredAt || null });
  }
  if (config.url === root) {
    if (config.method === 'get') {
      if (emptyListOnce) { emptyListOnce = false; return ok(page([], config.params)); }
      return ok(page([...tasks.values()].filter(state => state.progress.status === config.params.status).map(state => state.progress), config.params));
    }
    assert.deepEqual(Object.keys(body).sort(), ['count', 'requestId']); assert.ok(body.count >= 10 && body.count <= 20);
    if (creations.has(body.requestId)) return ok(tasks.get(creations.get(body.requestId)).progress);
    if ([...tasks.values()].some(state => state.progress.status === 'IN_PROGRESS')) return failure(config, 'FOLLOW_TYPING_IN_PROGRESS');
    if (noWords) return failure(config, 'NO_FOLLOW_TYPING_WORDS');
    const state = create(body);
    if (loseCreate) { loseCreate = false; throw new Error('lost create response'); }
    return ok(state.progress);
  }
  const match = config.url.match(/^\/learning\/follow-typing\/batches\/(\d+)(?:\/(next|items|attempts|abandon|items\/(\d+)\/answer))?$/);
  if (!match) return fallback(config);
  const state = tasks.get(Number(match[1])); assert.ok(state); const p = state.progress;
  if (!match[2]) return ok(p);
  if (match[2] === 'abandon') { p.status = 'ABANDONED'; p.nextItemId = null; return ok(p); }
  if (match[2] === 'items') return ok(page(state.items.map(item => row(state, item)), config.params));
  if (match[2] === 'attempts') return ok(page(events.filter(event => event.progress.batchId === p.batchId), config.params));
  if (match[2] === 'next') {
    if (paused) { const item = state.items.find(item => item.status === 'PENDING'); if (item) { item.status = 'SKIPPED'; p.skippedCount++; } paused = false; }
    state.extra = body?.itemId;
    const item = state.extra ? state.items.find(item => item.id === state.extra) : state.items.find(item => item.status === 'PENDING');
    if (!item || p.status === 'ABANDONED') { if (p.status !== 'ABANDONED') p.status = 'COMPLETED'; p.nextItemId = null; return ok(null); }
    p.nextItemId = item.id;
    return ok({ ...row(state, item), mode: 'FOLLOW_TYPING', modeVersion: 0, phase: 'AWAITING_INPUT', answerRevealed: false, hintUsed: true, extraTraining: !!state.extra, presentationId: `p-${p.batchId}-${item.id}-${p.trainingCount}-${state.nonce}`, attemptNo: p.trainingCount + 1, audioUrl: `/api/learning-batches/${p.batchId}/training/items/${item.id}/audio?presentationId=x&modeVersion=0`, pronunciation, progress: p });
  }
  assert.equal(config.method, 'put'); assert.equal(body.action, 'ANSWER'); assert.equal(typeof body.input, 'string'); assert.equal(typeof body.attemptNo, 'number');
  assert.deepEqual(Object.keys(body).sort(), ['action', 'attemptNo', 'input', 'modeVersion', 'presentationId', 'requestId']);
  if (answers.has(body.requestId)) return ok({ ...answers.get(body.requestId), progress: p });
  if (staleOnce) { staleOnce = false; state.nonce++; return failure(config, 'STALE_TRAINING_ANSWER'); }
  if (paused) return failure(config, 'PLAN_WORD_UNAVAILABLE');
  const item = state.items.find(item => item.id === Number(match[3]));
  assert.equal(body.presentationId, `p-${p.batchId}-${item.id}-${p.trainingCount}-${state.nonce}`); assert.equal(body.attemptNo, p.trainingCount + 1); assert.equal(body.modeVersion, 0);
  const correct = body.input.trim().toLowerCase() === item.word;
  p.trainingCount++; if (correct && item.status !== 'DONE') { item.status = 'DONE'; p.completedCount++; p.answerCount++; }
  if (state.items.every(item => item.status !== 'PENDING')) { p.status = 'COMPLETED'; p.nextItemId = null; }
  const event = { ...row(state, item), trainingId: events.length + 1, wordId: item.id, input: body.input, mode: 'FOLLOW_TYPING', action: 'ANSWER', verdict: correct ? 'CORRECT' : 'INCORRECT', selfAssessment: null, hintUsed: true, extraTraining: !!state.extra, attemptNo: body.attemptNo, reviewLogId: null, affectsSchedule: false, answeredAt: `${day}T12:00:00`, progress: clone(p) };
  events.push(event); answers.set(body.requestId, event);
  if (loseAnswer) { loseAnswer = false; throw new Error('lost answer response'); }
  return ok(event);
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, label) { const limit = Date.now() + 8000; while (!test()) { if (Date.now() > limit) throw new Error(`Timeout ${label}\n${document.body.textContent}`); await sleep(10); } }
const button = text => [...document.querySelectorAll('button')].find(node => !node.closest('[style*="display: none"]') && node.textContent.trim() === text);
function input(selector, value) { const node = document.querySelector(selector); assert.ok(node, selector); node.value = value; node.dispatchEvent(new window.Event('input', { bubbles: true })); }
async function click(text) { await until(() => button(text)?.disabled === false, text); button(text).click(); }
async function visit(path, ready) { await router.push(path); await sleep(0); await until(ready, path); }
const ready = () => document.querySelector('#follow-typing-input')?.disabled === false;
const writes = () => calls.filter(call => /\/items\/\d+\/answer$/.test(call.url) && call.url.startsWith(root));
async function submit(text, repeat = false) { await until(ready, 'follow ready'); input('#follow-typing-input', text); const form = document.querySelector('.follow-exercise form'); form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); if (repeat) form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); }
await until(() => document.querySelector('#username'), 'login'); input('#username', 'independent_follow_fixture'); input('#password', 'fixture123'); await click('登录'); await until(() => document.querySelector('.daily-equation'), 'home');
const isolatedFrom = calls.length;
await visit('/follow-typing', () => button('重试原创建请求'));
assert.equal(calls.filter(c => c.url === root && c.method === 'post').length, 1); assert.equal(calls.findIndex(c => c.url === root && c.method === 'get') < calls.findIndex(c => c.url === root && c.method === 'post'), true);
const createBody = calls.filter(c => c.url === root && c.method === 'post')[0].body;
await click('重试原创建请求'); await until(ready, 'created follow'); assert.equal(router.currentRoute.value.fullPath, '/learn?mode=follow&followBatchId=901'); assert.equal(tasks.size, 1); assert.deepEqual(calls.filter(c => c.url === root && c.method === 'post')[1].body, createBody);
assert.match(document.querySelector('.workspace-meta').textContent, /实际 2 词（申请 20 词）/); assert.equal(document.querySelector('.follow-exercise .learning-word').textContent, 'apple'); assert.ok(document.querySelector('.follow-pronunciation').textContent.includes('/test/')); assert.match(document.querySelector('.follow-exercise .word-meaning').textContent, /单词释义/);
const beforeWrong = writes().length; await submit('aple', true); await until(() => document.querySelector('.follow-input-feedback.is-error') && ready(), 'wrong continues'); assert.equal(writes().length, beforeWrong + 1); assert.equal(document.querySelector('#follow-typing-input').value, 'aple'); assert.equal(tasks.get(901).progress.completedCount, 0);
const oldDisplay = writes().at(-1).body.presentationId;
await submit(' ApPlE '); await until(() => document.querySelector('.follow-exercise')?.dataset.itemId === '102' && ready(), 'correct advances'); assert.equal(writes().at(-1).body.input, ' ApPlE '); assert.notEqual(writes().at(-1).body.presentationId, oldDisplay); assert.match(document.querySelector('.follow-input-feedback').textContent, /跟拼完成/);
await click('学习统计'); await until(() => document.querySelector('.follow-date-statistics dl')?.textContent.includes('50.0%'), 'date accuracy from real inputs'); assert.equal(tasks.get(901).progress.answerCount, 1); assert.match(document.querySelector('.follow-date-statistics header').textContent, /当日所有跟拼轮次汇总/);
const beforeRestore = writes().length; day = '2026-10-28'; await visit('/books', () => document.querySelector('.library-grid')); await visit('/follow-typing/901', ready); assert.equal(writes().length, beforeRestore); assert.equal(document.querySelector('.follow-exercise').dataset.itemId, '102'); assert.equal(tasks.size, 1);
for (let index = 0; index < 7; index++) {
  const before = writes().length; await submit('wrong'); await until(() => ready() && writes().length === before + 1 && document.querySelector('.follow-input-feedback.is-error'), 'unlimited wrong follow attempts');
}
assert.equal(tasks.get(901).progress.completedCount, 1);
loseAnswer = true; await submit('banana', true); await until(() => button('重试原输入请求')?.disabled === false && document.querySelector('.learning-error')?.textContent.includes('保存结果尚未确认'), 'unknown input'); const pendingBody = clone(writes().at(-1).body);
await visit('/books', () => document.querySelector('.library-grid')); await visit('/follow-typing/901', () => button('重试原输入请求')); await click('重试原输入请求'); await until(() => document.querySelector('.follow-completion h2')?.textContent === '本轮跟拼完成', 'null next completion'); assert.deepEqual(writes().at(-1).body, pendingBody); assert.equal(tasks.get(901).progress.trainingCount, 10); assert.equal(tasks.get(901).progress.completedCount, 2); assert.equal(tasks.size, 1); assert.ok(!/已掌握|每日目标已完成/.test(document.querySelector('.follow-completion').textContent));
assert.equal(calls.filter(c => c.url === root && c.method === 'post').length, 2, 'completion never automatically starts another round');
await click('本轮词单');
await until(() => document.querySelectorAll('.training-item-row').length === 2, 'follow item snapshots');
assert.ok(document.querySelector('.training-item-row').textContent.includes('apple'));
document.querySelector('.training-item-row button').click(); await until(() => ready() && document.querySelector('.follow-extra-note'), 'extra follow');
await submit('apple'); await until(() => ready() && tasks.get(901).progress.trainingCount === 11, 'extra answer counted'); assert.equal(tasks.get(901).progress.completedCount, 2);
await click('返回本轮'); await until(() => document.querySelector('.follow-completion h2')?.textContent === '本轮跟拼完成', 'return from extra');
const countTrigger = document.querySelector('.follow-next-round [role=combobox]'); countTrigger.click(); await until(() => document.querySelector('[role=option]'), 'count selector'); [...document.querySelectorAll('.follow-next-round [role=option]')].find(node => node.textContent.trim() === '10 词').click(); await sleep(0);
await click('开始新一轮'); await until(() => router.currentRoute.value.fullPath === '/learn?mode=follow&followBatchId=902' && ready(), 'explicit next round'); assert.equal(tasks.get(902).progress.followTypingTarget, 10); assert.notEqual(calls.filter(c => c.url === root && c.method === 'post').at(-1).body.requestId, createBody.requestId);
staleOnce = true; await submit('apple'); await until(() => ready() && document.querySelector('.learning-notice')?.textContent.includes('旧提交'), 'stale recovery'); assert.equal(tasks.get(902).progress.trainingCount, 0); const staleBody = writes().at(-1).body;
paused = true; await submit('apple'); await until(() => document.querySelector('.follow-exercise')?.dataset.itemId === '102' && ready(), 'paused skipped'); assert.equal(tasks.get(902).progress.skippedCount, 1); assert.equal(tasks.get(902).progress.totalCount, 2); assert.equal(tasks.size, 2); assert.notEqual(writes().at(-1).body.presentationId, staleBody.presentationId);
emptyListOnce = true; await visit('/follow-typing', ready); await until(() => router.currentRoute.value.fullPath === '/learn?mode=follow&followBatchId=902', 'conflict resumes existing'); assert.equal(tasks.size, 2);
document.querySelector('button[aria-label="练习设置"]').click(); await until(() => document.querySelector('.word-practice-round-settings'), 'practice settings'); await click('放弃本轮'); await until(() => document.querySelector('[role=dialog][aria-label="放弃本轮跟拼？"]'), 'abandon confirmation'); const confirm = [...document.querySelectorAll('[role=dialog][aria-label="放弃本轮跟拼？"] button')].find(node => node.textContent.trim() === '放弃本轮'); confirm.click(); await until(() => document.querySelector('.follow-completion h2')?.textContent === '本轮已放弃', 'abandoned readonly'); assert.equal(tasks.get(902).progress.status, 'ABANDONED');
noWords = true; await click('开始新一轮'); await until(() => document.querySelector('.learning-error')?.textContent.includes('冷却'), 'empty source'); assert.ok(!document.querySelector('.follow-completion').textContent.includes('每日目标')); assert.equal(tasks.size, 2);
const isolatedCalls = calls.slice(isolatedFrom); assert.ok(isolatedCalls.every(call => !call.url.includes('/daily') && !call.url.includes('/learning/today') && !call.url.includes('weak-words') && !call.url.includes('consolidation') && !call.url.includes('/correction'))); assert.deepEqual(daily, initialDaily);
await visit('/learn/50', () => document.querySelector('.daily-follow-migration')); assert.equal(document.querySelector('.daily-training-card'), null); assert.ok(document.querySelector('.daily-follow-migration a[href="/follow-typing"]'));
document.querySelector('button[aria-label="练习设置"]').click(); await until(() => document.querySelectorAll('.word-practice-modes input').length === 4, 'three daily modes and independent follow'); assert.ok(document.querySelector('#word-mode-spelling')); document.querySelector('button[aria-label="关闭练习设置"]').click();
await click('单词默写'); await until(() => document.querySelector('.daily-training-card')?.dataset.mode === 'DICTATION', 'legacy migration by explicit choice'); assert.equal(daily.completedCount, 0); assert.equal(daily.totalCount, 1);
console.log('PASS independent follow: query before create, exact create/input retries, duplicate guard, raw input, fresh presentation after every answer');
console.log('PASS refresh/cross-day resume without drawing, null-next completion, requested versus actual counts, date accuracy versus round training count');
console.log('PASS stale prompt and plan skip recovery, existing-round conflict recovery, explicit new request ID/count, idempotent abandon and empty-source message');
console.log('PASS no DAILY/self-assessment/correction/schedule/issues writes throughout follow; legacy daily migration retains three daily modes and routes follow to independent practice');
app.unmount(); await window.happyDOM.close();
