import { chooseSelect } from './helpers/choose-select.mjs';
// Explicit HTTP fixtures exercise the actual Vue pages; no production data is written.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';
import { AxiosError } from 'axios';
const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-sentences-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/sentences-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { router, http, app, useAuthStore, useSentenceManagementAccess } = await import('../.qa-sentences-dist/ui.js');
const document = window.document;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = value => JSON.parse(JSON.stringify(value));
async function until(test, label) { const end = Date.now() + 8000; while (!test()) { if (Date.now() > end) throw new Error(`Timeout: ${label}\n${document.body.textContent}`); await sleep(15); } }
function input(selector, value) { const node = document.querySelector(selector); assert.ok(node, selector); node.value = value; node.dispatchEvent(new window.Event('input', { bubbles: true })); node.dispatchEvent(new window.Event('change', { bubbles: true })); }
function button(text) { return [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text); }
async function click(text) { await until(() => button(text) && !button(text).disabled && !button(text).closest('fieldset:disabled'), `enabled ${text}`); button(text).click(); }
async function go(path, selector) { await router.push(path); await until(() => document.querySelector(selector), path); }
const base = '/sentence-translation', management = `${base}/management`;
const calls = [];
let canManage = false, failList = false, revoke = false, conflict = false, lostCreate = false, lostImport = false, importConflict = false, statisticsError = false, holdStatistics, holdAccess;
let previewStatuses = ['READY'];
let importId = 900, nextQuestion = 40;
const importCache = new Map();
const question = id => ({ sentenceId: id, englishText: `Original sentence ${id}.`, referenceTranslation: `参考 ${id}`, explanation: `解析 ${id}`, difficulty: 1, source: '原创试验', sourceReference: '可清空', status: 'ACTIVE', version: 0, wordIds: [1001], linkedWords: [{ wordId: 1001, word: 'abandon' }] });
const bank = new Map(Array.from({ length: 12 }, (_, index) => [index + 1, question(index + 1)]));
const schedule = { sentenceId: 7, lastAttemptId: 970, reviewLevel: 4, lastAssessment: 'UNDERSTOOD', reviewedAt: '2026-10-24T00:01:00', nextReviewDate: '2026-11-07' };
const due = Array.from({ length: 12 }, (_, index) => ({ sentenceId: index + 1, englishText: `Due sentence ${index + 1}.`, difficulty: 1, source: '原创', sourceReference: null, reviewLevel: index % 5, lastAssessment: 'PARTIAL', nextReviewDate: '2026-10-23' }));
let dueEmpty = false;
const statistics = days => ({ currentStreak: 2, longestStreak: 4, submissionCount: 110, answerCount: 70, revealCount: 40, selfReviewCount: 81, learningDayCount: 39, weakSentenceCount: 8, dueSentenceCount: 12, from: days === 7 ? '2026-10-18' : '2026-09-25', to: '2026-10-24', days: days === 7 ? [{ learningDate: '2026-10-23', submissionCount: 2, answerCount: 1, revealCount: 1, selfReviewCount: 0 }, { learningDate: '2026-10-24', submissionCount: 0, answerCount: 0, revealCount: 0, selfReviewCount: 2 }] : [] });
let phase = 'PENDING';
const progress = () => ({ sessionId: 550, selectionSource: 'DUE', status: phase === 'DONE' ? 'COMPLETED' : 'IN_PROGRESS', totalCount: 2, submissionCount: phase === 'PENDING' ? 0 : 1, answerCount: 0, revealCount: phase === 'PENDING' ? 0 : 1, selfReviewCount: phase === 'NEXT' ? 1 : 0, completedCount: phase === 'NEXT' ? 1 : 0, understoodCount: phase === 'NEXT' ? 1 : 0, partialCount: 0, notUnderstoodCount: 0, nextItemId: phase === 'NEXT' ? 802 : 801, createdAt: '2026-10-24T00:00:00', completedAt: null });
const pageOf = (records, params) => ({ page: params.page, size: params.size, total: records.length, records: records.slice((params.page - 1) * params.size, params.page * params.size) });
const fallback = http.defaults.adapter;
function ok(config, data, status = 200) { return { config, status, headers: {}, data: { code: 'OK', message: '成功', data: clone(data) } }; }
function reject(config, code, status = 409) { throw new AxiosError('explicit fixture failure', 'ERR_BAD_RESPONSE', config, undefined, { config, status, headers: {}, data: { code, message: code, data: null } }); }
http.defaults.adapter = async config => {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  if (!config.url.startsWith(`${base}/`)) return fallback(config);
  calls.push({ url: config.url, method: config.method, params: clone(config.params || {}), body: body instanceof FormData ? body : clone(body || null), authorization: config.headers.has('Authorization') });
  if (config.url === `${management}/access`) { if (holdAccess) { const hold = holdAccess; holdAccess = undefined; await hold; } return ok(config, { canManage }); }
  if (config.url.startsWith(`${management}/`) && (!canManage || revoke)) { revoke = false; return reject(config, 'SENTENCE_EDITOR_REQUIRED', 403); }
  if (config.url === `${management}/questions` && config.method === 'get') {
    if (failList) { failList = false; return reject(config, 'TEMPORARY', 503); }
    const params = config.params;
    assert.ok(Object.keys(params).every(key => ['page', 'size', 'keyword', 'status', 'difficulty', 'wordId'].includes(key)));
    return ok(config, pageOf([...bank.values()].filter(row => (!params.status || row.status === params.status) && (!params.keyword || row.englishText.startsWith(params.keyword)) && (!params.difficulty || row.difficulty === params.difficulty) && (!params.wordId || row.wordIds.includes(params.wordId))), params));
  }
  const managed = config.url.match(/\/management\/questions\/(\d+)$/);
  if (managed || config.url === `${management}/questions`) {
    const id = managed ? Number(managed[1]) : nextQuestion++;
    if (config.method === 'get') return ok(config, bank.get(id));
    assert.deepEqual(Object.keys(body).sort(), ['englishText', 'referenceTranslation', 'explanation', 'difficulty', 'source', 'sourceReference', 'status', 'version', 'wordIds'].sort());
    if (config.method === 'put') {
      if (conflict) { conflict = false; bank.get(id).version++; bank.get(id).englishText = 'Newest server sentence.'; return reject(config, 'SENTENCE_VERSION_CONFLICT'); }
      assert.equal(body.version, bank.get(id).version);
    } else assert.equal(body.version, 0);
    const row = { sentenceId: id, ...body, version: config.method === 'post' ? 0 : body.version + 1, linkedWords: body.wordIds.map(wordId => ({ wordId, word: 'abandon' })) };
    bank.set(id, row);
    if (lostCreate) { lostCreate = false; throw new AxiosError('created response lost', 'ECONNABORTED', config); }
    return ok(config, row, config.method === 'post' ? 201 : 200);
  }
  if (config.url === `${management}/import/preview`) {
    if (body instanceof FormData) { assert.deepEqual([...body.keys()], ['file']); assert.equal(body.get('file').name, 'sentences.csv'); }
    else assert.deepEqual(Object.keys(body), ['text']);
    const rows = previewStatuses.map((status, index) => ({ rowNumber: index + 2, status, message: `行校验 ${status}`, existingSentenceId: status === 'ALREADY_EXISTS' ? 1 : null, englishText: `CSV sentence ${index}.`, referenceTranslation: 'CSV 译文', explanation: 'CSV 解析', source: '原创', difficulty: 1, sourceReference: null, wordIds: [] }));
    return ok(config, { totalCount: rows.length, readyCount: rows.filter(row => row.status === 'READY').length, duplicateCount: rows.filter(row => ['ALREADY_EXISTS', 'DUPLICATE_IN_FILE'].includes(row.status)).length, invalidCount: rows.filter(row => row.status === 'INVALID').length, rows });
  }
  if (config.url === `${management}/import`) {
    assert.deepEqual(Object.keys(body).sort(), ['requestId', 'text']);
    if (importConflict) { importConflict = false; return reject(config, 'SENTENCE_ALREADY_EXISTS'); }
    if (!importCache.has(body.requestId)) importCache.set(body.requestId, { text: body.text, result: { importId: importId++, importedCount: 1, sentenceIds: [100] } });
    assert.equal(importCache.get(body.requestId).text, body.text);
    if (lostImport) { lostImport = false; throw new AxiosError('import response lost', 'ECONNABORTED', config); }
    return ok(config, importCache.get(body.requestId).result, 201);
  }
  if (config.url === `${base}/reviews/due`) return ok(config, pageOf(dueEmpty ? [] : due, config.params));
  if (/\/questions\/\d+\/schedule$/.test(config.url)) return ok(config, config.url.includes('/7/') ? schedule : null);
  if (config.url === `${base}/statistics/calendar`) return ok(config, { month: config.params?.month || '2026-10', days: [{ date: '2026-10-23', hasActivity: true, submissionCount: 2, answerCount: 1, revealCount: 1, selfReviewCount: 0 }, { date: '2026-10-24', hasActivity: true, submissionCount: 0, answerCount: 0, revealCount: 0, selfReviewCount: 2 }] });
  if (config.url === `${base}/statistics/daily`) return ok(config, { date: config.params?.date || '2026-10-24', hasActivity: true, submissionCount: 0, answerCount: 0, revealCount: 0, selfReviewCount: 2 });
  if (config.url === `${base}/statistics`) {
    const days = config.params.days;
    if (statisticsError) { statisticsError = false; return reject(config, 'TEMPORARY', 503); }
    if (holdStatistics) { const hold = holdStatistics; holdStatistics = undefined; await hold; }
    return ok(config, statistics(days));
  }
  if (config.url === `${base}/sessions`) {
    if (config.method === 'get') return ok(config, pageOf([progress()], config.params));
    assert.equal(body.source, 'DUE'); assert.equal(body.count, 10); return ok(config, progress(), 201);
  }
  if (config.url === `${base}/sessions/550`) return ok(config, progress());
  if (config.url.endsWith('/current')) return ok(config, { itemId: phase === 'NEXT' ? 802 : 801, sentenceId: phase === 'NEXT' ? 8 : 7, status: phase === 'NEXT' ? 'PENDING' : phase, englishText: 'Due practice sentence.', difficulty: 1, source: '原创', sourceReference: null, linkedWords: [], attemptId: phase === 'AWAITING_REVIEW' ? 960 : null, action: phase === 'AWAITING_REVIEW' ? 'REVEAL' : null, translation: null, referenceTranslation: phase === 'AWAITING_REVIEW' ? '参考答案，非唯一答案' : null, explanation: phase === 'AWAITING_REVIEW' ? '解析' : null, selfAssessment: null, submittedAt: null });
  if (config.url.endsWith('/submission')) { phase = 'AWAITING_REVIEW'; return ok(config, { sentenceId: 7, progress: progress(), reviewSchedule: null }); }
  if (config.url.endsWith('/self-review')) { phase = 'NEXT'; return ok(config, { sentenceId: 7, progress: progress(), reviewSchedule: schedule }); }
  throw new Error(`Unexpected fixture request ${config.url}`);
};
const writes = suffix => calls.filter(call => call.method !== 'get' && call.url.endsWith(suffix));
await until(() => document.querySelector('#username'), 'login');
input('#username', 'expansion_editor'); input('#password', 'example123'); await click('登录'); await until(() => document.querySelector('.daily-equation'), 'logged in');
const access = useSentenceManagementAccess();
await go('/sentences/manage', '.sentence-permission-empty');
assert.equal(document.querySelector('.sentence-nav a[href="/sentences/manage"]'), null);
assert.equal(calls.some(call => call.url === `${management}/questions`), false);
canManage = true; await access.load(true);
await until(() => document.querySelectorAll('.sentence-managed-row').length === 10, 'authorized list');
assert.ok(document.querySelector('.sentence-nav a[href="/sentences/manage"]'));
document.querySelector('.sentence-management .pagination [aria-label="下一页"]').click();
await until(() => document.querySelectorAll('.sentence-managed-row').length === 2, 'management pagination');
input('.sentence-management-filters input', 'missing-prefix'); await click('筛选'); await until(() => document.body.textContent.includes('没有符合条件'), 'empty manager');
input('.sentence-management-filters input', 'Original'); failList = true; await click('筛选'); await until(() => document.querySelector('[role="alert"]'), 'list error'); await click('重新加载'); await until(() => document.querySelectorAll('.sentence-managed-row').length === 10, 'list retry');
await go('/sentences/manage/1/edit', '.sentence-editor'); await until(() => document.querySelector('#sentence-english').value === 'Original sentence 1.', 'editor loaded');
input('#sentence-source-reference', ''); await click('清空关联');
// Select status by label to avoid relying on visual order.
await chooseSelect(document, '状态', '停用'); await click('保存题目'); await until(() => document.body.textContent.includes('已保存并停用'), 'disabled saved');
assert.equal(writes('/questions/1').at(-1).body.sourceReference, null); assert.deepEqual(writes('/questions/1').at(-1).body.wordIds, []); assert.equal(bank.get(1).status, 'INACTIVE');
await chooseSelect(document, '状态', '启用'); await click('保存题目'); await until(() => bank.get(1).status === 'ACTIVE', 'restored');
await until(() => !document.querySelector('.sentence-editor fieldset').disabled, 'saved unlocked');
input('#sentence-english', 'My unsaved sentence.'); conflict = true; const beforeConflict = writes('/questions/1').length;
await click('保存题目'); await until(() => document.querySelector('.sentence-conflict'), 'conflict'); await until(() => button('已核对最新版本，继续编辑')?.disabled === false, 'latest loaded');
assert.equal(document.querySelector('#sentence-english').value, 'Newest server sentence.'); assert.ok(document.querySelector('.sentence-draft').textContent.includes('My unsaved sentence.'));
assert.equal(writes('/questions/1').length, beforeConflict + 1); assert.equal(document.querySelector('.sentence-editor fieldset').disabled, true);
await click('已核对最新版本，继续编辑'); input('#sentence-english', 'Reviewed new edit.'); await click('保存题目'); await until(() => bank.get(1).englishText === 'Reviewed new edit.', 'conflict resolved');
await go('/sentences/manage/new', '.sentence-editor');
await until(() => document.querySelector('.library-heading h1')?.textContent === '新建句子', 'new editor mounted');
input('#sentence-english', 'A newly created sentence.'); input('#sentence-reference', '参考译文'); input('#sentence-explanation', '完整解析'); input('#sentence-source', '原创');
await click('保存题目'); await until(() => router.currentRoute.value.path === '/sentences/manage/40/edit' && document.querySelector('#sentence-english')?.value === 'A newly created sentence.', 'create navigates to detail');
await until(() => document.querySelector('.library-heading h1')?.textContent === '编辑句子', 'created editor mounted');
await go('/sentences/manage/new', '.sentence-editor'); await until(() => document.querySelector('.library-heading h1')?.textContent === '新建句子', 'second new editor');
input('#sentence-english', 'Create with unknown outcome.'); input('#sentence-reference', '参考译文'); input('#sentence-explanation', '完整解析'); input('#sentence-source', '原创'); lostCreate = true;
await click('保存题目'); await until(() => document.body.textContent.includes('新建结果尚未确认'), 'unknown create'); assert.equal(document.querySelector('.sentence-editor fieldset').disabled, true);
assert.equal(writes('/questions').length, 2, 'unknown creation is not retried');
console.log('PASS server permissions, filtered/paged management, full PUT clear/disable/restore, version conflict reload + explicit acknowledgement and unknown create lock');

