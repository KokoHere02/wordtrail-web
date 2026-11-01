// Real Vue rendering with explicit API fixtures; this does not verify browser geometry.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';
import { AxiosError } from 'axios';
const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
}
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div><div id="meaning-test"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', define: { 'import.meta.env.VITE_UI_PREVIEW': '"false"' }, logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-translation-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/translation-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { app, router, http, api, dailyApi, WordMeaning, hasTranslation, parseLegacyMeaning, splitMeaningItems, WordPronunciation, WordExample } = await import('../.qa-translation-dist/ui.js');
const { createApp, h, ref, nextTick } = await import('vue');
const document = window.document;
const props = ref({ translation: 'adj. 原文\\n未解析\n仍是原文' });
const component = createApp({ setup: () => () => h(WordMeaning, props.value) });
component.mount('#meaning-test');
const root = document.querySelector('#meaning-test');
assert.equal(root.querySelector('.translation-legacy').textContent, props.value.translation);
assert.equal(root.querySelector('.translation-part-of-speech'), null);
props.value = { translation: '禁止回退', translationGroups: [] };
await nextTick();
assert.equal(root.textContent, '暂无释义');
const groups = [
  { partOfSpeech: 'adj. & adv.', meaning: '联合词性' },
  { partOfSpeech: null, meaning: '无词性正文\\n保留字面内容\n保留换行' },
  { partOfSpeech: 'custom/POS', meaning: '<img src=x onerror=alert(1)>' + '很长的释义'.repeat(90) },
  { partOfSpeech: 'adj. & adv.', meaning: '同词性仍独立显示' },
];
props.value = { translation: '禁止回退', translationGroups: groups, layout: 'study' };
await nextTick();
assert.equal(root.querySelectorAll('.translation-group').length, 4);
assert.equal(root.querySelector('.translation-expand'), null, 'short meanings do not hide complete POS rows');
assert.deepEqual([...root.querySelectorAll('.translation-meaning')].map(node => node.textContent), groups.map(group => group.meaning));
assert.deepEqual([...root.querySelectorAll('.translation-part-of-speech')].map(node => node.textContent), ['adj. & adv.', 'custom/POS', 'adj. & adv.']);
assert.equal(root.querySelectorAll('.translation-group')[1].querySelector('.translation-part-of-speech'), null);
assert.equal(root.querySelector('img'), null);
const longMeaning = '州；状态（condition, situation）；情形；国家；“一，二”；U.S.A. e.g. 3.14；最后一项';
assert.equal(splitMeaningItems(longMeaning).join(''), longMeaning);
assert.equal(splitMeaningItems(longMeaning).length, 7);
assert.deepEqual(splitMeaningItems('不平衡（甲，乙，丙；丁'), ['不平衡（甲，乙，丙；丁']);
assert.deepEqual(splitMeaningItems('完整短句 e.g. U.S.A. 3.14'), ['完整短句 e.g. U.S.A. 3.14']);
assert.deepEqual(splitMeaningItems('1,000 个；3,14'), ['1,000 个；', '3,14']);
props.value = { layout: 'study', wordKey: 1, translationGroups: [{ partOfSpeech: 'n.', meaning: longMeaning }, { partOfSpeech: null, meaning: '[计] 状态；说明' }, { partOfSpeech: 'a.', meaning: '国家的' }] };
await nextTick();
assert.equal(root.querySelector('.translation-more').textContent, '另有 3 项释义');
assert.equal(root.querySelector('.professional-toggle').getAttribute('aria-expanded'), 'false');
assert.equal(root.querySelectorAll('.translation-part-of-speech')[1].textContent, 'adj.');
root.querySelector('.professional-toggle').click(); await nextTick();
assert.equal(root.querySelector('.translation-professional .translation-meaning').textContent, '状态；说明');
root.querySelector('.translation-expand').click(); await nextTick();
assert.equal(root.querySelector('.translation-meaning').textContent, longMeaning);
assert.equal(root.querySelector('.translation-more'), null);
root.querySelector('.translation-expand').click(); await nextTick();
assert.equal(root.querySelector('.translation-more').textContent, '另有 3 项释义');
root.querySelector('.translation-expand').click(); await nextTick();
props.value = { ...props.value, wordKey: 2 }; await nextTick();
assert.equal(root.querySelector('.translation-expand').getAttribute('aria-expanded'), 'false', 'identical definitions on a different word reset');
assert.equal(root.querySelector('.professional-toggle').getAttribute('aria-expanded'), 'false');
const legacy = 'n. 州；状态\\na. 国家的\\nvt. 说明 v. 陈述\\n[计] 状态';
const parsed = parseLegacyMeaning(legacy);
assert.deepEqual(parsed.map(group => group.partOfSpeech), ['n.', 'a.', 'vt.', 'v.', null]);
assert.equal(parseLegacyMeaning('n.州\\nvi.运行').length, 2);
assert.equal(parseLegacyMeaning('n. \na. 国家'), null);
assert.equal(parseLegacyMeaning('xyz. 未知标记\\nU.S.A. e.g. 3.14'), null);
props.value = { layout: 'study', translation: legacy }; await nextTick();
assert.deepEqual([...root.querySelectorAll('.translation-part-of-speech')].map(node => node.textContent), ['n.', 'adj.', 'vt.', 'v.']);
props.value = { layout: 'study', translation: 'n. \na. 国家' }; await nextTick();
assert.equal(root.querySelector('.translation-legacy').textContent, 'n. \na. 国家');
props.value = { translationGroups: [{ partOfSpeech: null, meaning: '下一次响应' }], layout: 'study' };
await nextTick();
assert.equal(root.querySelector('.translation-expand'), null);
assert.equal(root.querySelector('.translation-meaning').textContent, '下一次响应');
assert.equal(hasTranslation({}), false);
assert.equal(hasTranslation({ translationGroups: [] }), true);
assert.equal(hasTranslation({ translation: null }), true);
component.unmount();
const exampleProps = ref({ example: 'Please state your name.', exampleZh: '请说出你的姓名。' });
const exampleApp = createApp({ setup: () => () => h(WordExample, exampleProps.value) });
exampleApp.mount('#meaning-test');
assert.equal(root.querySelector('[lang="en"]').textContent, exampleProps.value.example);
assert.equal(root.querySelector('.review-example-translation').textContent, exampleProps.value.exampleZh);
exampleProps.value = { example: '', exampleZh: '不能单独捏造英文' }; await nextTick();
assert.equal(root.querySelector('blockquote'), null);
exampleApp.unmount();
const audioFixture = http.defaults.adapter, players = [];
let settingsReady = false;
globalThis.Audio = class {
  constructor(src) { this.src = src; this.playbackRate = 1; this.currentTime = 0; this.readyState = 4; players.push(this); }
  play() { return Promise.resolve(); }
  pause() {} removeAttribute() {} load() {}
};
http.defaults.adapter = async config => {
  if (config.url === '/learning/settings') {
    settingsReady = true;
    return { config, status: 200, headers: {}, data: { code: 'OK', data: { dailyTarget: 20, newWordTarget: null, reviewLimit: null, pronunciation: { autoPlay: false, accent: 'US', playbackRate: 1, repeatCount: 1 } } } };
  }
  if (config.url.includes('/audio?')) return { config, status: 200, headers: { 'content-type': 'audio/mpeg' }, data: new Blob(['explicit audio fixture'], { type: 'audio/mpeg' }) };
  return audioFixture(config);
};
const audioProps = ref({ word: 'state', wordId: 101, phonetic: '/steɪt/', wordKey: 1 });
const audioApp = createApp({ setup: () => () => h(WordPronunciation, audioProps.value) });
audioApp.mount('#meaning-test');
await until(() => settingsReady, 'audio settings'); await new Promise(resolve => setTimeout(resolve, 0));
root.querySelector('button').click();
await until(() => root.querySelector('button').getAttribute('aria-pressed') === 'true', 'Blob audio playback');
assert.match(players.at(-1).src, /^blob:/);
players.at(-1).onended(); await nextTick();
assert.equal(root.querySelector('button').getAttribute('aria-pressed'), 'false');
audioProps.value = { word: 'antidisestablishmentarianism', wordId: 102, phonetic: null, wordKey: 2 }; await nextTick();
assert.equal(root.querySelector('.review-phonetic'), null);
root.querySelector('button').click(); await until(() => root.querySelector('button').getAttribute('aria-pressed') === 'true', 'next word audio');
players.at(-1).onerror(); await nextTick(); assert.match(root.querySelector('[role="status"]').textContent, /重试/);
audioApp.unmount(); http.defaults.adapter = audioFixture;
console.log('PASS grouped/legacy meanings, four-item previews, professional/all expansion, lossless punctuation, reset, examples and authenticated audio event wiring');

