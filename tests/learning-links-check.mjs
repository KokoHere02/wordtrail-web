import { chooseSelect } from './helpers/choose-select.mjs';
// Actual Vue pages against explicit Section 25–27 fixtures. No production writes.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';
import { AxiosError } from 'axios';
const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window); globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-sentences-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/sentences-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { router, http, app, useAuthStore, tokens } = await import('../.qa-sentences-dist/ui.js');
const document = window.document, base = '/sentence-translation';
const clone = value => JSON.parse(JSON.stringify(value));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, label) { const end = Date.now() + 8000; while (!test()) { if (Date.now() > end) throw new Error(`Timeout: ${label}\n${document.body.textContent}`); await delay(10); } }
function input(selector, value) { const node = document.querySelector(selector); assert.ok(node, selector); node.value = value; node.dispatchEvent(new window.Event('input', { bubbles: true })); node.dispatchEvent(new window.Event('change', { bubbles: true })); }
function button(text) { return [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text); }
async function click(text) { await until(() => button(text) && !button(text).disabled && !button(text).closest('fieldset:disabled'), text); button(text).click(); }
async function go(path, selector) { await router.push(path); await until(() => document.querySelector(selector), path); }
function close() { document.querySelector('[aria-label="关闭弹窗"]').click(); }
const calls = [], notes = new Map();
const emptyNote = () => ({ content: '', errorTags: [], attemptId: null, version: 0, updatedAt: null });
const getNote = id => notes.get(id) || emptyNote();
const weak = Array.from({ length: 12 }, (_, i) => ({ wordId: 1001 + i, word: `weakword${i}`, phonetic: null, translation: 'n. 测试词', source: 'DAILY', lastResult: 3, lastAnswerLogId: 20 + i, learningDate: '2026-10-24', lastAnsweredAt: '2026-10-24T12:00:00', answerCount: 1, statisticsComplete: true }));
const questions = Array.from({ length: 6 }, (_, i) => ({ sentenceId: i + 1, englishText: `A linked sentence ${i + 1}.`, difficulty: 1, source: '原创', sourceReference: null, favorite: false }));
let phase = 'PENDING', created = false, lostCreate = false, noLinks = false, noteConflict = false, failSummary = false, collectError, failSessions = false, badPassword = false, unknownSecurity = false, legacy = false, issued = 0;
const devices = [ { sessionId: '000000000000000000000000000000ab', deviceName: '我的自定义设备', current: true, createdAt: '2026-10-24T01:00:00', lastRefreshedAt: '2026-10-24T02:00:00Z', expiresAt: '2026-11-24T01:00:00' }, { sessionId: '000000000000000000000000000000cd', deviceName: '另一设备', current: false, createdAt: '2026-10-20T01:00:00', lastRefreshedAt: '2026-10-23T02:00:00', expiresAt: '2026-11-20T01:00:00' } ];
const pageOf = (records, params) => ({ page: params.page, size: params.size, total: records.length, records: records.slice((params.page - 1) * params.size, params.page * params.size) });
const progress = () => ({ sessionId: 650, selectionSource: 'BANK', status: 'IN_PROGRESS', totalCount: 2, submissionCount: phase === 'PENDING' ? 0 : 1, answerCount: phase === 'PENDING' ? 0 : 1, revealCount: 0, selfReviewCount: 0, completedCount: 0, understoodCount: 0, partialCount: 0, notUnderstoodCount: 0, nextItemId: 850, createdAt: '2026-10-24T12:00:00', completedAt: null });
const fallback = http.defaults.adapter;
function ok(config, data, status = 200) { return { config, status, headers: {}, data: { code: 'OK', message: '成功', data: clone(data) } }; }
function reject(config, code, status = 409) { throw new AxiosError('fixture failure', 'ERR_BAD_RESPONSE', config, undefined, { config, status, headers: {}, data: { code, message: code, data: null } }); }
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  calls.push({ url: config.url, method: config.method, params: clone(config.params || {}), body: clone(body ?? null), authorization: config.headers.has('Authorization') });
  if (config.url === '/auth/sessions') { if (failSessions) { failSessions = false; reject(config, 'TEMPORARY', 503); } return ok(config, pageOf(devices, config.params)); }
  if (/^\/auth\/sessions\/.+\/revoke$/.test(config.url)) { const id = config.url.split('/')[3]; const index = devices.findIndex(row => row.sessionId === id); if (index >= 0) devices.splice(index, 1); return ok(config, null); }
  if (['/auth/password', '/auth/logout-others'].includes(config.url)) {
    if (badPassword) { badPassword = false; reject(config, 'BAD_CREDENTIALS', 401); }
    if (unknownSecurity) { unknownSecurity = false; throw new AxiosError('lost security response', 'ECONNABORTED', config); }
    if (legacy && config.url.endsWith('logout-others')) { legacy = false; reject(config, 'AUTH_SESSION_UPGRADE_REQUIRED'); }
    if (config.url.endsWith('password')) return ok(config, null);
    return ok(config, { accessToken: `synthetic-rotated-${++issued}`, refreshToken: `synthetic-refresh-${issued}`, tokenType: 'Bearer', expiresIn: 1800, user: useAuthStore().user });
  }
  if (config.url === '/auth/refresh' && created) return ok(config, { accessToken: `synthetic-rotated-${++issued}`, refreshToken: `synthetic-refresh-${issued}`, tokenType: 'Bearer', expiresIn: 1800, user: useAuthStore().user });
  if (config.url === '/word-books' && config.params.scope === 'PERSONAL') return ok(config, pageOf([{ id: 301, name: '阅读生词', editable: true, bookType: 'PERSONAL' }, { id: 302, name: '不可写词本', editable: false, bookType: 'PERSONAL' }], config.params));
  if (config.url === '/learning/weak-words') return ok(config, { ...pageOf(weak, config.params), source: config.params.source, dataScope: 'RECORDED_EVENTS', statisticsComplete: true, incompleteWordCount: 0, firstRecordedAt: weak[0].lastAnsweredAt, lastRecordedAt: weak[0].lastAnsweredAt });
  if (/^\/words\/\d+\/sentences$/.test(config.url)) return ok(config, pageOf(noLinks ? [] : questions, config.params));
  if (config.url === `${base}/word-links/summary`) { if (failSummary) { failSummary = false; reject(config, 'TEMPORARY', 503); } return ok(config, body.wordIds.map((wordId, index) => ({ wordId, sentenceCount: index ? 0 : 6 }))); }
  if (config.url === `${base}/word-practice`) { created = true; if (lostCreate) { lostCreate = false; throw new AxiosError('lost create', 'ECONNABORTED', config); } return ok(config, progress(), 201); }
  if (config.url === `${base}/management/access`) return ok(config, { canManage: false });
  if (config.url === `${base}/sessions`) return ok(config, pageOf(created ? [progress()] : [], config.params));
  if (config.url === `${base}/sessions/650`) return ok(config, progress());
  if (config.url.endsWith('/current')) return ok(config, { itemId: 850, sentenceId: 1, status: phase, englishText: questions[0].englishText, difficulty: 1, source: '原创', sourceReference: null, linkedWords: [{ wordId: 1001, word: 'abandon snapshot' }], personalNote: getNote(1), attemptId: phase === 'PENDING' ? null : 777, action: phase === 'PENDING' ? null : 'ANSWER', translation: phase === 'PENDING' ? null : '我的中文草稿', referenceTranslation: phase === 'PENDING' ? null : '参考译文', explanation: phase === 'PENDING' ? null : '解析', selfAssessment: null, submittedAt: phase === 'PENDING' ? null : '2026-10-24T12:00:00' });
  if (config.url.endsWith('/submission')) { phase = 'AWAITING_REVIEW'; return ok(config, { progress: progress() }); }
  const noteMatch = config.url.match(/\/questions\/(\d+)\/note$/);
  if (noteMatch) {
    const id = Number(noteMatch[1]);
    if (config.method === 'get') return ok(config, getNote(id));
    assert.deepEqual(Object.keys(body).sort(), ['content', 'errorTags', 'attemptId', 'version'].sort());
    if (noteConflict) { noteConflict = false; notes.set(id, { ...getNote(id), content: '其他页面保存的笔记', version: getNote(id).version + 1 }); reject(config, 'SENTENCE_NOTE_VERSION_CONFLICT'); }
    assert.equal(body.version, getNote(id).version); assert.ok(body.attemptId === null || body.attemptId === 777);
    const value = { ...body, version: body.version + 1, updatedAt: '2026-10-24T12:05:00' }; notes.set(id, value); return ok(config, value);
  }
  if (config.url === `${base}/notes`) return ok(config, pageOf([...notes].filter(([, note]) => (note.content || note.errorTags.length) && (!config.params.errorTag || note.errorTags.includes(config.params.errorTag))).map(([sentenceId, note]) => ({ sentenceId, englishText: `Note sentence ${sentenceId}.`, available: sentenceId !== 1, note })), config.params));
  if (config.url.endsWith('/collect')) { if (collectError) { const code = collectError; collectError = undefined; reject(config, code, code === 'BOOK_READ_ONLY' ? 403 : 409); } return ok(config, { bookId: body.bookId, wordId: 1001, collection: { requestedCount: 1, changedCount: 1, unchangedCount: 0 }, plan: body.joinPlan ? { requestedCount: 1, addedCount: 0, reactivatedCount: 1, unchangedCount: 0 } : null }); }
  return fallback(config);
};
const writes = suffix => calls.filter(call => call.method !== 'get' && call.url.endsWith(suffix));
async function login() { input('#username', 'links_reader'); input('#password', 'example123'); input('#device-name', '我的笔记本'); await click('登录'); await until(() => document.querySelector('.daily-equation'), 'logged in'); }
await until(() => document.querySelector('#username'), 'login'); await login();
assert.equal(writes('/auth/login').at(-1).body.deviceName, '我的笔记本');
await go('/words/1001', '.word-sentences'); await until(() => document.querySelectorAll('.word-sentence-row').length === 5, 'linked sentences'); assert.equal(document.querySelector('.sentence-reference'), null);
document.querySelector('.word-sentences [aria-label="下一页"]').click(); await until(() => document.querySelectorAll('.word-sentence-row').length === 1, 'linked pagination');
noLinks = true; input('.word-sentences select', '2'); await until(() => document.querySelector('.word-sentences').textContent.includes('暂无关联句子'), 'no links'); assert.equal(button('练习关联句子').disabled, true); noLinks = false;
await go('/weak-words', '.weak-word-row');
assert.equal(document.querySelector('.weak-words-page .word-sentence-practice'), null);
assert.equal(document.querySelector('.weak-words-page input:not([type="checkbox"]), .weak-words-page select'), null);
assert.equal(document.querySelector('.weak-words-page').textContent.includes('关联句子'), false);
document.querySelector('.weak-words-sheet [aria-label="下一页"]').click(); await until(() => document.querySelectorAll('.weak-word-row').length === 2, 'weak page two');
assert.equal(writes('/word-links/summary').length, 0);
assert.equal(writes('/word-practice').length, 0);
await go('/words/1001', '.word-sentences'); await until(() => document.querySelectorAll('.word-sentence-row').length === 5, 'linked sentences stay on word details');
lostCreate = true; await click('练习关联句子'); await until(() => document.querySelector('.sentence-launch-error')?.textContent.includes('结果尚未确认'), 'unknown cross-word create');
assert.deepEqual(writes('/word-practice').at(-1).body, { wordIds: [1001], count: 10 }); assert.equal(writes('/word-practice').length, 1);
await go('/sentences/records', '.sentence-session-row'); assert.equal(writes('/word-practice').length, 1);
await go('/sentences/sessions/650', '#sentence-translation'); await until(() => document.querySelector('#sentence-translation').disabled === false, 'resumed pending'); assert.equal(document.querySelector('.sentence-reference'), null);
input('#sentence-translation', '我的中文草稿'); const draft = document.querySelector('#sentence-translation').value;
document.querySelector('.sentence-linked-words a').click(); await until(() => document.querySelector('.word-detail-heading'), 'snapshot lookup'); assert.equal(writes('/collect').length, 0);
await go('/sentences/sessions/650', '#sentence-translation'); await until(() => !document.querySelector('#sentence-translation').disabled, 'return to draft'); assert.equal(document.querySelector('#sentence-translation').value, draft);
console.log('PASS weak words stay word-only without sentence requests; word-detail linked pagination/empty state, practice unknown-result recovery and draft-preserving snapshot lookup');