await go('/sentences/manage/import', '#sentence-csv-text');
const csv = 'englishText,referenceTranslation,explanation,difficulty,source\r\n"CSV, quoted sentence.",参考,解析,1,原创';
input('#sentence-csv-text', csv); previewStatuses = ['READY', 'ALREADY_EXISTS', 'DUPLICATE_IN_FILE', 'INVALID']; await click('预览匹配结果'); await until(() => document.querySelectorAll('.sentence-import-row').length === 4, 'four statuses');
assert.equal(button('确认整批导入').disabled, true); assert.match(document.querySelector('.sentence-import-preview').textContent, /题库已存在/); assert.match(document.querySelector('.sentence-import-preview').textContent, /文件内重复/);
previewStatuses = []; await click('预览匹配结果'); await until(() => document.querySelector('.sentence-import-preview')?.textContent.includes('共 0 行'), 'empty CSV preview'); assert.equal(button('确认整批导入').disabled, true);
previewStatuses = ['READY']; await click('预览匹配结果'); await until(() => button('确认整批导入')?.disabled === false, 'ready');
lostImport = true; await click('确认整批导入'); await until(() => button('重试原导入请求'), 'unknown import');
const firstBody = clone(writes('/import').at(-1).body); assert.equal(firstBody.text, csv);
assert.equal(document.querySelector('.sentence-editor fieldset').disabled, true);
await go('/sentences/manage', '.sentence-managed-row'); await go('/sentences/manage/import', '#sentence-csv-text'); await click('重试原导入请求'); await until(() => document.body.textContent.includes('已导入 1 题'), 'refresh retry confirmed');
assert.deepEqual(writes('/import').at(-1).body, firstBody); assert.equal(importCache.size, 1);
await click('开始新的导入'); input('#sentence-csv-text', `${csv}\r\n`); await click('预览匹配结果'); await until(() => button('确认整批导入')?.disabled === false, 'second ready'); importConflict = true; await click('确认整批导入'); await until(() => document.body.textContent.includes('整批未导入'), 'concurrent conflict'); assert.equal(button('确认整批导入'), undefined);
assert.notEqual(writes('/import').at(-1).body.requestId, firstBody.requestId); assert.equal(importCache.size, 1);
await click('上传 CSV');
function upload(file) { Object.defineProperty(document.querySelector('#sentence-csv-file'), 'files', { value: [file], configurable: true }); document.querySelector('#sentence-csv-file').dispatchEvent(new window.Event('change', { bubbles: true })); }
upload(new File([new Uint8Array(256 * 1024 + 1)], 'sentences.csv')); const previews = writes('/import/preview').length; await click('预览匹配结果'); await until(() => document.body.textContent.includes('超过 256 KiB'), 'file size validation'); assert.equal(writes('/import/preview').length, previews);
upload(new File([new Uint8Array([255, 254])], 'sentences.csv')); await click('预览匹配结果'); await until(() => document.body.textContent.includes('有效 UTF-8'), 'encoding');
upload(new File([`\uFEFF${csv}`], 'sentences.csv')); await click('预览匹配结果'); await until(() => button('确认整批导入')?.disabled === false, 'file ready'); assert.ok(writes('/import/preview').at(-1).body instanceof FormData);
await click('确认整批导入'); await until(() => document.body.textContent.includes('已导入 1 题'), 'file import'); assert.equal(writes('/import').at(-1).body.text, `\uFEFF${csv}`, 'BOM and raw contents preserved');
await go('/sentences/manage', '.sentence-managed-row'); revoke = true; await click('刷新'); await until(() => document.body.textContent.includes('没有题库维护权限'), '403 revoked'); assert.equal(access.canManage, false); assert.equal(document.querySelector('.sentence-nav a[href="/sentences/manage"]'), null);
console.log('PASS atomic CSV statuses/empty/limits/UTF-8/FormData/BOM, stable exact-text idempotency after remount, new key on content change, concurrent duplicate re-preview and 403 revoke');

