// Frontend behavior with explicit Section 19 fixtures, not a backend parser or live-account test.
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
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-book-transfer-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/book-transfer-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { router, http, api, dailyApi, bookTransferApi, app } = await import('../.qa-book-transfer-dist/ui.js');
const document = window.document;
async function until(predicate, label) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}\n${document.body.textContent}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
function input(selector, value) {
  const element = document.querySelector(selector); assert.ok(element, selector);
  element.value = value; element.dispatchEvent(new window.Event('input', { bubbles: true }));
  element.dispatchEvent(new window.Event('change', { bubbles: true }));
}
function button(text) { return [...document.querySelectorAll('button')].find(element => element.textContent.trim() === text); }
async function click(text) { await until(() => button(text)?.disabled === false, `enabled ${text}`); button(text).click(); }
const dialog = () => document.querySelector('[role=dialog]');
const candidate = (id, word = 'lead', inBook = false) => ({ id, word, phonetic: null, translation: 'n. 明确选择的候选', translationGroups: [{ partOfSpeech: 'n.', meaning: '明确选择的候选' }], inBook });
const row = (rowNumber, word, status, candidates = [], duplicateOfRow = null) => ({ rowNumber, input: word, word, status, duplicateOfRow, message: `服务端 ${status}`, candidateCount: candidates.length, hasMoreCandidates: false, candidates });
let bookId;
const mixed = () => ({ bookId, format: 'TXT', totalCount: 8, matchedCount: 2, alreadyInBookCount: 1, duplicateCount: 2, notFoundCount: 1, ambiguousCount: 1, invalidCount: 1, ignoredBlankCount: 2, ignoredColumns: ['phonetic', 'translation'], readyWordIds: [1001, 1002, 1003], records: [
  row(1, 'abandon', 'MATCHED', [candidate(1001, 'abandon')]),
  { ...row(2, 'lead', 'AMBIGUOUS', Array.from({ length: 20 }, (_, index) => candidate(1010 + index))), candidateCount: 21, hasMoreCandidates: true },
  { ...row(3, 'lead', 'DUPLICATE', [], 2), candidateCount: 21, hasMoreCandidates: true },
  row(4, 'absorb', 'ALREADY_IN_BOOK', [candidate(1002, 'absorb', true)]),
  row(5, '<missing>', 'NOT_FOUND'), row(6, '', 'INVALID'), row(7, '<missing>', 'DUPLICATE', [], 5),
  row(8, 'abstract', 'MATCHED', [candidate(1003, 'abstract')]),
] });
const empty = () => ({ ...mixed(), format: 'CSV', totalCount: 0, matchedCount: 0, alreadyInBookCount: 0, duplicateCount: 0, notFoundCount: 0, ambiguousCount: 0, invalidCount: 0, ignoredBlankCount: 0, readyWordIds: [], records: [] });
const fixture = http.defaults.adapter;
const calls = [];
let previewResponse = mixed;
let failure;
let exportMode = 'csv';
let exportHeader = 'attachment; filename="fallback.csv"; filename*=UTF-8\'\'%E9%98%85%E8%AF%BB%E8%AF%8D%E6%9C%AC.csv';
const csv = '\uFEFFword,phonetic,translation\r\n"take off","","起飞, 脱下"\r\n';
function ok(config, data, headers = {}, status = 200) { return { config, status, statusText: 'OK', headers, data }; }
function reject(config, status, code, message, blob = false) {
  const body = { code, message, data: null };
  throw new AxiosError('explicit fixture failure', 'ERR_BAD_RESPONSE', config, undefined, { config, status, headers: { 'content-type': 'application/json' }, data: blob ? new Blob([JSON.stringify(body)], { type: 'application/json' }) : body });
}
http.defaults.adapter = async config => {
  calls.push({ url: config.url, method: config.method, params: config.params, body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data, protected: typeof config.headers.get('Authorization') === 'string', responseType: config.responseType });
  if (failure?.match(config)) {
    const next = failure; failure = undefined;
    return reject(config, next.status, next.code, next.message, next.blob);
  }
  if (/\/import\/preview$/.test(config.url)) return ok(config, { code: 'OK', message: '成功', data: previewResponse() });
  if (config.url === '/words' && config.params?.keyword === 'lead') {
    assert.deepEqual(config.params, { keyword: 'lead', matchType: 'EXACT', bookId, page: 2, size: 20 });
    return ok(config, { code: 'OK', message: '成功', data: { page: 2, size: 20, total: 21, records: [candidate(1030)] } });
  }
  if (/\/export$/.test(config.url)) {
    if (exportMode === '401' && !config._retried) return reject(config, 401, 'UNAUTHENTICATED', '请刷新身份', true);
    if (exportMode === 'json') return ok(config, new Blob([JSON.stringify({ code: 'BOOK_EXPORT_TOO_LARGE', message: '超过 10000 词或 10 MiB' })]), { 'content-type': 'application/json' });
    if (exportMode === 'ok-json') return ok(config, new Blob([JSON.stringify({ code: 'OK', message: '成功', data: {} })]), { 'content-type': 'application/json' });
    if (exportMode === 'partial') return ok(config, new Blob([csv]), { 'content-type': 'text/csv' }, 206);
    if (exportMode === 'large') return ok(config, new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]), { 'content-type': 'text/csv' });
    return ok(config, new Blob([exportMode === 'empty-book' ? '\uFEFFword,phonetic,translation\r\n' : csv], { type: 'text/csv;charset=UTF-8' }), { 'content-type': 'text/csv;charset=UTF-8', 'content-disposition': exportHeader });
  }
  return fixture(config);
};
const previews = () => calls.filter(call => call.url.endsWith('/import/preview'));
const collects = () => calls.filter(call => call.method === 'post' && call.url === `/word-books/${bookId}/words`);
function fail(match, code, message, status = 400, blob = false) { failure = { match, code, message, status, blob }; }
async function openImport() { await click('批量导入'); await until(dialog, 'import dialog'); }
async function closeImport() { document.querySelector('[aria-label="关闭弹窗"]').click(); await until(() => !dialog(), 'closed import'); }
async function previewText(text = 'abandon\nlead\nabsorb') {
  input('#import-text', text); await click('预览匹配结果'); await until(() => document.querySelector('.import-preview'), 'preview returned');
}
await until(() => document.querySelector('#username'), 'login');
input('#username', 'transfer_reader'); input('#password', 'example123'); await click('登录');
await until(() => document.querySelector('.daily-equation'), 'logged in');
await router.push('/books/1'); await until(() => document.querySelector('.wordlist-heading'), 'system book');
assert.equal(button('批量导入'), undefined); assert.equal(button('导出 CSV'), undefined);
const personal = await api.createBook({ name: '导入测试词本', description: null }); bookId = personal.id;
await api.collectWords(bookId, [1002]);
const beforePlan = await dailyApi.today();
await router.push(`/books/${bookId}`); await until(() => button('批量导入'), 'personal transfer actions');
await openImport();
await click('预览匹配结果'); await until(() => document.querySelector('.import-error'), 'blank validation');
assert.equal(previews().length, 0);
input('#import-text', Array.from({ length: 101 }, () => 'a').join('\n')); await click('预览匹配结果');
await until(() => document.querySelector('.import-error')?.textContent.includes('100'), 'TXT row limit'); assert.equal(previews().length, 0);
input('#import-text', '中'.repeat(90000)); await click('预览匹配结果');
await until(() => document.querySelector('.import-error')?.textContent.includes('256 KiB'), 'UTF8 byte limit'); assert.equal(previews().length, 0);
await previewText();
assert.deepEqual(previews().at(-1).body, { text: 'abandon\nlead\nabsorb', format: 'TXT' });
assert.equal(document.querySelectorAll('.import-counts > div').length, 6);
assert.equal(document.querySelectorAll('.import-row').length, 8);
assert.equal(document.querySelectorAll('missing').length, 0, 'input is plain text');
assert.match(document.querySelector('.import-confirm-count').textContent, /已确认 3.*待处理 5/);
assert.equal(button('确认收录 3 词').disabled, true);
document.querySelector('.import-candidates details').open = true;
await until(() => document.querySelectorAll('.import-candidate').length === 20, 'first candidates shown');
assert.equal(document.querySelectorAll('.import-candidate input:checked').length, 0, 'ambiguous candidates are never preselected');
document.querySelector('.import-candidates [aria-label="下一页"]').click();
await until(() => document.querySelector('input[aria-label="选用 lead #1030"]'), 'candidate beyond first twenty');
document.querySelector('input[aria-label="选用 lead #1030"]').click();
await until(() => document.querySelector('.import-confirm-count')?.textContent.includes('已确认 4'), 'explicit candidate selected');
assert.match(document.querySelector('[data-row="3"]').textContent, /#1030/, 'duplicate follows original choice');
assert.equal(button('确认收录 4 词').disabled, true);
document.querySelector('.import-skip input').click();
await until(() => button('确认收录 4 词')?.disabled === false, 'skip acknowledgment required');
const beforeCollect = collects().length;
button('确认收录 4 词').click(); button('确认收录 4 词').click();
await until(() => !dialog() && document.querySelector('.live-notice')?.textContent.includes('跳过 3 行'), 'partial import reports skipped lines');
assert.equal(collects().length, beforeCollect + 1, 'confirm guards double clicks');
assert.deepEqual(collects().at(-1).body, { wordIds: [1001, 1030, 1002, 1003] }, 'candidate is inserted at its original row position');
assert.equal((await api.book(bookId)).wordCount, 4);
assert.match(document.querySelector('.live-notice').textContent, /收录 3 词.*已有 1 词.*跳过 3 行/);
assert.deepEqual(await dailyApi.today(), beforePlan, 'import does not join or restore learning plans');
assert.equal(calls.filter(call => /learning/.test(call.url) && call.method !== 'get').length, 0);
assert.equal(previews().every(call => call.protected), true);
console.log('PASS six statuses, byte/row validation, explicit candidates beyond 20, duplicate following, ordered IDs, skipped acknowledgment and no automatic learning');

await openImport();
await previewText();
input('#import-text', 'edited');
await until(() => !document.querySelector('.import-preview'), 'editing invalidates old preview');
previewResponse = () => ({ ...mixed(), totalCount: 11, matchedCount: 9, alreadyInBookCount: 0, duplicateCount: 1, notFoundCount: 0, invalidCount: 0, records: [
  { ...mixed().records[1], rowNumber: 1 },
  ...Array.from({ length: 9 }, (_, index) => row(index + 2, `word-${index}`, 'MATCHED', [candidate(1001 + index, `word-${index}`)])),
  row(11, 'lead', 'DUPLICATE', [], 1),
] });
const beforePagedPreview = previews().length;
button('预览匹配结果').click(); button('预览匹配结果').click();
await until(() => document.querySelectorAll('.import-row').length === 10, 'preview first ten rows');
assert.equal(previews().length, beforePagedPreview + 1, 'preview guards double clicks');
document.querySelector('.import-candidates details').open = true;
await until(() => document.querySelector('input[aria-label="选用 lead #1010"]'), 'paged preview candidate ready');
document.querySelector('input[aria-label="选用 lead #1010"]').click();
document.querySelector('.import-preview > .pagination [aria-label="下一页"]').click();
await until(() => document.querySelector('[data-row="11"]'), 'preview page two');
assert.match(document.querySelector('[data-row="11"]').textContent, /#1010/);
assert.equal(button('确认收录 10 词').disabled, false, 'cross-page candidate persists without requiring a skip');
document.querySelector('.import-preview > .pagination [aria-label="上一页"]').click();
await until(() => document.querySelector('[data-row="1"]'), 'preview previous page');
assert.match(document.querySelector('.import-selected').textContent, /#1010/);
previewResponse = mixed;
for (const [code, message, status] of [['IMPORT_CSV_INVALID', 'CSV 表头或引号错误', 400], ['IMPORT_ROW_LIMIT', '超过 100 行', 400], ['IMPORT_ENCODING_UNSUPPORTED', '仅支持 UTF-8', 400], ['IMPORT_FILE_UNREADABLE', '无法读取文件', 400], ['IMPORT_TOO_LARGE', '超过 256 KiB', 413]]) {
  input('#import-format', 'CSV'); input('#import-text', `word\n${code}`);
  fail(config => config.url.endsWith('/import/preview'), code, message, status);
  await click('预览匹配结果'); await until(() => document.querySelector('.import-error')?.textContent === message, code);
  assert.equal(document.querySelector('.import-preview'), null);
}
document.querySelector('input[value="FILE"]').click(); await until(() => document.querySelector('#import-file'), 'upload mode');
function upload(file) { Object.defineProperty(document.querySelector('#import-file'), 'files', { value: [file], configurable: true }); document.querySelector('#import-file').dispatchEvent(new window.Event('change', { bubbles: true })); }
let count = previews().length;
upload(new File(['word\napple'], 'unsupported.xlsx')); await click('预览匹配结果');
await until(() => document.querySelector('.import-error')?.textContent.includes('.txt / .csv'), 'extension limit');
upload(new File([new Uint8Array(256 * 1024 + 1)], 'large.TXT')); await click('预览匹配结果');
await until(() => document.querySelector('.import-error')?.textContent.includes('256 KiB'), 'file size limit');
assert.equal(previews().length, count);
previewResponse = empty;
upload(new File(['\uFEFFword,phonetic,translation\r\n'], 'empty.CSV')); await click('预览匹配结果');
await until(() => document.querySelector('.import-empty'), 'header-only CSV empty preview');
const form = previews().at(-1).body;
assert.equal(form instanceof FormData, true); assert.deepEqual([...form.keys()], ['file']); assert.equal(form.get('file').name, 'empty.CSV');
assert.equal(button('确认收录 0 词').disabled, true);
assert.equal(collects().length, beforeCollect + 1, 'empty results never collect');
await closeImport();

previewResponse = mixed; await openImport(); await previewText();
document.querySelector('.import-skip input').click();
fail(config => config.method === 'post' && config.url === `/word-books/${bookId}/words`, 'WORD_NOT_FOUND', '某个词已不存在，整批未更改', 404);
await click('确认收录 3 词');
await until(() => document.querySelector('.import-save-error')?.textContent.includes('整批未更改'), 'atomic confirm error retained');
assert.equal((await api.book(bookId)).wordCount, 4);
assert.ok(document.querySelector('.import-preview'));
await click('重试收词 3 词'); await until(() => !dialog(), 'explicit confirm retry');
await openImport(); input('#import-text', 'abandon');
fail(config => config.url.endsWith('/import/preview'), 'BOOK_READ_ONLY', '仅支持本人个人词本', 403);
await click('预览匹配结果'); await until(() => document.querySelector('.import-error')?.textContent.includes('本人个人词本'), 'permission error');
assert.equal(button('预览匹配结果').disabled, true); await closeImport();
console.log('PASS stale-preview reset, upload FormData file, empty CSV, CSV/encoding/limits errors, atomic confirm failure/retry and permission blocking');

const downloads = []; const revoked = []; const blobs = [];
URL.createObjectURL = blob => { blobs.push(blob); return `blob:transfer-${blobs.length}`; };
URL.revokeObjectURL = url => revoked.push(url);
const originalClick = window.HTMLAnchorElement.prototype.click;
window.HTMLAnchorElement.prototype.click = function () { if (this.download) downloads.push({ filename: this.download, url: this.href }); else originalClick.call(this); };
await until(() => button('导出 CSV')?.disabled === false, 'export after permission refresh');
button('导出 CSV').click(); button('导出 CSV').click();
await until(() => downloads.length === 1, 'CSV download');
assert.equal(downloads[0].filename, '阅读词本.csv');
assert.deepEqual([...new Uint8Array(await blobs[0].arrayBuffer()).slice(0, 3)], [239, 187, 191], 'BOM bytes preserved');
assert.equal(document.querySelector('a[download]'), null, 'temporary anchor removed');
assert.equal(calls.filter(call => call.url.endsWith('/export')).length, 1, 'export guards double click');
assert.equal(calls.find(call => call.url.endsWith('/export')).protected, true);
assert.equal(calls.find(call => call.url.endsWith('/export')).responseType, 'blob');
for (const [mode, expected] of [['json', '超过 10000'], ['ok-json', '不是完整 CSV'], ['partial', '不是完整 CSV'], ['large', '超过 10 MiB']]) {
  exportMode = mode; await click('导出 CSV');
  await until(() => document.querySelector('.book-export-error')?.textContent.includes(expected), mode);
  assert.equal(downloads.length, 1, 'invalid responses never download');
}
exportMode = 'csv';
for (const [code, message, status] of [['BOOK_EXPORT_TOO_LARGE', '导出超过容量上限', 413], ['BOOK_NOT_FOUND', '词本不存在或无权访问', 404], ['BOOK_READ_ONLY', '系统词书不可导出', 403]]) {
  fail(config => config.url.endsWith('/export'), code, message, status, true);
  await click('导出 CSV'); await until(() => document.querySelector('.book-export-error')?.textContent === message, `${status} Blob JSON error`);
  assert.equal(downloads.length, 1);
}
const refreshes = calls.filter(call => call.url === '/auth/refresh').length;
exportMode = '401';
await Promise.all([bookTransferApi.exportCsv(bookId), bookTransferApi.exportCsv(bookId)]);
assert.equal(calls.filter(call => call.url === '/auth/refresh').length, refreshes + 1, 'Blob 401 requests reuse single-flight refresh');
exportMode = 'empty-book'; exportHeader = '';
await click('导出 CSV'); await until(() => downloads.length === 2, 'empty book header remains a valid CSV');
assert.equal(downloads[1].filename, `wordtrail-book-${bookId}.csv`);
assert.equal(calls.filter(call => call.url.endsWith('/export')).every(call => call.method === 'get' && !call.params), true);
await new Promise(resolve => setTimeout(resolve, 1100));
assert.equal(revoked.length, 2);
console.log('PASS authenticated Blob CSV, filename*, BOM/header preservation, object URL cleanup, double-click guards, JSON/status/size rejection and single-flight refresh');
app.unmount(); await window.happyDOM.close();
console.log('Book transfer frontend checks passed. Backend file parsing, real downloads and browser geometry are not verified.');
