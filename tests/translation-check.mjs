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
const utterances = [];
Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel() {}, getVoices: () => [], speak: utterance => utterances.push(utterance) } });
Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text; } } });
const audioProps = ref({ word: 'state', phonetic: '/steɪt/', wordKey: 1 });
const audioApp = createApp({ setup: () => () => h(WordPronunciation, audioProps.value) });
audioApp.mount('#meaning-test');
root.querySelector('button').click(); await nextTick();
assert.equal(utterances.at(-1).text, 'state');
assert.equal(root.querySelector('button').getAttribute('aria-pressed'), 'true');
utterances.at(-1).onend(); await nextTick();
assert.equal(root.querySelector('button').getAttribute('aria-pressed'), 'false');
audioProps.value = { word: 'antidisestablishmentarianism', phonetic: null, wordKey: 2 }; await nextTick();
assert.equal(root.querySelector('.review-phonetic'), null);
root.querySelector('button').click(); await nextTick();
assert.equal(utterances.at(-1).text, audioProps.value.word);
delete window.speechSynthesis;
root.querySelector('button').click(); await nextTick();
assert.match(root.querySelector('[role="status"]').textContent, /暂不支持/);
Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel() {}, getVoices: () => [], speak: utterance => utterances.push(utterance) } });
audioApp.unmount();
console.log('PASS grouped/legacy meanings, four-item previews, professional/all expansion, lossless punctuation, reset, examples and real speech event wiring');

const fixture = http.defaults.adapter;
const marker = [{ partOfSpeech: 'n. & v.', meaning: '服务端分组释义' }, { partOfSpeech: null, meaning: '服务端第二组' }];
let answerMode = 'groups';
let loseAnswer = false;
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
    if (loseAnswer) { loseAnswer = false; throw new AxiosError('lost response', 'ECONNABORTED', config); }
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

const daily = await dailyApi.start();
await router.push(`/learn/${daily.batchId}`);
await until(() => document.querySelector('.recall-known')?.disabled === false, 'daily ready');
assert.ok(document.querySelector('.main-nav'), 'learning reuses homepage navigation');
assert.equal(document.querySelector('.learning-header a[aria-label="退出本轮学习"]').getAttribute('href'), '/today');
assert.equal(document.querySelector('.learning-progress [role="progressbar"]').getAttribute('aria-valuenow'), '0');
assert.match(document.querySelector('.review-progress-count').textContent, /剩余 1 词/);
assert.deepEqual([...document.querySelectorAll('.learning-rating button')].map(node => node.getAttribute('aria-pressed')), ['false', 'false', 'false']);
const definitionsBeforeReveal = [];
let failReveal = true;
const originalWithMarkers = http.defaults.adapter;
http.defaults.adapter = async config => {
  if (/^\/words\/\d+$/.test(config.url)) {
    definitionsBeforeReveal.push(config.url);
    if (failReveal) { failReveal = false; throw new AxiosError('dictionary unavailable', 'ERR_NETWORK', config); }
  }
  return originalWithMarkers(config);
};
assert.equal(document.querySelector('.memory-meaning'), null);
const speechBefore = utterances.length;
document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'p', code: 'KeyP', bubbles: true }));
await nextTick();
assert.equal(utterances.length, speechBefore + 1);
assert.equal(utterances.at(-1).text, 'abandon');
assert.equal(definitionsBeforeReveal.length, 0, 'P never reveals the answer');
const answersBeforeReveal = writes.length;
document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
await until(() => document.querySelector('.learning-state[role="alert"]'), 'reveal GET failure stays on word');
assert.equal(writes.length, answersBeforeReveal);
assert.equal(document.querySelector('.learning-word').textContent, 'abandon');
await click('重新加载释义');
await expectGroups('.memory-meaning');
assert.equal(definitionsBeforeReveal.length, 2);
assert.equal(writes.length, answersBeforeReveal, 'Space uses read-only word detail');
assert.equal((await dailyApi.task(daily.batchId)).answerCount, 0);
document.querySelector('button[aria-label="切换深色主题"]').click(); await nextTick();
assert.equal(document.documentElement.dataset.theme, 'dark');
document.querySelector('button[aria-label="切换浅色主题"]').click(); await nextTick();
assert.equal(document.documentElement.dataset.theme, 'light');
await click('认识');
await until(() => button('完成本轮')?.disabled === false, 'last word retains completion action');
await expectGroups('.memory-meaning');
answerMode = 'legacy'; await click('记错了'); await click('改为不认识');
await until(() => document.querySelector('.memory-meaning .translation-legacy')?.textContent === '最新旧版释义', 'daily correction stays revealed');
await click('下一词');
await until(() => document.querySelector('.recall-known')?.disabled === false, 'corrected daily word reappears after manual next');
assert.equal(document.querySelector('.memory-meaning'), null);
assert.equal((await dailyApi.task(daily.batchId)).answerCount, 1);
await click('上一词');
await until(() => document.querySelector('.memory-meaning .translation-legacy')?.textContent === '最新旧版释义', 'daily history uses latest correction');
assert.equal(document.querySelector('.recall-known').disabled, true, 'history cannot submit a second normal answer');
await click('下一词'); await until(() => document.querySelector('.recall-known')?.disabled === false, 'return to current queue');
assert.equal(document.querySelector('.memory-meaning'), null);
answerMode = 'missing'; await click('认识');
await until(() => document.querySelector('.meaning-placeholder')?.textContent.includes('释义暂未返回'), 'known validation waits on its saved answer');
await click('下一词');
await until(() => document.querySelector('.recall-known')?.disabled === false && button('上一词')?.disabled === false, 'manual next reaches another attempt');
await click('上一词');
await until(() => document.querySelector('.meaning-placeholder')?.textContent.includes('释义暂未返回'), 'history with missing latest fields stays empty');
assert.equal(document.querySelector('.memory-meaning'), null);
answerMode = 'groups'; await click('记错了'); await click('改为不认识');
await expectGroups('.memory-meaning');
await click('下一词');
await until(() => document.querySelector('.recall-known')?.disabled === false, 'manual next after history correction returns to server queue');
assert.equal((await dailyApi.task(daily.batchId)).answerCount, 2);
const writesBeforeRefresh = writes.length;
await router.push('/today'); await until(() => document.querySelector('.daily-equation'), 'leave daily');
await router.push(`/learn/${daily.batchId}`); await until(() => document.querySelector('.recall-known')?.disabled === false, 'GET daily restore');
assert.equal(document.querySelector('.memory-meaning'), null);
assert.equal(writes.length, writesBeforeRefresh);
await router.push('/weak-words'); await expectGroups('.weak-word-copy');
await router.push('/statistics'); await expectGroups('.statistics-word-row');
console.log('PASS P-only speech, explicit Space GET, no automatic reveal, daily history/correction, repeated attempts, GET restore and unchanged definition rendering');