await go('/sentences/due', '.sentence-catalog'); await until(() => document.querySelectorAll('.sentence-question-row').length === 10, 'due page');
assert.equal(document.querySelector('.sentence-reference'), null); assert.match(document.querySelector('.sentence-due-date').textContent, /2026-10-23/);
document.querySelector('.sentence-catalog .pagination [aria-label="下一页"]').click(); await until(() => document.querySelectorAll('.sentence-question-row').length === 2, 'due pagination');
assert.deepEqual(calls.filter(call => call.url.endsWith('/reviews/due')).at(-1).params, { page: 2, size: 10 });
document.querySelectorAll('.sentence-row-actions')[0].querySelectorAll('button')[1].click(); await until(() => document.body.textContent.includes('当前没有复习安排'), 'null schedule'); document.querySelector('[aria-label="关闭弹窗"]').click();
dueEmpty = true; await click('刷新列表'); await until(() => document.body.textContent.includes('当前没有可安排'), 'due empty'); assert.match(document.body.textContent, /继续原轮次/);
dueEmpty = false; await click('刷新列表'); await until(() => document.querySelectorAll('.sentence-question-row').length === 10, 'due refreshed');
await click('开始到期复习'); await until(() => document.querySelector('#sentence-translation')?.disabled === false, 'DUE study pending'); assert.equal(document.querySelector('.sentence-reference'), null);
await click('不会，查看解析'); await until(() => button('意思基本一致')?.disabled === false, 'review phase'); assert.equal(document.querySelector('.sentence-reference').textContent, '参考答案，非唯一答案');
await click('意思基本一致'); await until(() => document.querySelector('.sentence-last-schedule'), 'server schedule'); assert.match(document.querySelector('.sentence-last-schedule').textContent, /2026-11-07/); assert.match(document.querySelector('.sentence-last-schedule').textContent, /档位 4/);
assert.equal(document.querySelector('.sentence-reference'), null); await click('查询当前安排'); await until(() => document.querySelector('.sentence-schedule-facts'), 'schedule queried'); assert.match(document.querySelector('.sentence-schedule-facts').textContent, /#970/); document.querySelector('[aria-label="关闭弹窗"]').click();
const createCount = writes('/sessions').length; await go('/sentences/records', '.sentence-session-row'); assert.match(document.querySelector('.sentence-session-row').textContent, /到期复习/); await go('/sentences/sessions/550', '#sentence-translation'); assert.equal(writes('/sessions').length, createCount, 'restore never creates DUE session');
console.log('PASS distinct due list, backend dates/levels, null/current schedule, source=DUE, hidden answers and original GET-only restoration');

await go('/sentences/statistics', '.overview-streaks strong');
assert.deepEqual([...document.querySelectorAll('.overview-streaks strong')].map(row => Number(row.textContent.replace('天', '').trim())), [2, 4, 39]);
await until(() => document.querySelectorAll('.statistics-bar-column').length === 2, 'sentence trend');
assert.match(document.querySelectorAll('.statistics-bar-column')[0].getAttribute('aria-label'), /完成 0 句，有学习活动/);
assert.match(document.querySelectorAll('.statistics-bar-column')[1].getAttribute('aria-label'), /完成 2 句，有学习活动/);
let release;
holdStatistics = new Promise(resolve => { release = resolve; }); await click('最近 30 天'); await until(() => calls.filter(call => call.url.endsWith('/statistics')).at(-1)?.params.days === 30, 'held 30'); await click('最近 7 天'); await until(() => document.querySelector('.statistics-bar-column'), 'newer 7 response'); release(); await sleep(80); assert.equal(document.querySelectorAll('.statistics-bar-column').length, 2, 'late 30 does not overwrite 7');
await click('最近 30 天'); await until(() => document.body.textContent.includes('暂无趋势数据'), 'empty trends'); assert.match(document.querySelector('.overview-streaks').textContent, /39/);
statisticsError = true; await click('刷新统计'); await until(() => document.querySelector('.statistics-overview [role="alert"]'), 'statistics error'); await click('重新加载'); await until(() => document.querySelector('.overview-streaks strong'), 'statistics retry');
assert.ok(calls.every(call => call.authorization), 'shared Bearer auth');
let releaseAccess; holdAccess = new Promise(resolve => { releaseAccess = resolve; }); const late = access.load(true); await sleep(30); const auth = useAuthStore(); const identity = clone(auth.user); auth.user = { ...identity, id: identity.id + 1 }; releaseAccess(); await late; assert.equal(access.canManage, false, 'late permission cannot grant a new user'); auth.user = identity;
console.log('PASS cumulative/current/trend boundaries, actual review dates, 7/30 race/error/empty states, JWT and user-scoped late permission rejection');
app.unmount(); await window.happyDOM.close();
console.log('Sentence expansion fixture checks passed. Live backend writes and browser geometry remain unverified.');