document.querySelector('[aria-label="收录关联单词 abandon snapshot"]').click(); await until(() => document.querySelector('input[value="301"]'), 'own books'); assert.equal(document.querySelector('input[value="302"]').disabled, true);
assert.equal(document.querySelector('.sentence-join-choice input').checked, false); document.querySelector('input[value="301"]').click(); await click('确认收词'); await until(() => document.querySelector('[role="dialog"] .sentence-notice'), 'collected'); assert.deepEqual(writes('/collect').at(-1).body, { bookId: 301, joinPlan: false }); close(); await until(() => !document.querySelector('[role="dialog"]'), 'closed');
assert.equal(document.querySelector('#sentence-translation').value, draft); assert.equal(document.querySelector('.sentence-study-card').dataset.itemId, '850');
document.querySelector('[aria-label="收录关联单词 abandon snapshot"]').click(); await until(() => document.querySelector('input[value="301"]'), 'reopened books'); document.querySelector('input[value="301"]').click(); document.querySelector('.sentence-join-choice input').click(); await click('确认收词'); await until(() => document.querySelector('[role="dialog"] .sentence-notice'), 'explicit plan'); assert.equal(writes('/collect').at(-1).body.joinPlan, true); close(); await until(() => !document.querySelector('[role="dialog"]'), 'closed second');
document.querySelector('[aria-label="收录关联单词 abandon snapshot"]').click(); await until(() => document.querySelector('input[value="301"]'), 'third books'); document.querySelector('input[value="301"]').click(); collectError = 'BOOK_READ_ONLY'; await click('确认收词'); await until(() => document.querySelector('[role="dialog"] .inline-error'), 'permission failure'); assert.equal(document.querySelector('input[value="301"]').checked, false); document.querySelector('input[value="301"]').click(); collectError = 'SENTENCE_WORD_NOT_LINKED'; await click('确认收词'); await until(() => document.querySelector('[role="dialog"] .inline-error')?.textContent.includes('SENTENCE_WORD_NOT_LINKED'), 'invalid snapshot'); assert.equal(document.querySelector('.sentence-collect-form fieldset').disabled, true); close();
await click('编辑笔记'); await until(() => !document.querySelector('.sentence-note-form fieldset').disabled, 'note read'); input('#sentence-note-1', '<img src=x> 只作纯文本\n保留换行'); document.querySelector('.sentence-note-tag-options input[value="NEGATION"]').click(); await click('保存笔记'); await until(() => document.querySelector('.sentence-note-content')?.textContent.includes('<img'), 'note saved'); assert.equal(document.querySelector('.sentence-note-panel img'), null); assert.equal(notes.get(1).version, 1); assert.equal(document.querySelector('#sentence-translation').value, draft); assert.equal(writes('/submission').length, 0);
await click('编辑笔记'); await until(() => !document.querySelector('.sentence-note-form fieldset').disabled, 'note reread'); input('#sentence-note-1', '我未保存的修改'); noteConflict = true; await click('保存笔记'); await until(() => button('已核对最新笔记，继续编辑')?.disabled === false, 'note conflict reread'); assert.equal(document.querySelector('#sentence-note-1').value, '其他页面保存的笔记'); assert.match(document.querySelector('.sentence-conflict').textContent, /我未保存的修改/); assert.equal(document.querySelector('.sentence-note-form fieldset').disabled, true);
await click('已核对最新笔记，继续编辑'); await click('清空笔记'); await until(() => notes.get(1).version === 3 && !notes.get(1).content, 'clear keeps new version'); assert.deepEqual(writes('/note').at(-1).body, { content: '', errorTags: [], attemptId: null, version: 2 });
await click('提交译文'); await until(() => document.querySelector('.sentence-reference'), 'submitted'); await click('编辑笔记'); await until(() => !document.querySelector('.sentence-note-form fieldset').disabled, 'note after submission'); input('#sentence-note-1', '关联本次真实作答'); await chooseSelect(document.querySelector('.sentence-note-form'), '关联作答', '当前作答 #777'); document.querySelector('.sentence-note-tag-options input[value="TENSE"]').click(); await click('保存笔记'); await until(() => notes.get(1).attemptId === 777, 'real attempt association'); assert.equal(writes('/note').at(-1).body.version, 3);
for (let id = 2; id <= 12; id++) notes.set(id, { content: `笔记 ${id}`, errorTags: ['NEGATION'], attemptId: null, version: 1, updatedAt: '2026-10-24T12:00:00' });
await go('/sentences/notes', '.sentence-note-row'); await until(() => document.querySelectorAll('.sentence-note-row').length === 10, 'notes page'); assert.match(document.querySelector('.sentence-note-row').textContent, /已停用/); document.querySelector('.sentence-notes > .pagination [aria-label="下一页"]').click(); await until(() => document.querySelectorAll('.sentence-note-row').length === 2, 'notes page two');
await chooseSelect(document, '错因', '时态'); await click('筛选笔记'); await until(() => document.querySelectorAll('.sentence-note-row').length === 1, 'tag filter'); assert.equal(calls.filter(call => call.url.endsWith('/notes')).at(-1).params.errorTag, 'TENSE');
await chooseSelect(document, '错因', '其他'); await click('筛选笔记'); await until(() => document.body.textContent.includes('暂无符合条件的笔记'), 'empty tag');
console.log('PASS explicit personal collection/optional plan, read-only and invalid-link errors, pure-text notes, full writes, conflict acknowledgement, clear-version retention, genuine attempt association and filtered/paged notes');

