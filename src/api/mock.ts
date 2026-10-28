// Explicit offline fixture adapter. Never installed in real API mode.
import { AxiosError, AxiosHeaders, type AxiosAdapter } from "axios";
import { mockDaily, mockLearned } from './mockDaily';
import { mockBooks, personalWordIds } from './mockBooks';
import { mockWordStudy, type StudyLog } from './mockWordStudy';
import { mockInsights } from './mockInsights';
import type { TranslationGroup } from '../types/translation';
import type {
  Book,
  BookWord,
  Result,
  Status,
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
// Explicit structured fixtures, not a client-side parser of legacy translations.
// Other words retain old responses to exercise the documented fallback.
const groupedMeanings: Record<string, readonly TranslationGroup[]> = {
  abandon: [{ partOfSpeech: 'v.', meaning: '放弃；遗弃' }],
  abstract: [{ partOfSpeech: 'adj.', meaning: '抽象的' }, { partOfSpeech: 'n.', meaning: '摘要' }],
  access: [{ partOfSpeech: 'n.', meaning: '入口；使用权' }, { partOfSpeech: 'v.', meaning: '访问' }],
};
// Stored legacy items are read-only evidence for history and statistics.
interface MockItem {
  itemId: number; wordId: number; word: string; phonetic: string | null;
  sortOrder: number; result: Result | null; answered: boolean;
  answeredAt: string | null; nextItemId: number | null;
  translationGroups?: readonly TranslationGroup[];
  meaning: string | null;
}
interface MockBatch {
  id: number;
  bookId: number | null;
  selectionType: "BOOK" | "MANUAL";
  status: Status;
  createdAt: string;
  updatedAt: string;
  items: MockItem[];
}
interface Database {
  batches: MockBatch[];
  events: StudyLog[];
}
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
  const value = JSON.parse(
    localStorage.getItem(`wordtrail.mock.${user()?.username}`) ||
      '{"batches":[],"events":[]}',
  ) as Database;
  value.events ||= [];
  return value;
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
        translationGroups: groupedMeanings[word!],
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
    const practiceItems = () => state.batches.flatMap(batch => batch.items.map(item => ({ batchId: batch.id, itemId: item.itemId, wordId: item.wordId, result: item.result, answerCount: item.answered ? 1 : 0 })));
    const insights = mockInsights({ account: user()!.username, url, method: config.method || 'get', query, practiceEvents: state.events, practiceItems: practiceItems() });
    if (insights) return response(insights.data);
    const wordStudy = mockWordStudy({ account: user()!.username, url, method: config.method || 'get', body, query, dictionary: books.flatMap(book => systemWords(book.id)), practiceEvents: state.events, practiceItems: practiceItems() });
    if (wordStudy) return response(wordStudy.data, wordStudy.status);
    const daily = mockDaily(user()!.username, url, config.method || 'get', body, query, id => bookWords(id, state), state.events);
    if (daily) return response(daily.data);
    const bookResult = mockBooks(user()!.username, url, config.method || 'get', body, query, books, books.flatMap(book => systemWords(book.id)), id => bookWords(id, state));
    if (bookResult) return response(bookResult.data, bookResult.status);
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