const batch = await api.create({ bookId: 1, selectionType: 'MANUAL', wordIds: [1001, 1002, 1003] });
await router.push(`/study/${batch.batchId}`);
await until(() => document.querySelector('.study-word')?.textContent === 'abandon', 'practice ready');
await until(() => document.querySelector('.learning-rating button')?.disabled === false, 'practice accepts shortcuts');
assert.equal(document.querySelector('.site-header .main-nav a.active')?.textContent, '学习');
assert.equal(document.querySelector('.study-meaning'), null);
answerMode = 'groups'; loseAnswer = true;
document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: '3', bubbles: true }));
await until(() => document.querySelector('.form-error')?.textContent.includes('请求超时'), 'failed answer');
assert.equal(document.querySelector('.study-meaning'), null);
assert.equal(document.querySelector('.study-word').textContent, 'abandon');
const pendingWrites = writes.length;
document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1', bubbles: true })); await nextTick();
assert.equal(writes.length, pendingWrites);
await click('重试原请求');
await expectGroups('.study-meaning');
assert.equal(document.querySelector('.study-word').textContent, 'abandon', 'saved retry stays on current answer');
assert.equal(writes.at(-1).body, writes.at(-2).body, 'same requestId on retry');
await click('下一词');
await until(() => document.querySelector('.study-word')?.textContent === 'absorb', 'practice advances on manual next');
assert.equal(document.querySelector('.study-meaning'), null);
await click('上一词'); await expectGroups('.study-meaning');
answerMode = 'legacy'; await click('记错了'); await click('改为不认识');
await until(() => document.querySelector('.study-meaning .translation-legacy')?.textContent === '最新旧版释义', 'corrected past practice stays revealed');
await click('下一词');
await until(() => document.querySelector('.study-word')?.textContent === 'absorb' && document.querySelector('.learning-rating button')?.disabled === false, 'manual next after corrected past practice returns to queue');
await click('上一词');
await until(() => document.querySelector('.study-meaning .translation-legacy')?.textContent === '最新旧版释义', 'practice correction clears groups');
await click('下一词'); await until(() => document.querySelector('.learning-rating button')?.disabled === false, 'current second practice');
answerMode = 'groups'; await click('认识');
await expectGroups('.study-meaning');
assert.equal(document.querySelector('.study-word').textContent, 'absorb');
await click('下一词');
await until(() => document.querySelector('.study-word')?.textContent === 'abstract', 'second answer advances on manual next');
await click('上一词'); await expectGroups('.study-meaning');
answerMode = 'missing'; await click('记错了'); await click('改为不认识');
await until(() => document.querySelector('.meaning-placeholder')?.textContent.includes('释义暂未返回'), 'missing corrected response stays on current word');
await click('下一词');
await until(() => document.querySelector('.study-word')?.textContent === 'abstract' && document.querySelector('.learning-rating button')?.disabled === false, 'manual next after missing correction');
await click('上一词');
await until(() => document.querySelector('.meaning-placeholder')?.textContent.includes('释义暂未返回'), 'no stale definition in practice history');
await click('下一词');
await router.push('/learning'); await until(() => document.querySelector('.batch-card'), 'leave practice');
await router.push(`/study/${batch.batchId}`); await until(() => document.querySelector('.study-word')?.textContent === 'abstract', 'GET practice restore');
assert.equal(document.querySelector('.study-meaning'), null);
answerMode = 'empty'; await click('认识');
await until(() => document.querySelector('.study-meaning .translation-empty')?.textContent === '暂无释义', 'explicit empty terminal answer');
await click('完成本轮'); await expectGroups('.result-row');
console.log('PASS saved answer waits for manual next, readonly previous/forward, stable retries, latest correction, null fields and empty groups');

