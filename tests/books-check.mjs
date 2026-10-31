import { seedHistoricalPractice } from './helpers/legacy-practice.mjs';
// Actual Vue components in a simulated DOM, with an explicitly enabled API fixture.
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
await build({ configFile: false, plugins: [vue()], mode: 'mock', define: { 'import.meta.env.VITE_UI_PREVIEW': '"false"' }, logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-books-dist', emptyOutDir: true, minify: false, lib: { entry: 'tests/app-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { router, http, api, dailyApi } = await import('../.qa-books-dist/ui.js');
const document = window.document;
const fixture = http.defaults.adapter;
const calls = [];
let fault;
http.defaults.adapter = async config => {
  calls.push({ method: config.method, url: config.url, data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data, params: config.params });
  if (fault?.(config)) {
    const failure = fault;
    fault = undefined;
    throw new AxiosError('fixture error', 'ERR_BAD_RESPONSE', config, undefined, { config, status: failure.status, headers: {}, data: { code: failure.code, message: failure.message, data: null } });
  }
  return fixture(config);
};
async function until(predicate, label) {
  const deadline = Date.now() + 8000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}\n${document.body.textContent}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
function input(selector, value) {
  const element = document.querySelector(selector);
  assert.ok(element, selector); element.value = value;
  element.dispatchEvent(new window.Event('input', { bubbles: true }));
}
function click(text, root = document) {
  const button = [...root.querySelectorAll('button')].find(element => element.textContent.trim() === text);
  assert.ok(button, `button ${text}`); assert.equal(button.disabled, false, `enabled ${text}`); button.click();
}
async function readyClick(text, selector) {
  await until(() => [...(selector ? document.querySelector(selector) : document)?.querySelectorAll('button') || []].some(element => element.textContent.trim() === text && !element.disabled), `ready ${text}`);
  click(text, selector ? document.querySelector(selector) : document);
}
function select(element) {
  assert.ok(element); assert.equal(element.disabled, false);
  element.checked = true; element.dispatchEvent(new window.Event('change', { bubbles: true }));
}
const dialog = () => document.querySelector('[role="dialog"]');
const writes = () => calls.filter(call => ['post', 'put', 'delete', 'patch'].includes(call.method));
function failNext(predicate, code, message, status = 409) { fault = Object.assign(predicate, { code, message, status }); }

await until(() => document.querySelector('#username'), 'login');
input('#username', 'books_reader'); input('#password', 'example123'); click('登录');
await until(() => document.querySelector('.today-equation') || document.querySelector('.daily-equation'), 'logged in');
await router.push('/books');
await until(() => document.querySelectorAll('.library-card').length === 4, 'system catalog');
assert.equal(document.querySelectorAll('.library-card button').length, 0, 'system books have no editing entry');
click('我的词本');
await until(() => document.querySelector('.state-panel')?.textContent.includes('还没有个人词本'), 'empty personal scope');
assert.equal(calls.at(-1).params.scope, 'PERSONAL');
click('创建词本');
await until(dialog, 'create dialog');
const beforeCreate = writes().length;
click('创建词本', dialog());
await until(() => dialog()?.textContent.includes('名称须为'), 'blank name validation');
assert.equal(writes().length, beforeCreate);
input('#book-name', '  阅读生词  '); input('#book-description', '  阅读中遇到的词  '); click('创建词本', dialog());
await until(() => !dialog() && document.querySelector('.wordlist-heading h1')?.textContent === '阅读生词', 'new personal book opens detail');
const createdRequest = calls.find(call => call.url === '/word-books' && call.method === 'post');
assert.deepEqual(createdRequest.data, { name: '阅读生词', description: '阅读中遇到的词' });
let book = (await api.books({ scope: 'PERSONAL', page: 1, size: 20 })).records[0];
assert.deepEqual([book.wordCount, book.unlearnedCount, book.startedCount, book.dueCount], [0, 0, 0, 0]);
await router.push('/books');
await until(() => document.querySelectorAll('.library-card').length === 5, 'catalog includes created book');
click('我的词本');
await until(() => document.querySelectorAll('.library-card').length === 1, 'created book in personal scope');
click('编辑'); await until(dialog, 'edit dialog');
assert.equal(document.querySelector('#book-name').value, '阅读生词');
input('#book-name', '英文阅读生词'); input('#book-description', ''); click('保存修改', dialog());
await until(() => !dialog() && document.querySelector('.library-card h2')?.textContent === '英文阅读生词', 'updated book');
assert.deepEqual(calls.find(call => call.url === `/word-books/${book.id}` && call.method === 'put').data, { name: '英文阅读生词', description: null });
console.log('PASS personal list/scope, create validation, edit and explicit description clearing');

await router.push(`/books/${book.id}`);
await until(() => document.querySelector('.wordlist-heading h1')?.textContent === '英文阅读生词', 'direct detail');
await until(() => document.querySelector('.state-panel')?.textContent.includes('词本还是空的'), 'empty personal detail');
assert.ok(calls.some(call => call.url === `/word-books/${book.id}` && call.method === 'get'));
click('搜索收词'); await until(dialog, 'collector');
await until(() => document.activeElement === document.querySelector('input[aria-label="搜索全局词库"]'), 'initially opened collector focuses its input');
assert.equal(document.body.style.overflow, 'hidden');
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await until(() => !dialog(), 'Escape closes collector mounted in open state');
assert.equal(document.body.style.overflow, '');
await readyClick('搜索收词'); await until(dialog, 'collector reopens');
const beforeBlank = calls.filter(call => call.url === '/words').length;
click('搜索词库', dialog());
await until(() => dialog()?.textContent.includes('请输入'), 'empty dictionary validation');
assert.equal(calls.filter(call => call.url === '/words').length, beforeBlank);
input('input[aria-label="搜索全局词库"]', '  a  '); click('搜索词库', dialog());
await until(() => document.querySelectorAll('.dictionary-word').length === 10, 'prefix results');
assert.deepEqual(calls.filter(call => call.url === '/words').at(-1).params, { keyword: 'a', matchType: 'PREFIX', bookId: book.id, page: 1, size: 10 });
select(document.querySelector('input[aria-label="收录 abandon #1001"]'));
select(document.querySelector('input[aria-label="收录 abandon #2001"]'));
document.querySelector('.dictionary-collector button[aria-label="下一页"]').click();
await until(() => !document.querySelector('input[aria-label="收录 abandon #1001"]') && document.querySelectorAll('.dictionary-word').length === 10, 'next dictionary page');
const thirdId = Number(document.querySelector('.dictionary-word input').getAttribute('aria-label').split('#')[1]);
select(document.querySelector('.dictionary-word input'));
input('input[aria-label="搜索全局词库"]', 'abandon');
const match = document.querySelector('.dictionary-search select'); match.value = 'EXACT'; match.dispatchEvent(new window.Event('change', { bubbles: true }));
click('搜索词库', dialog());
await until(() => document.querySelectorAll('.dictionary-word').length === 4, 'exact results preserve duplicate spelling by ID');
assert.match(document.querySelector('.dictionary-collector .wordlist-selection').textContent, /已选 3 词/);
failNext(config => config.url === `/word-books/${book.id}/words` && config.method === 'post', 'BOOK_ORDER_LIMIT', '词本追加排序超出范围，原词本不变');
click('收录所选 3 词', dialog());
await until(() => dialog()?.textContent.includes('词本追加排序超出范围'), 'atomic collection failure');
assert.match(document.querySelector('.dictionary-collector .wordlist-selection').textContent, /已选 3 词/);
await readyClick('收录所选 3 词', '[role="dialog"]');
await until(() => !dialog() && document.querySelectorAll('.preview-word-row').length === 3, 'collection success');
assert.equal(writes().filter(call => call.url === '/learning-plan/words').length, 0, 'collecting never joins plan');
assert.equal((await dailyApi.today()).task, null, 'collecting never starts daily task');
assert.equal((await dailyApi.plan({ page: 1, size: 100, status: 'ACTIVE', learningStatus: 'ALL' })).total, 0);
assert.deepEqual((await api.words(book.id, { page: 1, size: 100, learningStatus: 'ALL' })).records.map(word => word.id), [1001, 2001, thirdId]);
console.log('PASS dictionary prefix/exact query contract, cross-page selection, same spelling distinct IDs, atomic errors and collection without plan writes');

await readyClick('搜索收词'); await until(dialog, 'reopen collector');
input('input[aria-label="搜索全局词库"]', 'abandon'); click('搜索词库', dialog());
await until(() => document.querySelector('input[aria-label="收录 abandon #1001"]')?.disabled === true, 'server inBook disables collected IDs');
assert.equal(document.querySelector('input[aria-label="收录 abandon #2001"]').disabled, true);
input('input[aria-label="搜索全局词库"]', '%_!\\'); click('搜索词库', dialog());
await until(() => dialog()?.textContent.includes('词库中未找到匹配单词，请检查拼写'), 'literal no-match dictionary feedback');
assert.equal(calls.filter(call => call.url === '/words').at(-1).params.keyword, '%_!\\');
click('关闭', dialog()); await until(() => !dialog(), 'close collector');
select(document.querySelector('.wordlist-selection input'));
await readyClick('加入学习计划');
await until(() => document.querySelector('.live-notice')?.textContent.includes('新增 3'), 'join selection through original endpoint');
assert.deepEqual(calls.filter(call => call.url === '/learning-plan/words' && call.method === 'post').at(-1).data, { bookId: book.id, wordIds: [1001, 2001, thirdId] });
assert.deepEqual([(await api.book(book.id)).unlearnedCount, (await api.book(book.id)).startedCount], [3, 0]);
seedHistoricalPractice(localStorage, 'books_reader', (await api.words(book.id, { page: 1, size: 100, learningStatus: 'ALL' })).records);
const practiceBefore = localStorage.getItem('wordtrail.mock.books_reader');
const task = await dailyApi.start();
const dailyWord = await dailyApi.item(task.batchId, task.nextItemId);
await dailyApi.answer(task.batchId, dailyWord.itemId, { result: 1, attemptNo: dailyWord.nextAttemptNo, requestId: crypto.randomUUID() });
const dailyBefore = await dailyApi.task(task.batchId);
const historyBefore = await dailyApi.history(1001, { page: 1, size: 20 });
await router.push('/today'); await until(() => document.querySelector('.today-cta'), 'away from detail');
await router.push(`/books/${book.id}`);
await until(() => document.querySelector('.book-detail-copy .book-progress')?.textContent.includes('已开始1'), 'detail progress refreshes despite cached metadata');
assert.deepEqual((await api.book(book.id)).startedCount, 1);
const plansBefore = await dailyApi.plan({ page: 1, size: 100, status: 'ACTIVE', learningStatus: 'ALL' });
select(document.querySelector('.wordlist-selection input')); await readyClick('移出所选');
await until(dialog, 'remove confirmation');
assert.match(dialog().textContent, /学习计划与历史保留/);
failNext(config => config.method === 'delete', 'WORD_NOT_FOUND', '部分单词不存在于词库，未修改词本', 404);
click('确认移出词本', dialog());
await until(() => dialog()?.textContent.includes('部分单词不存在'), 'remove failure retained');
assert.match(document.querySelector('.selected-count').textContent, /3/);
assert.equal(document.querySelectorAll('.preview-word-row').length, 3);
await readyClick('确认移出词本', '[role="dialog"]');
await until(() => !dialog() && document.querySelectorAll('.preview-word-row').length === 0 && document.querySelector('.book-detail-copy .book-progress')?.textContent.includes('未学0'), 'remove all refreshes empty page and progress');
const deletion = calls.filter(call => call.method === 'delete').at(-1);
assert.equal(deletion.url, `/word-books/${book.id}/words`);
assert.deepEqual(deletion.data, { wordIds: [1001, 2001, thirdId] });
assert.equal(deletion.params, undefined, 'DELETE IDs belong in JSON, not query');
assert.deepEqual(await dailyApi.plan({ page: 1, size: 100, status: 'ACTIVE', learningStatus: 'ALL' }), plansBefore);
assert.deepEqual(await dailyApi.task(task.batchId), dailyBefore);
assert.deepEqual(await dailyApi.history(1001, { page: 1, size: 20 }), historyBefore);
assert.equal(localStorage.getItem('wordtrail.mock.books_reader'), practiceBefore, 'removing book membership preserves archived practice evidence');
const nextDaily = await dailyApi.item(task.batchId, dailyBefore.nextItemId);
await dailyApi.answer(task.batchId, nextDaily.itemId, { result: 1, attemptNo: nextDaily.nextAttemptNo, requestId: crypto.randomUUID() });
assert.equal((await dailyApi.task(task.batchId)).completedCount, 2);
await assert.rejects(dailyApi.join(book.id, [1001]), error => error.code === 'INVALID_PARAMETER');
await assert.rejects(api.collectWords(book.id, [1001, 999999]), error => error.code === 'WORD_NOT_FOUND');
assert.equal((await api.book(book.id)).wordCount, 0);
await api.collectWords(book.id, [1001]);
assert.equal((await api.book(book.id)).startedCount, 1, 'shared state survives removal and recollection');
console.log('PASS original plan joining, server progress, DELETE JSON and failure retention; removal preserves plan, daily queue and historical practice evidence');

const paginationBook = await api.createBook({ name: '分页词本', description: null });
await api.collectWords(paginationBook.id, Array.from({ length: 11 }, (_, index) => 1001 + index));
await router.push(`/books/${paginationBook.id}`);
await until(() => document.querySelector('.wordlist-heading h1')?.textContent === '分页词本' && document.querySelectorAll('.preview-word-row').length === 10, 'paginated personal book');
select(document.querySelector('.preview-word-row input'));
document.querySelector('.wordlist-sheet button[aria-label="下一页"]').click();
await until(() => document.querySelectorAll('.preview-word-row').length === 1, 'last book page');
select(document.querySelector('.preview-word-row input'));
await until(() => document.querySelector('.selected-count')?.textContent.includes('2'), 'cross-page book selection');
await readyClick('移出所选'); await until(dialog, 'cross-page removal confirmation');
click('确认移出词本', dialog());
await until(() => !dialog() && document.querySelectorAll('.preview-word-row').length === 9, 'last-page removal returns to existing first page');
assert.deepEqual(calls.filter(call => call.method === 'delete').at(-1).data.wordIds, [1001, 1011]);
assert.equal(document.querySelector('.wordlist-sheet button[aria-label="上一页"]').disabled, true);
console.log('PASS cross-page bulk removal and automatic page recovery when the last page disappears');

await router.push('/books/1');
await until(() => document.querySelector('.wordlist-heading h1')?.textContent === '四级核心词汇' && document.querySelectorAll('.preview-word-row').length === 10, 'system detail');
select(document.querySelector('.preview-word-row input'));
const randomWrites = writes().length;
await readyClick('随机选词');
await until(() => dialog()?.querySelectorAll('.random-word').length > 0, 'random selection loads');
assert.equal(writes().length, randomWrites, 'random selection is read-only');
assert.match(dialog().textContent, /替换当前已选的 1 词/);
assert.deepEqual(calls.filter(call => call.url === '/word-books/1/words/random').at(-1).params, { count: 100 });
input('#random-word-count', '2');
click('重新挑选', dialog());
await until(() => dialog()?.querySelectorAll('.random-word').length === 2, 'random redraw uses requested count');
assert.deepEqual(calls.filter(call => call.url === '/word-books/1/words/random').at(-1).params, { count: 2 });
const chosenWords = [...dialog().querySelectorAll('.random-word strong')].map(element => element.textContent);
const removedChoice = dialog().querySelector('.random-word input');
removedChoice.checked = false; removedChoice.dispatchEvent(new window.Event('change', { bubbles: true }));
await readyClick('确认选择 1 词', '[role="dialog"]');
await until(() => !dialog() && document.querySelector('.selected-count')?.textContent.includes('1'), 'random selection applied');
assert.equal(writes().length, randomWrites, 'confirming selection does not join the plan');
await readyClick('加入学习计划');
await until(() => document.querySelector('.live-notice')?.textContent.includes('新增 1'), 'random choice joins through existing endpoint');
const randomJoin = calls.filter(call => call.url === '/learning-plan/words' && call.method === 'post').at(-1).data;
assert.equal(randomJoin.bookId, 1); assert.equal(randomJoin.wordIds.length, 1);
assert.equal((await api.words(1, { page: 1, size: 100, learningStatus: 'ALL' })).records.find(word => word.id === randomJoin.wordIds[0]).word, chosenWords[1]);
console.log('PASS random preview, replace selection, deselection and explicit plan join');
assert.equal([...document.querySelectorAll('button')].some(button => ['编辑词本', '搜索收词', '移出所选'].includes(button.textContent.trim())), false);
await assert.rejects(api.updateBook(1, { name: 'no', description: null }), error => error.code === 'BOOK_READ_ONLY');
await assert.rejects(api.removeBookWords(1, [1001]), error => error.code === 'BOOK_READ_ONLY');
await router.push('/books/999999');
await until(() => document.querySelector('.state-panel')?.textContent.includes('词本不存在'), 'missing detail');
assert.equal([...document.querySelectorAll('button')].find(button => button.textContent.includes('加入学习计划')).disabled, true);
await router.push('/books');
await until(() => document.querySelectorAll('.library-card').length === 6, 'all books after creation');
click('系统词书'); await until(() => document.querySelectorAll('.library-card').length === 4, 'system scope');
document.querySelector('button[aria-label="打开账户菜单"]').click(); await until(dialog, 'profile');
click('退出登录', dialog()); await until(() => document.querySelector('#username'), 'logout');
input('#username', 'other_books_reader'); input('#password', 'example123'); click('登录');
await until(() => document.querySelector('.daily-equation'), 'other account');
await assert.rejects(api.book(book.id), error => error.code === 'BOOK_NOT_FOUND');
assert.equal((await api.books({ scope: 'PERSONAL', page: 1, size: 20 })).total, 0);
console.log('PASS editable gates, system read-only, inaccessible detail and account isolation');
console.log('Personal-book Vue DOM/API fixture checks passed. Real backend and browser layout are separate checks.');
await window.happyDOM.close();