const fixture = http.defaults.adapter;
const marker = [{ partOfSpeech: 'n. & v.', meaning: '服务端分组释义' }, { partOfSpeech: null, meaning: '服务端第二组' }];
let answerMode = 'groups';
const writes = [];
function enrich(value) {
  if (!value || typeof value !== 'object') return;
  if ('translation' in value) { value.translation = '旧字段不应显示'; value.translationGroups = marker; }
  for (const child of Object.values(value)) if (child && typeof child === 'object') enrich(child);
}
http.defaults.adapter = async config => {
  const response = await fixture(config);
  enrich(response.data.data);
  if (/\/(answer|correction)$/.test(config.url)) {
    writes.push({ url: config.url, body: config.data });
    const saved = response.data.data;
    delete saved.translation;
    delete saved.translationGroups;
    if (answerMode === 'groups') saved.translationGroups = marker;
    if (answerMode === 'legacy') saved.translation = '最新旧版释义';
    if (answerMode === 'empty') { saved.translationGroups = []; saved.translation = '禁止回退'; }
  }
  return response;
};
async function until(predicate, label) {
  const deadline = Date.now() + 9000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}\n${document.body.textContent}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
function input(selector, value) { const element = document.querySelector(selector); assert.ok(element, selector); element.value = value; element.dispatchEvent(new window.Event('input', { bubbles: true })); }
function button(text) { return [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text || node.matches('.recall-card') && node.querySelector('strong')?.textContent === text); }
async function click(text) { await until(() => button(text)?.disabled === false, `enabled ${text}`); button(text).click(); }
async function expectGroups(selector) {
  await until(() => document.querySelector(`${selector} .translation-meaning`)?.textContent === marker[0].meaning, `groups in ${selector}`);
  assert.equal(document.querySelector(selector).textContent.includes('旧字段不应显示'), false);
}
await until(() => document.querySelector('#username'), 'login');
input('#username', 'translation_reader'); input('#password', 'example123'); await click('登录');
await until(() => document.querySelector('.daily-equation'), 'authenticated');
await router.push('/books/1'); await expectGroups('.preview-word-row');
const personal = await api.createBook({ name: '分组释义词本', description: null });
await api.collectWords(personal.id, [1001]);
await router.push(`/books/${personal.id}`); await expectGroups('.preview-word-row');
await click('搜索收词'); await until(() => document.querySelector('input[aria-label="搜索全局词库"]'), 'dictionary');
input('input[aria-label="搜索全局词库"]', 'ab'); await click('搜索词库'); await expectGroups('.dictionary-word');
await click('关闭');
await router.push('/words/1001'); await expectGroups('.word-detail-translation');
await dailyApi.join(1, [1001]);
await router.push('/plan'); await expectGroups('.plan-word');
console.log('PASS dictionary, system/personal books, word detail and plan consume server groups');