// All three feedback choices reveal their saved answer and wait for an explicit keyboard next.
const manualBatch = await api.create({ bookId: 1, selectionType: 'MANUAL', wordIds: [1001, 1002, 1003] });
await router.push(`/study/${manualBatch.batchId}`);
answerMode = 'groups';
for (const [index, key] of ['1', '2', '3'].entries()) {
  await until(() => document.querySelector('.answer-button')?.disabled === false, `manual choice ${key} ready`);
  const encounter = document.querySelector('.learning-card').dataset.wordKey;
  const count = writes.length;
  document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
  await expectGroups('.study-meaning');
  assert.equal(document.querySelector('.learning-card').dataset.wordKey, encounter, `choice ${key} does not advance`);
  assert.equal((await api.progress(manualBatch.batchId)).answeredCount, index + 1);
  assert.equal(writes.length, count + 1);
  const nextButton = button(index === 2 ? '完成本轮' : '下一词');
  await until(() => nextButton.disabled === false, 'manual next enabled');
  document.querySelector('.answer-button').focus();
  document.querySelector('.answer-button').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  if (index < 2) {
    await until(() => document.querySelector('.learning-card')?.dataset.wordKey !== encounter && document.querySelector('.answer-button')?.disabled === false, 'arrow next works with focus on rating button');
    assert.equal(document.querySelector('.study-meaning'), null);
  } else await until(() => document.querySelector('.result-stats'), 'arrow completes final answer');
  assert.equal(writes.length, count + 1, 'next never submits a second answer');
}
console.log('PASS all three choices reveal before keyboard next, including focused rating controls');