await go('/settings/security', '.account-device-row'); assert.equal(document.querySelectorAll('.account-device-row').length, 2); assert.match(document.querySelector('.account-device-row').textContent, /当前会话/);
assert.match(document.querySelector('.account-device-row').textContent, new RegExp(new Date('2026-10-24T01:00:00Z').toLocaleString(undefined, { hour12: false }).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
failSessions = true; await click('刷新设备'); await until(() => document.querySelector('.account-security .state-panel[role="alert"]'), 'devices error'); await click('重新加载'); await until(() => document.querySelectorAll('.account-device-row').length === 2, 'device retry');
input('#current-password', ' synthetic old '); input('#new-password', ' synthetic new '); input('#confirm-password', 'mismatched'); await click('修改密码并重新登录'); await until(() => document.body.textContent.includes('两次新密码不一致'), 'confirmation'); assert.equal(writes('/auth/password').length, 0);
input('#confirm-password', ' synthetic new '); badPassword = true; const refreshBefore = writes('/auth/refresh').length; await click('修改密码并重新登录'); await until(() => document.body.textContent.includes('当前密码错误'), 'bad credentials'); assert.equal(writes('/auth/refresh').length, refreshBefore); assert.ok(tokens.access());
input('#others-password', ' synthetic old '); const previousRevision = tokens.revision(); legacy = true; await click('退出其他设备'); await until(() => document.body.textContent.includes('当前凭证已更新'), 'rotate'); assert.ok(tokens.revision() >= previousRevision + 2); assert.equal(document.querySelector('#others-password').value, '');
await click('撤销会话'); await until(() => document.querySelectorAll('.account-device-row').length === 1, 'other revoke'); assert.ok(calls.some(call => call.url === '/auth/sessions/000000000000000000000000000000cd/revoke' && call.body === null));
await click('退出此设备'); await until(() => document.querySelector('#username'), 'self revoke signout'); assert.equal(tokens.access(), null); assert.equal(tokens.refresh(), null);
await login(); await go('/settings/security', '#current-password'); input('#current-password', ' synthetic old '); input('#new-password', ' synthetic new '); input('#confirm-password', ' synthetic new '); await click('修改密码并重新登录'); await until(() => document.querySelector('#username'), 'password signout'); assert.deepEqual(writes('/auth/password').at(-1).body, { currentPassword: ' synthetic old ', newPassword: ' synthetic new ' }); assert.equal(tokens.access(), null); assert.equal(tokens.refresh(), null);
await login(); await go('/settings/security', '#others-password'); input('#others-password', ' synthetic old '); unknownSecurity = true; const securityCalls = writes('/auth/logout-others').length; await click('退出其他设备'); await until(() => document.querySelector('#username'), 'unknown security needs login'); assert.equal(writes('/auth/logout-others').length, securityCalls + 1); assert.match(document.querySelector('.auth-card').textContent, /结果尚未确认/);
assert.ok(calls.filter(call => call.url === '/auth/sessions' || call.url.includes('/revoke') || call.url.endsWith('/auth/password') || call.url.endsWith('/auth/logout-others')).every(call => call.authorization));
console.log('PASS device name login, local UTC display, device load retry, confirmation-only validation, BAD_CREDENTIALS no refresh, legacy upgrade + pair rotation, opaque revoke, password logout and unknown-result login recovery');
app.unmount(); await window.happyDOM.close();
console.log('Learning links/account Vue fixture checks passed. Live backend and real browser geometry remain unverified.');
