// Explicit offline fixture adapter. Never installed in real API mode.
import { AxiosError, AxiosHeaders, type AxiosAdapter } from "axios";
import { mockDaily, mockLearned } from './mockDaily';
import { mockBooks, personalBookName, personalWordIds } from './mockBooks';
import type {
  Book,
  BookWord,
  Result,
  Status,
  StudyItem,
  User,
} from "../types/api";
const books: Pick<Book, 'id' | 'name' | 'description' | 'wordCount'>[] = [
  {
    id: 1,
    name: "四级核心词汇",
    description: "从基础出发，积累阅读与表达中常用的核心词汇。",
    wordCount: 32,
  },
  {
    id: 2,
    name: "六级进阶词汇",
    description: "拓展词汇的深度，在语境之外理解每个词的含义。",
    wordCount: 24,
  },
  {
    id: 3,
    name: "日常英语词汇",
    description: "让日常交流更自然，从生活中的常用词开始。",
    wordCount: 20,
  },
  {
    id: 4,
    name: "学术阅读词汇",
    description: "阅读、思考与研究，建立自己的学术词汇基础。",
    wordCount: 16,
  },
];
const vocabulary = [
  ["abandon", "/əˈbændən/", "v. 放弃；遗弃"],
  ["absorb", "/əbˈzɔːb/", "v. 吸收；理解；使全神贯注"],
  ["abstract", "/ˈæbstrækt/", "adj. 抽象的；n. 摘要"],
  ["abundant", "/əˈbʌndənt/", "adj. 丰富的；充裕的"],
  ["academic", "/ˌækəˈdemɪk/", "adj. 学术的；学院的"],
  ["accelerate", "/əkˈseləreɪt/", "v. 加速；促进"],
  ["accept", "/əkˈsept/", "v. 接受；认可"],
  ["access", "/ˈækses/", "n. 入口；使用权；v. 访问"],
  [
    "accommodate",
    "/əˈkɒmədeɪt/",
    "v. 容纳；为……提供住宿；使适应新的情况或需求",
  ],
  ["accomplish", "/əˈkʌmplɪʃ/", "v. 完成；实现"],
  ["accurate", "/ˈækjərət/", "adj. 准确的"],
  ["achieve", "/əˈtʃiːv/", "v. 实现；达到"],
  ["acknowledge", "/əkˈnɒlɪdʒ/", "v. 承认；致谢"],
  ["acquire", "/əˈkwaɪə/", "v. 获得；习得"],
  ["adapt", "/əˈdæpt/", "v. 适应；改编"],
  ["adequate", "/ˈædɪkwət/", "adj. 足够的；适当的"],
  ["adjust", "/əˈdʒʌst/", "v. 调整；适应"],
  ["admire", "/ədˈmaɪə/", "v. 钦佩；欣赏"],
  ["advance", "/ədˈvɑːns/", "v. 前进；n. 进展"],
  ["advantage", "/ədˈvɑːntɪdʒ/", "n. 优势；有利条件"],
  ["affect", "/əˈfekt/", "v. 影响"],
  ["afford", "/əˈfɔːd/", "v. 负担得起"],
  ["alternative", "/ɔːlˈtɜːnətɪv/", "n. 可供选择的事物"],
  ["ambitious", "/æmˈbɪʃəs/", "adj. 有抱负的"],
  ["analyse", "/ˈænəlaɪz/", "v. 分析"],
  ["anticipate", "/ænˈtɪsɪpeɪt/", "v. 预期；预料"],
  ["appreciate", "/əˈpriːʃieɪt/", "v. 欣赏；感激"],
  ["approach", "/əˈprəʊtʃ/", "n. 方法；v. 接近"],
  ["appropriate", "/əˈprəʊpriət/", "adj. 合适的"],
  ["architecture", "/ˈɑːkɪtektʃə/", "n. 建筑学；体系结构"],
  [
    "characteristically",
    "/ˌkærəktəˈrɪstɪkli/",
    "adv. 典型地；表现出自身鲜明特征地",
  ],
  [
    "interdisciplinary",
    "/ˌɪntədɪsəˈplɪnəri/",
    "adj. 跨学科的；涉及多个专业领域的研究与合作",
  ],
];
interface MockItem extends StudyItem {
  meaning: string | null;
}
interface MockBatch {
  id: number;
  bookId: number;
  selectionType: "BOOK" | "MANUAL";
  status: Status;
  createdAt: string;
  updatedAt: string;
  items: MockItem[];
}
interface Database {
  batches: MockBatch[];
  nextId: number;
}
const now = () => new Date().toISOString().slice(0, 19);
function accountId(username: string) {
  let hash = 0;
  for (const character of username.toLowerCase()) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  return (hash >>> 0) + 1;
}
function user(): User | null {
  return JSON.parse(
    sessionStorage.getItem("wordtrail.mock.user") || "null",
  ) as User | null;
}
function db(): Database {
  return JSON.parse(
    localStorage.getItem(`wordtrail.mock.${user()?.username}`) ||
      '{"batches":[],"nextId":1}',
  ) as Database;
}
function save(value: Database) {
  localStorage.setItem(
    `wordtrail.mock.${user()?.username}`,
    JSON.stringify(value),
  );
}
function systemWords(id: number): BookWord[] {
  const book = books.find((b) => b.id === id);
  if (!book) fail(404, "BOOK_NOT_FOUND", "词书不存在");
  return vocabulary
    .slice(0, book.wordCount)
    .map(([word, phonetic, translation], i) => {
      const answer = mockLearned(user()!.username, id * 1000 + i + 1);
      return {
        id: id * 1000 + i + 1,
        word: word!,
        phonetic: phonetic!,
        translation: translation!,
        learned: !!answer?.firstLearnedAt,
        lastResult: answer?.lastResult ?? null,
      };
    });
}
function bookWords(id: number, _state: Database): BookWord[] {
  if (books.some(book => book.id === id)) return systemWords(id);
  const dictionary = books.flatMap(book => systemWords(book.id));
  return personalWordIds(user()!.username, id).map(wordId => dictionary.find(word => word.id === wordId)!);
}
function fail(status: number, code: string, message: string): never {
  throw { status, code, message };
}
function create(
  state: Database,
  bookId: number,
  selectionType: "BOOK" | "MANUAL",
  words: BookWord[],
) {
  if (!words.length)
    fail(
      409,
      "NO_UNLEARNED_WORDS",
      "这本词书没有可选的未学单词，请手动选词学习。",
    );
  const id = state.nextId++;
  const batch: MockBatch = {
    id,
    bookId,
    selectionType,
    status: "IN_PROGRESS",
    createdAt: now(),
    updatedAt: now(),
    items: words.map((word, i) => ({
      itemId: id * 1000 + i + 1,
      wordId: word.id,
      word: word.word,
      phonetic: word.phonetic,
      sortOrder: i + 1,
      result: null,
      answered: false,
      answeredAt: null,
      nextItemId: i < words.length - 1 ? id * 1000 + i + 2 : null,
      meaning: word.translation,
    })),
  };
  state.batches.push(batch);
  save(state);
  return {
    batchId: id,
    bookId,
    selectionType,
    status: batch.status,
    wordCount: words.length,
  };
}
export const mockAdapter: AxiosAdapter = async (config) => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const response = (
    data: unknown,
    status = 200,
    code = "OK",
    message = "成功",
  ) => ({
    config,
    data: { code, message, data },
    status,
    statusText: String(status),
    headers: new AxiosHeaders(),
  });
  try {
    const url = config.url || "";
    const body = (
      typeof config.data === "string"
        ? JSON.parse(config.data)
        : config.data || {}
    ) as Record<string, unknown>;
    const query = new URLSearchParams(Object.entries((config.params || {}) as Record<string, unknown>).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => [key, String(value)]));
    const paginate = <T>(records: T[]) => {
      const page = Number(query.get("page") || 1);
      const size = Number(query.get("size") || 20);
      return {
        page,
        size,
        total: records.length,
        records: records.slice((page - 1) * size, page * size),
      };
    };
    if (url === "/auth/register")
      return response(
        { id: accountId(String(body.username)), username: body.username, nickname: body.nickname || null },
        201,
      );
    if (url === "/auth/login" || url === "/auth/refresh") {
      const account = url.endsWith("login")
        ? {
            id: accountId(String(body.username)),
            username: String(body.username).toLowerCase(),
            nickname: null,
          }
        : user();
      if (!account) fail(401, "INVALID_REFRESH_TOKEN", "登录已过期");
      sessionStorage.setItem("wordtrail.mock.user", JSON.stringify(account));
      return response({
        accessToken: `mock-access-${Date.now()}`,
        refreshToken: `mock-refresh-${Date.now()}`,
        tokenType: "Bearer",
        expiresIn: 1800,
        user: account,
      });
    }
    if (url === "/auth/logout") {
      sessionStorage.removeItem("wordtrail.mock.user");
      return response(null);
    }
    if (!user() || !config.headers.get("Authorization"))
      fail(401, "UNAUTHENTICATED", "请先登录");
    if (url === "/auth/me") return response(user());
    const state = db();
    const daily = mockDaily(user()!.username, url, config.method || 'get', body, query, id => bookWords(id, state));
    if (daily) return response(daily.data);
    const bookResult = mockBooks(user()!.username, url, config.method || 'get', body, query, books, books.flatMap(book => systemWords(book.id)), id => bookWords(id, state));
    if (bookResult) return response(bookResult.data, bookResult.status);
    if (url === "/learning-batches" && config.method === "post") {
      const words = bookWords(Number(body.bookId), state);
      const manual = body.selectionType === "MANUAL";
      return response(
        create(
          state,
          Number(body.bookId),
          manual ? "MANUAL" : "BOOK",
          manual
            ? words.filter((w) => (body.wordIds as number[]).includes(w.id))
            : words
                .filter((w) => !w.learned)
                .slice(0, Number(body.count || 20)),
        ),
        201,
      );
    }
    if (url === "/learning-batches")
      return response(
        paginate(
          state.batches
            .filter((b) => b.status === (query.get("status") || "IN_PROGRESS"))
            .reverse()
            .map((b) => ({
              batchId: b.id,
              bookId: b.bookId,
              bookName: books.find(book => book.id === b.bookId)?.name ?? personalBookName(user()!.username, b.bookId) ?? null,
              selectionType: b.selectionType,
              status: b.status,
              totalCount: b.items.length,
              answeredCount: b.items.filter((i) => i.answered).length,
              nextItemId: b.items.find((i) => !i.answered)?.itemId ?? null,
              createdAt: b.createdAt,
              updatedAt: b.updatedAt,
            })),
        ),
      );
    const match = url.match(/^\/learning-batches\/(\d+)(.*)$/);
    if (!match) fail(404, "NOT_FOUND", "接口不存在");
    const batch = state.batches.find((b) => b.id === Number(match[1]));
    if (!batch) fail(404, "BATCH_NOT_FOUND", "找不到这一轮学习");
    const answered = () => batch.items.filter((i) => i.answered).length;
    const next = () => batch.items.find((i) => !i.answered)?.itemId ?? null;
    const progress = () => ({
      batchId: batch.id,
      bookId: batch.bookId,
      selectionType: batch.selectionType,
      status: batch.status,
      wordCount: batch.items.length,
      answeredCount: answered(),
      nextItemId: next(),
    });
    const suffix = match[2];
    if (!suffix) return response(progress());
    const itemMatch = suffix?.match(/^\/items\/(\d+)(\/answer)?$/);
    if (itemMatch) {
      const item = batch.items.find((i) => i.itemId === Number(itemMatch[1]));
      if (!item) fail(404, "ITEM_NOT_FOUND", "单词不存在");
      if (itemMatch[2]) {
        if (![1, 2, 3].includes(Number(body.result)))
          fail(400, "INVALID_PARAMETER", "请选择自评结果");
        if (!item.answered && item.itemId !== next())
          fail(409, "ANSWER_OUT_OF_ORDER", "请按顺序作答");
        if (item.result !== body.result) {
          item.result = body.result as Result;
          item.answered = true;
          item.answeredAt = now();
          batch.updatedAt = now();
        }
        if (answered() === batch.items.length) batch.status = "COMPLETED";
        save(state);
        return response({
          ...progress(),
          itemId: item.itemId,
          result: item.result,
          translation: item.meaning,
          answeredAt: item.answeredAt,
        });
      }
      const { meaning, ...study } = item;
      return response({
        ...study,
        ...(item.answered ? { translation: meaning } : {}),
      });
    }
    if (batch.status !== "COMPLETED")
      fail(409, "BATCH_NOT_COMPLETED", "本轮尚未完成");
    if (suffix === "/result")
      return response({
        batchId: batch.id,
        bookId: batch.bookId,
        bookName: books.find((b) => b.id === batch.bookId)?.name ?? personalBookName(user()!.username, batch.bookId) ?? null,
        totalCount: batch.items.length,
        knownCount: batch.items.filter((i) => i.result === 1).length,
        uncertainCount: batch.items.filter((i) => i.result === 2).length,
        unknownCount: batch.items.filter((i) => i.result === 3).length,
        relearnCount: batch.items.filter((i) => i.result !== 1).length,
        completedAt: batch.updatedAt,
      });
    if (suffix === "/result/words")
      return response(
        paginate(
          batch.items
            .filter(
              (i) =>
                !query.get("result") ||
                i.result === Number(query.get("result")),
            )
            .map((i) => ({ ...i, translation: i.meaning })),
        ),
      );
    if (suffix === "/relearn") {
      const ids = batch.items
        .filter((i) => i.result === 2 || i.result === 3)
        .map((i) => i.wordId);
      if (!ids.length) fail(409, "NO_RELEARN_WORDS", "本轮没有需要重学的单词");
      return response(
        create(
          state,
          batch.bookId,
          "MANUAL",
          batch.items.filter(item => ids.includes(item.wordId)).map(item => ({ id: item.wordId, word: item.word, phonetic: item.phonetic, translation: item.meaning, learned: false, lastResult: null })),
        ),
        201,
      );
    }
    fail(404, "NOT_FOUND", "接口不存在");
  } catch (e) {
    const problem = e as { status?: number; code?: string; message?: string };
    const result = response(
      null,
      problem.status || 500,
      problem.code || "INTERNAL_ERROR",
      problem.message || "演示数据处理失败",
    );
    throw new AxiosError(
      result.data.message,
      AxiosError.ERR_BAD_RESPONSE,
      config,
      undefined,
      result,
    );
  }
};