// Current DAILY uses presentation snapshots, not the retired dictionary-GET reveal flow.
const daily = await dailyApi.start();
const withMarkers = http.defaults.adapter;
let trainingCount = 0, revealed = false;
const trainingWrites = [], dictionaryReads = [];
const modernProgress = () => ({ batchId: daily.batchId, learningDate: '2026-10-27', taskType: 'DAILY', dailyTarget: 3, totalCount: 3, completedCount: 0, skippedCount: 0, answerCount: 0, unfamiliarCount: 0, newCount: 3, reviewCount: 0, nextItemId: 801, status: 'IN_PROGRESS', studyMode: 'RECOGNITION', modeVersion: 0, trainingCount });
const meaningSnapshot = () => answerMode === 'groups' ? { translationGroups: marker } : answerMode === 'legacy' ? { translation: '最新旧版释义' } : answerMode === 'empty' ? { translationGroups: [], translation: '禁止回退' } : {};
http.defaults.adapter = async config => {
  const ok = data => ({ config, status: 200, headers: {}, data: { code: 'OK', data: structuredClone(data) } });
  if (/^\/words\/\d+$/.test(config.url)) dictionaryReads.push(config.url);
  if (config.url === '/learning/today') return ok({ learningDate: '2026-10-27', dailyTarget: 3, activeCount: 3, dueCount: 0, newCount: 3, canAddMore: false, unassignedCount: 0, task: modernProgress() });
  if (config.url === `/learning-batches/${daily.batchId}/daily`) return ok(modernProgress());
  if (config.url.endsWith('/daily/training/next')) return ok({ itemId: 801, wordId: 1001, word: 'abandon', mode: 'RECOGNITION', modeVersion: 0, presentationId: `translation-${trainingCount}`, attemptNo: trainingCount + 1, phase: revealed ? 'AWAITING_SELF_ASSESSMENT' : 'QUESTION', answerRevealed: revealed, hintUsed: true, itemStatus: 'PENDING', completionReason: null, extraTraining: false, ...(revealed ? meaningSnapshot() : {}), progress: modernProgress() });
  if (config.url.endsWith('/training-answer')) {
    const body = JSON.parse(config.data); trainingWrites.push(body); trainingCount++; revealed = body.action === 'REVEAL';
    return ok({ trainingId: trainingCount, itemId: 801, wordId: 1001, mode: 'RECOGNITION', action: body.action, verdict: revealed ? 'REVEALED' : 'SELF_ASSESSED', input: null, selfAssessment: body.result ?? null, word: 'abandon', hintUsed: true, extraTraining: false, attemptNo: body.attemptNo, reviewLogId: null, affectsSchedule: false, itemStatus: 'PENDING', completionReason: null, answeredAt: '2026-10-27T12:00:00', ...meaningSnapshot(), progress: modernProgress() });
  }
  return withMarkers(config);
};
await router.push(`/learn/${daily.batchId}`);
await until(() => document.querySelector('.daily-training-rating button')?.disabled === false, 'unified daily ready');
assert.equal(document.querySelector('.daily-training-card .word-meaning'), null);
document.querySelector('.daily-recall-prompt').click(); await expectGroups('.daily-training-card');
const revealCount = trainingWrites.length;
await router.push('/today'); await router.push(`/learn/${daily.batchId}`); await new Promise(resolve => setTimeout(resolve, 0)); await expectGroups('.daily-training-card');
await until(() => document.querySelector('.daily-training-rating button')?.disabled === false, 'restored recognition enabled');
assert.equal(trainingWrites.length, revealCount, 'restoring a snapshot never reveals again');
for (const variant of ['groups', 'legacy', 'missing', 'empty']) {
  answerMode = variant;
  document.querySelector('.daily-training-rating button:last-child').click();
  await until(() => document.querySelector('.daily-training-feedback'), `feedback ${variant}`);
  if (variant === 'groups') await expectGroups('.daily-training-feedback');
  else if (variant === 'legacy') assert.equal(document.querySelector('.daily-training-feedback .translation-legacy').textContent, '最新旧版释义');
  else assert.equal(document.querySelector(`.daily-training-feedback ${variant === 'missing' ? '.translation-legacy' : '.translation-empty'}`).textContent, '暂无释义');
  if (variant !== 'groups') assert.equal(document.querySelector('.daily-training-feedback .translation-group'), null, 'latest snapshot never reuses an earlier group');
  document.querySelector('.daily-training-feedback > .btn').click();
  await until(() => document.querySelector('.daily-training-rating button')?.disabled === false, 'next question');
  assert.equal(document.querySelector('.daily-training-card .word-meaning'), null);
}
assert.equal(dictionaryReads.length, 0, 'unified training only uses backend presentation snapshots');
console.log('PASS unified DAILY snapshot reveal/restore, grouped/legacy/missing/empty feedback and no stale definition reuse');

app.unmount(); await window.happyDOM.close();