// Correction is an explicit choice, not a second normal answer or an immediate downgrade.
const correctionBatch = await api.create({ bookId: 1, selectionType: 'MANUAL', wordIds: [1001, 1002] });
async function press(key, target = document.body) {
  target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
  await nextTick();
}
for (const source of ['daily', 'practice']) {
  const batchId = source === 'daily' ? daily.batchId : correctionBatch.batchId;
  await router.push(source === 'daily' ? `/learn/${batchId}` : `/study/${batchId}`);
  const readProgress = () => source === 'daily' ? dailyApi.task(batchId) : api.progress(batchId);
  const countAnswers = value => source === 'daily' ? value.answerCount : value.answeredCount;
  for (const result of [2, 3]) {
    await until(() => document.querySelector('.learning-rating button')?.disabled === false, `${source} correction fixture ready`);
    const beforeAnswer = writes.length;
    await press('r');
    assert.equal(document.querySelector('.learning-correction-choices'), null, 'R cannot correct an unanswered word');
    assert.equal(writes.length, beforeAnswer);
    await press('3');
    await until(() => button('记错了')?.disabled === false, `${source} known answer saved`);
    const encounter = document.querySelector('.learning-card').dataset.wordKey;
    const normalBody = JSON.parse(writes.at(-1).body);
    const answered = countAnswers(await readProgress());
    const itemId = Number(encounter.split(':')[1]);
    const originalLogId = source === 'daily' ? (await dailyApi.item(batchId, itemId)).correctableLogId : undefined;
    const beforeCorrection = writes.length;
    await press('R');
    assert.ok(document.querySelector('.learning-correction-choices'));
    assert.equal(writes.length, beforeCorrection, 'opening correction never submits');
    await press('Escape');
    assert.equal(document.querySelector('.learning-correction-choices'), null);
    assert.equal(writes.length, beforeCorrection, 'cancel never submits');
    const trigger = button('记错了'); trigger.focus();
    await press('r', trigger);
    assert.ok(document.querySelector('.learning-correction-choices'));
    loseAnswer = result === 2;
    if (result === 2) {
      await press('2', trigger);
      await until(() => document.querySelector('.learning-error')?.textContent.includes('请求超时'), `${source} correction outcome unknown`);
      assert.equal(button('下一词')?.disabled ?? button('完成本轮')?.disabled, true);
      await press('1'); await press('r');
      assert.equal(writes.length, beforeCorrection + 1, 'pending correction cannot change its result');
      await click('重试原请求');
      await until(() => document.querySelector('.recall-uncertain')?.getAttribute('aria-pressed') === 'true', `${source} uncertain correction retried`);
      assert.equal(writes.at(-1).body, writes.at(-2).body, 'correction retry retains result and requestId');
    } else {
      // Mouse selection shares the same choice logic as the numeric shortcuts.
      await click('改为不认识');
      await until(() => document.querySelector('.recall-forgot')?.getAttribute('aria-pressed') === 'true', `${source} unknown correction saved`);
    }
    const correctionBody = JSON.parse(writes.at(-1).body);
    assert.equal(correctionBody.result, result);
    assert.notEqual(correctionBody.requestId, normalBody.requestId);
    if (source === 'daily') {
      assert.equal(correctionBody.logId, originalLogId, 'daily correction references the original ANSWER');
      assert.ok(writes.at(-1).url.endsWith('/correction'));
    }
    assert.equal(countAnswers(await readProgress()), answered, 'correction does not count as a normal answer');
    assert.equal(document.querySelector('.learning-card').dataset.wordKey, encounter, 'correction waits for manual next');
    await expectGroups(source === 'daily' ? '.memory-meaning' : '.study-meaning');
    if (result === 2) {
      await click('下一词');
      await until(() => document.querySelector('.learning-card')?.dataset.wordKey !== encounter && document.querySelector('.learning-rating button')?.disabled === false, 'manual next after correction');
      assert.equal(document.querySelector('.learning-correction-choices'), null, 'next word resets correction mode');
    }
  }
}
console.log('PASS DAILY/PRACTICE correction choices: R, 1/2, Escape, mouse, stable retry, original log and unchanged answer counts');
const leaveBatch = await api.create({ bookId: 1, selectionType: 'MANUAL', wordIds: [1001, 1002] });
await router.push(`/study/${leaveBatch.batchId}`);
await until(() => document.querySelector('.answer-button')?.disabled === false, 'leave-during-save fixture');
const beforeLeaveAdapter = http.defaults.adapter;
let releaseSave;
let waiting = false;
const queueReadsAfterLeave = [];
http.defaults.adapter = async config => {
  if (config.url.endsWith('/answer')) {
    const result = await beforeLeaveAdapter(config);
    waiting = true;
    await new Promise(resolve => { releaseSave = resolve; });
    return result;
  }
  if (waiting && config.url.includes(`/learning-batches/${leaveBatch.batchId}/items/`)) queueReadsAfterLeave.push(config.url);
  return beforeLeaveAdapter(config);
};
await click('认识');
await until(() => waiting && releaseSave, 'save response delayed after commit');
await router.push('/books'); await until(() => document.querySelector('.library-grid'), 'left learning before response');
releaseSave();
await until(() => !document.querySelector('.study-word'), 'old study unmounted');
assert.equal((await api.progress(leaveBatch.batchId)).answeredCount, 1);
assert.equal(router.currentRoute.value.path, '/books');
assert.equal(queueReadsAfterLeave.length, 0, 'an unmounted save never auto-advances or hijacks navigation');
http.defaults.adapter = beforeLeaveAdapter;
app.unmount();
await window.happyDOM.close();
