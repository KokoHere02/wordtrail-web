// Mounted Vue UI + explicit HTTP fixtures. This does not validate a deployed backend or physical layout.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';
const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent', 'KeyboardEvent']) Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window); globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', define: { 'import.meta.env.VITE_UI_PREVIEW': '"false"' }, logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-sentences-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/sentences-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { router, http, app, TrainingItems, useStudyWorkspace } = await import('../.qa-sentences-dist/ui.js');
const { createApp } = await import('vue');
const document = window.document, calls = [], attempts = [];
// The daily page no longer exposes the list. Keep shared item component coverage in isolation.
let itemApp, itemMount;
function unmountItems() { itemApp?.unmount(); itemMount?.remove(); itemApp = undefined; }
function mountItems(allowExtra = false) {
  unmountItems(); itemMount = document.createElement('div'); document.body.append(itemMount);
  itemApp = createApp(TrainingItems, { batchId: 50, allowExtra, onExtra: async itemId => {
    useStudyWorkspace().extraDailyItemId = itemId;
    await router.push('/today'); await router.push('/learn/50');
  } }); itemApp.mount(itemMount);
}

const clone = value => JSON.parse(JSON.stringify(value));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, label) { const end = Date.now() + 6000; while (!test()) { if (Date.now() > end) throw new Error(`Timeout ${label}\n${document.body.textContent}`); await delay(10); } }
function input(selector, value, caret = value.length) { const node = document.querySelector(selector); assert.ok(node, selector); node.value = value; node.setSelectionRange?.(caret, caret); node.dispatchEvent(new window.Event('input', { bubbles: true })); }
function visible(node) { return !node.closest('[style*="display: none"]'); }
function button(text) { return [...document.querySelectorAll('button')].find(node => { const label = node.cloneNode(true); label.querySelectorAll('kbd[aria-hidden=true]').forEach(child => child.remove()); return label.textContent.trim() === text && visible(node); }); }
async function click(text) { await until(() => button(text) && !button(text).disabled, text); button(text).click(); }
function key(key, selector = '.daily-training-card', options = {}) { document.querySelector(selector).dispatchEvent(new window.KeyboardEvent('keydown', { key, code: key === ' ' ? 'Space' : key, bubbles: true, cancelable: true, ...options })); }
async function tab(id) {
  if (id === 'sentences') { document.querySelector('#mode-tab-sentences').click(); await until(() => document.querySelector('#mode-tab-sentences').getAttribute('aria-selected') === 'true', id); return; }
  if (document.querySelector('#mode-tab-words').getAttribute('aria-selected') !== 'true') { document.querySelector('#mode-tab-words').click(); await until(() => document.querySelector('.word-practice-tools'), 'word tools'); }
  const settings = document.querySelector('button[aria-controls="word-practice-settings"]');
  if (settings.getAttribute('aria-expanded') !== 'true') { settings.click(); await until(() => document.querySelector(`#word-mode-${id}`), 'mode options'); }
  await until(() => !document.querySelector('.word-practice-modes').disabled, `enabled ${id}`);
  document.querySelector(`#word-mode-${id}`).click();
  await until(() => currentMode === ({ recognition: 'RECOGNITION', dictation: 'DICTATION', listen: 'LISTEN_DICTATION' })[id] && !document.querySelector('.word-practice-modes').disabled, id);
  settings.click(); await until(() => !document.querySelector('#word-practice-settings'), 'settings closed');
}
const fallback = http.defaults.adapter;
const ok = (config, data) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data: clone(data) } });
const groups = [{ partOfSpeech: 'n.', meaning: '苹果' }, { partOfSpeech: null, meaning: '长释义测试：'.repeat(25) }];
let currentMode = 'RECOGNITION', version = 0, eventNo = 1, presentation, completed = false, extra = false, sentenceStage = 0, append = false;
const revealedModes = new Set();
let listCase = false, todayDate = '2026-10-25';
let holdMode = false, releaseMode;
const daily = () => ({ batchId: 50, learningDate: '2026-10-25', dailyTarget: 1, taskType: 'DAILY', status: completed && !append ? 'COMPLETED' : 'IN_PROGRESS', totalCount: listCase ? 23 : append ? 2 : 1, completedCount: listCase ? 21 : completed ? 1 : 0, skippedCount: listCase ? 1 : 0, answerCount: completed ? 1 : 0, unfamiliarCount: 0, newCount: 1, reviewCount: 0, nextItemId: completed ? append ? 52 : null : 51, studyMode: currentMode, modeVersion: version, trainingCount: attempts.length });
const sentence = () => ({ sessionId: 650, selectionSource: 'BANK', status: 'IN_PROGRESS', totalCount: 2, submissionCount: sentenceStage > 0 ? 1 : 0, answerCount: sentenceStage > 0 ? 1 : 0, revealCount: 0, selfReviewCount: sentenceStage > 1 ? 1 : 0, completedCount: sentenceStage > 1 ? 1 : 0, understoodCount: 0, partialCount: sentenceStage > 1 ? 1 : 0, notUnderstoodCount: 0, nextItemId: sentenceStage > 1 ? 802 : 801, createdAt: '2026-10-25T12:00:00', completedAt: null });
const page = (records, params = { page: 1, size: 10 }) => ({ page: params.page, size: params.size, total: records.length, records });
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  calls.push({ url: config.url, method: config.method, body: clone(body ?? null) });
  if (config.url === '/learning/today') return ok(config, { learningDate: todayDate, dailyTarget: 1, activeCount: 2, dueCount: 0, newCount: 2, unassignedCount: 1, canAddMore: completed && !append, task: daily() });
  if (config.url === '/learning-batches/50/daily') return ok(config, daily());
  if (config.url.endsWith('/daily/mode')) {
    assert.equal(body.expectedVersion, version); currentMode = body.mode; version++; presentation = undefined;
    if (holdMode) { holdMode = false; await new Promise(resolve => { releaseMode = resolve; }); }
    return ok(config, daily());
  }
  if (config.url.endsWith('/training/next')) {
    extra = body.itemId === 51; presentation ??= `question-${version}-${eventNo}`;
    return ok(config, { itemId: 51, mode: currentMode, modeVersion: version, presentationId: presentation, attemptNo: eventNo,
      audioUrl: '/api/learning-batches/50/training/items/51/audio?presentationId=current&modeVersion=0',
      phase: currentMode === 'RECOGNITION' ? revealedModes.has(currentMode) ? 'AWAITING_SELF_ASSESSMENT' : 'QUESTION' : 'AWAITING_INPUT', answerRevealed: revealedModes.has(currentMode),
      itemStatus: completed ? 'DONE' : 'PENDING', completionReason: completed ? 'ASSISTED' : null,
      ...(!['DICTATION', 'LISTEN_DICTATION'].includes(currentMode) || revealedModes.has(currentMode) ? { wordId: 1001, word: 'apple', phonetic: '/ˈæp.əl/' } : {}),
      ...(currentMode !== 'RECOGNITION' || revealedModes.has(currentMode) ? { translationGroups: groups } : {}), hintUsed: eventNo > 1 || currentMode !== 'DICTATION', extraTraining: extra, progress: daily() });
  }
  if (config.url.endsWith('/training-answer')) {
    assert.equal(body.presentationId, presentation); assert.equal(body.modeVersion, version); assert.equal(body.attemptNo, eventNo);
    if (currentMode !== 'RECOGNITION' && body.action === 'ANSWER') assert.equal('result' in body, false);
    if (body.action === 'ANSWER') completed = true;
    if (body.action === 'REVEAL') revealedModes.add(currentMode); else revealedModes.delete(currentMode);
    const answer = { trainingId: attempts.length + 1, itemId: 51, wordId: 1001, mode: currentMode, action: body.action, verdict: body.action === 'REVEAL' ? 'REVEALED' : currentMode === 'RECOGNITION' ? 'SELF_ASSESSED' : 'CORRECT', input: body.input ?? null, selfAssessment: body.result ?? null, word: 'apple', translationGroups: groups, hintUsed: true, extraTraining: extra, attemptNo: eventNo, reviewLogId: 71, affectsSchedule: false, answeredAt: '2026-10-25T12:00:00' };
    answer.itemStatus = completed ? 'DONE' : 'PENDING'; answer.completionReason = completed ? 'ASSISTED' : null;
    attempts.unshift(answer); eventNo++; presentation = undefined; return ok(config, { ...answer, progress: daily() });
  }
  if (config.url.endsWith('/training/attempts')) return ok(config, page(attempts.map(row => ({ ...row, progress: daily() })), config.params));
  if (config.url.endsWith('/training/items')) {
    const rows = listCase ? Array.from({ length: 23 }, (_, index) => ({ itemId: 51 + index, sortOrder: index + 1, itemType: 'NEW',
      itemStatus: index === 1 ? 'PENDING' : index === 2 ? 'SKIPPED' : 'DONE',
      ...(index !== 1 && index !== 2 ? { wordId: 1001 + index, word: `completed${index}`, translationGroups: groups } : {}),
      completionReason: ['FOLLOW_TYPED', null, null, 'ASSISTED', 'RECALLED', 'LIMIT_REACHED', null][index] ?? null,
      answerCount: index === 1 || index === 2 ? 0 : 1, trainingCount: index === 1 || index === 2 ? 0 : 2, completedAt: null,
      current: index === 1 && todayDate === '2026-10-25', canExtraTrain: index === 0 && todayDate === '2026-10-25' }))
      : [{ itemId: 51, wordId: 1001, word: 'apple', sortOrder: 1, itemType: 'NEW', itemStatus: completed ? 'DONE' : 'PENDING', completionReason: completed ? 'ASSISTED' : null, answerCount: 1, trainingCount: attempts.length, completedAt: null, current: !completed, canExtraTrain: completed }];
    const value = page(rows, config.params); value.records = rows.slice((value.page - 1) * value.size, value.page * value.size); return ok(config, value);
  }
  if (config.url === '/learning/statistics/words') return ok(config, page([{ wordId: 1001, word: 'apple', translationGroups: groups, itemType: 'NEW', lastResult: 2, answerCount: 1, completed, statisticsComplete: true }], config.params));
  if (config.url === '/learning/statistics/training') return ok(config, { learningDate: '2026-10-25', completedWordCount: 1, modes: ['RECOGNITION', 'DICTATION', 'FOLLOW_TYPING'].map(mode => ({ mode, trainingCount: mode === 'RECOGNITION' ? 0 : 1, answerCount: mode === 'RECOGNITION' ? 0 : 1, revealCount: 0, correctCount: mode === 'RECOGNITION' ? 0 : 1, inputAccuracy: mode === 'RECOGNITION' ? null : 1, hintedAnswerCount: 1, recognizedCount: 0, uncertainCount: 0, unknownCount: 0 })) });
  if (config.url === '/sentence-translation/sessions') return ok(config, page([sentence()], config.params));
  if (config.url === '/sentence-translation/sessions/650') return ok(config, sentence());
  if (config.url.endsWith('/sessions/650/current')) return ok(config, { itemId: sentenceStage > 1 ? 802 : 801, sentenceId: 1, status: sentenceStage === 1 ? 'AWAITING_REVIEW' : 'PENDING', englishText: 'I read every day.', difficulty: 1, source: '原创样例', sourceReference: null, linkedWords: [], attemptId: sentenceStage === 1 ? 777 : null, action: sentenceStage === 1 ? 'ANSWER' : null, translation: sentenceStage === 1 ? '我每天阅读。' : null, referenceTranslation: sentenceStage === 1 ? '我每天读书。' : null, explanation: sentenceStage === 1 ? 'every day 表示每天。' : null, selfAssessment: null, submittedAt: null, personalNote: { content: '', errorTags: [], attemptId: null, version: 0, updatedAt: null } });
  if (config.url.endsWith('/submission')) { sentenceStage = 1; return ok(config, { sentenceId: 1, progress: sentence() }); }
  if (config.url.endsWith('/self-review')) { sentenceStage = 2; return ok(config, { sentenceId: 1, progress: sentence(), reviewSchedule: null }); }
  if (config.url.endsWith('/management/access')) return ok(config, { canManage: false });
  if (config.url === '/dictation/batches') return ok(config, page([], config.params));
  return fallback(config);
};
await until(() => document.querySelector('#username'), 'login'); input('#username', 'workspace_reader'); input('#password', 'example123'); await click('登录'); await until(() => document.querySelector('.daily-equation'), 'home');
await router.push('/learn/50'); await until(() => document.querySelector('.daily-training-card')?.dataset.mode === 'RECOGNITION', 'recognition');
const root = document.querySelector('.unified-daily-page');
assert.equal(document.querySelectorAll('.workspace-tabs [role="tab"]').length, 2, 'follow and daily share one word tab');
assert.equal(document.querySelector('#mode-tab-words').getAttribute('aria-selected'), 'true');
document.querySelector('button[aria-label="显示音标"]').click(); await until(() => !document.querySelector('.daily-word-phonetic'), 'phonetic hidden');
document.querySelector('button[aria-label="显示音标"]').click(); await until(() => document.querySelector('.daily-word-phonetic'), 'phonetic restored');
assert.equal(document.querySelector('.daily-training-card .word-meaning'), null, 'initial Chinese hidden');
assert.ok([...document.querySelectorAll('.daily-training-rating button')].every(b => !b.disabled), 'new recognition questions allow direct self assessment');
document.querySelector('button[aria-label="显示中文释义"]').click(); await until(() => document.querySelector('.daily-training-card .word-meaning'), 'toolbar reveal + fresh identity');
assert.equal(calls.filter(c => c.url.endsWith('/training-answer')).length, 1); assert.equal(calls.filter(c => c.url.endsWith('/next')).length, 2);
document.querySelector('button[aria-label="显示中文释义"]').click(); await until(() => !document.querySelector('.daily-training-card .word-meaning'), 'Chinese hidden');
key(' '); await until(() => document.querySelector('.daily-training-card .word-meaning'), 'Chinese restored with Space');
assert.equal(calls.filter(c => c.url.endsWith('/training-answer')).length, 1, 'showing known definition sends no extra reveal');
await router.push('/today'); await router.push('/learn/50'); await delay(0);
await until(() => document.querySelector('.daily-training-rating button')?.disabled === false, 'revealed recognition restored after reentry');
assert.ok(document.querySelector('.daily-training-card .word-meaning')); assert.equal(calls.filter(c => c.url.endsWith('/training-answer')).length, 1);
document.querySelector('button[aria-label="显示中文释义"]').click(); await until(() => !document.querySelector('.daily-training-card .word-meaning'), 'Chinese hidden before mode switch');
const beforeDictation = calls.filter(c => c.url.endsWith('/training-answer')).length;
await tab('dictation'); assert.equal(document.querySelector('.daily-training-card .learning-word'), null, 'dictation target hidden');
await until(() => document.querySelector('.daily-training-card .word-meaning'), 'dictation automatically shows Chinese');
assert.equal(calls.filter(c => c.url.endsWith('/training-answer')).length, beforeDictation, 'showing dictation Chinese does not reveal the English answer');
assert.equal(document.querySelector('.unified-daily-page .workspace-history'), null);
assert.equal(document.querySelector('.unified-daily-page .workspace-configuration'), null);
assert.equal(document.querySelector('.word-practice-more'), null);

