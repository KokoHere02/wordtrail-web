// Explicit offline fixtures only; never installed as a fallback for real API errors.
import type { Book, BookWord } from '../types/api';
import { mockLearned } from './mockDaily';
type SystemBook = Pick<Book, 'id' | 'name' | 'description' | 'wordCount'>;
interface PersonalBook { id: number; name: string; description: string | null; wordIds: number[] }
interface State { books: PersonalBook[]; nextId: number }
function read(account: string): State {
  return JSON.parse(localStorage.getItem(`wordory.mock.books.${account}`) || '{"books":[],"nextId":301}') as State;
}
function fail(status: number, code: string, message: string): never { throw { status, code, message }; }
export function personalWordIds(account: string, id: number): number[] {
  const book = read(account).books.find(entry => entry.id === id);
  if (!book) fail(404, 'BOOK_NOT_FOUND', '词本不存在或无权访问');
  return book.wordIds;
}
export function personalBookName(account: string, id: number) { return read(account).books.find(book => book.id === id)?.name; }
export function personalBooksForWord(account: string, wordId: number) {
  return read(account).books.filter(book => book.wordIds.includes(wordId)).sort((a, b) => a.id - b.id).map(book => ({ id: book.id, name: book.name }));
}
export function mockBooks(account: string, url: string, method: string, body: Record<string, unknown>, query: URLSearchParams, system: SystemBook[], dictionary: BookWord[], catalog: (id: number) => BookWord[]) {
  if (!/^\/word-books(?:\/|$)/.test(url) && url !== '/words') return;
  const state = read(account);
  const respond = (data: unknown, status = 200) => {
    localStorage.setItem(`wordory.mock.books.${account}`, JSON.stringify(state));
    return { data, status };
  };
  const paginate = <T>(records: T[]) => {
    const page = Number(query.get('page') || 1), size = Number(query.get('size') || 20);
    return { page, size, total: records.length, records: records.slice((page - 1) * size, page * size) };
  };
  const lookup = (id: number) => {
    const book = system.find(entry => entry.id === id) || state.books.find(entry => entry.id === id);
    if (!book) fail(404, 'BOOK_NOT_FOUND', '词本不存在或无权访问');
    return book;
  };
  const describe = (book: SystemBook | PersonalBook): Book => {
    const words = catalog(book.id);
    const startedCount = words.filter(word => mockLearned(account, word.id)?.firstLearnedAt).length;
    const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(' ', 'T');
    const dueCount = words.filter(word => {
      const plan = mockLearned(account, word.id);
      return plan?.firstLearnedAt && plan.planStatus === 'ACTIVE' && plan.nextReviewAt && plan.nextReviewAt <= now;
    }).length;
    const editable = 'wordIds' in book;
    return { id: book.id, name: book.name, description: book.description, wordCount: words.length, unlearnedCount: words.length - startedCount, startedCount, dueCount, bookType: editable ? 'PERSONAL' : 'SYSTEM', editable };
  };
  function metadata() {
    if (Object.keys(body).some(key => !['name', 'description'].includes(key)) || typeof body.name !== 'string' || !body.name.trim() || Array.from(body.name.trim()).length > 128 || body.description != null && (typeof body.description !== 'string' || Array.from(body.description.trim()).length > 2000)) fail(400, 'INVALID_PARAMETER', '词本名称或描述不合法');
    return { name: (body.name as string).trim(), description: typeof body.description === 'string' ? body.description.trim() || null : null };
  }
  if (url === '/word-books' && method === 'post') {
    const book: PersonalBook = { ...metadata(), id: state.nextId++, wordIds: [] };
    state.books.push(book);
    // describe reads personal membership through the catalog callback.
    localStorage.setItem(`wordory.mock.books.${account}`, JSON.stringify(state));
    return respond(describe(book), 201);
  }
  if (url === '/word-books') {
    const scope = query.get('scope') || 'ALL';
    if (!['ALL', 'SYSTEM', 'PERSONAL'].includes(scope)) fail(400, 'INVALID_PARAMETER', '词本范围不合法');
    const keyword = query.get('keyword') || '';
    return respond(paginate([...system, ...state.books].filter(book => book.name.includes(keyword) && (scope === 'ALL' || (scope === 'PERSONAL') === ('wordIds' in book))).sort((a, b) => a.id - b.id).map(describe)));
  }
  if (url === '/words') {
    const keyword = (query.get('keyword') || '').trim();
    const matchType = query.get('matchType') || 'PREFIX';
    if (!keyword || Array.from(keyword).length > 255 || !['PREFIX', 'EXACT'].includes(matchType)) fail(400, 'INVALID_PARAMETER', '搜索参数不合法');
    const bookId = query.has('bookId') ? Number(query.get('bookId')) : null;
    if (bookId !== null) lookup(bookId);
    const ids = bookId === null ? null : new Set(catalog(bookId).map(word => word.id));
    const results = dictionary.filter(word => matchType === 'EXACT' ? word.word === keyword : word.word.startsWith(keyword)).sort((a, b) => a.word < b.word ? -1 : a.word > b.word ? 1 : a.id - b.id);
    return respond(paginate(results.map(({ id, word, phonetic, translation, translationGroups }) => ({ id, word, phonetic, translation, translationGroups, inBook: ids ? ids.has(id) : null }))));
  }
  const randomMatch = url.match(/^\/word-books\/(\d+)\/words\/random$/);
  if (randomMatch && method === 'get') {
    const id = Number(randomMatch[1]); lookup(id);
    const count = Number(query.get('count') || 100);
    if (!Number.isInteger(count) || count < 1 || count > 100) fail(400, 'INVALID_PARAMETER', '数量须为 1～100');
    const words = catalog(id).filter(word => !mockLearned(account, word.id));
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j]!, words[i]!];
    }
    return { data: words.slice(0, count), status: 200 };
  }
  const match = url.match(/^\/word-books\/(\d+)(?:\/words(?:\/(\d+))?)?$/);
  if (!match) fail(404, 'NOT_FOUND', '演示接口不存在');
  const id = Number(match[1]);
  const book = lookup(id);
  if (method === 'get') {
    if (!url.includes('/words')) return respond(describe(book));
    const keyword = query.get('keyword') || '';
    const status = query.get('learningStatus') || 'ALL';
    return respond(paginate(catalog(id).filter(word => word.word.startsWith(keyword) && (status === 'LEARNED' ? word.learned : status === 'UNLEARNED' ? !word.learned : true))));
  }
  if (!('wordIds' in book)) fail(403, 'BOOK_READ_ONLY', '系统词书只读，请创建个人词本');
  if (method === 'put' && !url.includes('/words')) { Object.assign(book, metadata()); return respond(describe(book)); }
  const wordIds = match[2] ? [Number(match[2])] : Array.isArray(body.wordIds) ? [...new Set(body.wordIds)] : [];
  if (!wordIds.length || wordIds.length > 100 || wordIds.some(value => !Number.isInteger(value) || Number(value) < 1) || Object.keys(body).some(key => key !== 'wordIds')) fail(400, 'INVALID_PARAMETER', '请选择 1～100 个有效单词 ID');
  if (wordIds.some(value => !dictionary.some(word => word.id === value))) fail(404, 'WORD_NOT_FOUND', '部分单词不存在于词库，未修改词本');
  let changedCount = 0;
  for (const value of wordIds as number[]) {
    if (method === 'post' && !book.wordIds.includes(value)) { book.wordIds.push(value); changedCount++; }
    if (method === 'delete' && book.wordIds.includes(value)) { book.wordIds = book.wordIds.filter(wordId => wordId !== value); changedCount++; }
  }
  return respond({ requestedCount: wordIds.length, changedCount, unchangedCount: wordIds.length - changedCount });
}