document.querySelector('button[aria-controls="word-practice-settings"]').click(); await until(() => document.querySelector('#word-mode-spelling'), 'follow is a word practice mode');
assert.equal(document.querySelector('#mode-tab-follow'), null); document.querySelector('button[aria-label="关闭练习设置"]').click(); await until(() => !document.querySelector('#word-practice-settings'), 'settings closed after checking follow');
assert.equal(document.querySelector('.daily-training-card .review-pronunciation'), null); assert.equal(document.querySelectorAll('#daily-training-input').length, 1);
input('#daily-training-input', 'app'); await tab('listen'); assert.equal(root, document.querySelector('.unified-daily-page'));
assert.equal(document.querySelectorAll('.daily-training-card .letter-slot').length, 1, 'listening keeps the target length hidden');
input('#daily-training-input', 'appl'); await until(() => document.querySelector('.daily-training-card .letter-slot.is-caret') === document.querySelectorAll('.daily-training-card .letter-slot')[4], 'native caret');
await tab('dictation'); assert.equal(document.querySelector('#daily-training-input').value, 'app', 'unsubmitted mode draft retained');
await click('不会／看答案'); await until(() => document.querySelector('.daily-assisted-note'), 'revealed assisted input');
const revealWrites = calls.filter(c => c.url.endsWith('/training-answer')).length;
await router.push('/today'); await router.push('/learn/50');
await until(() => document.querySelector('.daily-assisted-note'), 'assisted dictation restored after reentry');
assert.equal(document.querySelector('.daily-training-card .learning-word').textContent, 'apple');
assert.equal(calls.filter(c => c.url.endsWith('/training-answer')).length, revealWrites);
await tab('listen'); assert.equal(document.querySelector('#daily-training-input').value, 'appl');
assert.equal(document.querySelector('.daily-training-card .letter-slot.is-caret'), document.querySelectorAll('.daily-training-card .letter-slot')[4], 'restored draft caret follows the native input');
const count = calls.filter(c => c.url.endsWith('/training-answer')).length;
document.querySelector('#daily-training-input').dispatchEvent(new window.Event('compositionstart', { bubbles: true })); input('#daily-training-input', 'apple'); key('Enter', '#daily-training-input'); await delay(20); assert.equal(calls.filter(c => c.url.endsWith('/training-answer')).length, count);
document.querySelector('#daily-training-input').dispatchEvent(new window.Event('compositionend', { bubbles: true })); key('Enter', '#daily-training-input');
await until(() => document.querySelector('.daily-training-feedback')?.textContent.includes('辅助完成'), 'listening completes shared daily goal');
assert.match(document.querySelector('.workspace-progress').textContent, /1 \/ 1/); await click('查看完成状态 →');
await until(() => document.querySelector('.learning-empty')?.textContent.includes('本组训练已结束'), 'shared completion');
assert.ok(button('继续学习'), 'fresh server canAddMore is available without another start POST');
assert.equal(document.querySelector('.workspace-items'), null, 'daily word practice hides the item list'); mountItems(true);
await until(() => button('追加练习'), 'completed words from server'); await click('追加练习');
await until(() => document.querySelector('.daily-training-card'), 'extra presentation'); unmountItems(); await tab('dictation'); input('#daily-training-input', 'apple'); key('Enter', '#daily-training-input');
await until(() => document.querySelector('.daily-training-feedback')?.textContent.includes('追加训练 · 原词项辅助完成'), 'extra dictation preserves original completion reason');
assert.match(document.querySelector('.workspace-progress').textContent, /1 \/ 1/); assert.equal(attempts[0].extraTraining, true);
await tab('sentences'); await until(() => document.querySelector('a[href="/sentences/sessions/650"]'), 'sentence resume'); document.querySelector('a[href="/sentences/sessions/650"]').click();
await until(() => document.querySelector('#sentence-translation')?.disabled === false, 'sentence input'); input('#sentence-translation', '我每天阅读。');
await tab('dictation'); await tab('sentences'); assert.equal(document.querySelector('#sentence-translation').value, '我每天阅读。');
assert.equal(document.querySelector('.sentence-reference'), null); key('Enter', '#sentence-translation', { ctrlKey: true }); await until(() => document.querySelector('.sentence-reference'), 'reference');
await click('部分理解'); await until(() => document.querySelector('.sentence-study-card')?.dataset.itemId === '802', 'review advances');
await router.push('/dictation'); await until(() => document.querySelector('.workspace-dictation-mode'), 'independent dictation entry'); assert.match(document.querySelector('.workspace-shortcuts [aria-current="page"]').textContent, /独立默写专项/);
assert.ok(!calls.some(c => c.url === '/dictation/batches' && c.method === 'post'), 'daily never creates independent dictation');
assert.ok(!calls.some(c => /\/daily\/items\/\d+$|\/daily\/items\/\d+\/answer$/.test(c.url)), 'no legacy daily item/answer calls');
await router.push('/learn/50'); await until(() => !document.querySelector('#mode-tab-words').disabled, 'daily restore');
holdMode = true; const switching = tab('listen'); await until(() => releaseMode, 'mode request in flight'); document.querySelector('#word-mode-recognition').click(); releaseMode(); await switching;
assert.equal(document.querySelector('.daily-training-card').dataset.mode, 'LISTEN_DICTATION', 'conflicting mode clicks blocked');
await router.push('/today'); append = true; await router.push('/learn/50'); await until(() => document.querySelector('.workspace-progress').textContent.includes('1 / 2'), 'same-day append restored by GET');
assert.equal(calls.filter(c => c.url.endsWith('/today/start')).length, 0);
listCase = true; await router.push('/today'); await router.push('/learn/50');
await until(() => document.querySelector('.daily-training-card'), 'list task');
assert.equal(document.querySelector('.workspace-items'), null); mountItems(true);
await until(() => document.querySelectorAll('.training-item-row').length === 20, 'first item page');
const itemList = document.querySelector('.training-items');
for (const text of ['回忆完成', '跟拼完成', '辅助完成', '达到当天强化上限', '已完成', '正在学习']) assert.ok(itemList.textContent.includes(text), text);
assert.equal(document.querySelector('[data-item-id="52"] [lang="en"]'), null, 'pending answer hidden');
assert.equal(document.querySelector('[data-item-id="53"] .word-meaning'), null, 'skipped answer hidden');
assert.equal(document.querySelector('[data-item-id="54"] button'), null, 'paused/completed item cannot be extra trained');
document.querySelector('.training-items button[aria-label="下一页"]').click();
await until(() => document.querySelectorAll('.training-item-row').length === 3, 'second item page');
assert.equal(document.querySelector('.training-item-order').textContent, '21');
unmountItems(); todayDate = '2026-10-26'; await router.push('/today'); const beforeHistory = calls.length; await router.push('/learn/50');
await until(() => document.querySelector('.learning-empty')?.textContent.includes('历史任务仅供回顾'), 'historical task');
assert.equal(document.querySelector('.workspace-items'), null); mountItems(false);
await until(() => document.querySelectorAll('.training-item-row').length > 0, 'historical items');
assert.equal(document.querySelectorAll('.training-items button.muted-link').length, 0, 'historical rows have no extra buttons');
assert.ok(!calls.slice(beforeHistory).some(call => call.url.endsWith('/training/next')), 'historical reads do not create a presentation');
unmountItems(); todayDate = '2026-10-25';
await router.push('/statistics'); await until(() => document.querySelector('.overview-more'), 'statistics disclosure');
const more = document.querySelector('.overview-more'); more.open = true; more.dispatchEvent(new Event('toggle'));
await until(() => document.querySelector('.training-mode-statistics'), 'training statistics'); assert.match(document.querySelector('.training-statistics').textContent, /输入正确率/);
console.log('PASS mounted Vue: unified tabs and shared progress, hidden dictation target, native input/caret/IME, per-mode drafts, listening completion, hinted extra dictation counted once');
console.log('PASS sentence input/self-review preserved, independent dictation entry retained, mode double clicks blocked, cached same-day GET restore, server training statistics');
console.log('PASS persisted recognition phase without duplicate reveal, completion labels, item pagination, hidden pending/skipped answers, historical and unavailable extra entries');
app.unmount(); await window.happyDOM.close();
console.log('Workspace checks passed with explicit HTTP fixtures; physical browser/layout and real API integration remain separate.');
