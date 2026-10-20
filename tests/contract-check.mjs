import assert from "node:assert/strict";
import { build } from "vite";
import { AxiosError, AxiosHeaders } from "axios";

class MemoryStorage {
  data = new Map();
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}
globalThis.sessionStorage = new MemoryStorage();
globalThis.localStorage = new MemoryStorage();
await build({
  configFile: false,
  mode: "mock",
  logLevel: "warn",
  build: {
    ssr: "tests/test-entry.ts",
    target: "es2022",
    outDir: ".qa-dist",
    emptyOutDir: true,
  },
});
const {
  api,
  http,
  tokens,
  refreshIdentity,
  setExpiredHandler,
  useSelection,
  useResource,
} = await import("../.qa-dist/test-entry.js");
let passed = 0;
async function check(name, test) {
  await test();
  passed++;
  console.log(`PASS ${name}`);
}
await check(
  "mock auth: explicit credentials flow and refresh rotation",
  async () => {
    await api.register({ username: "qa_reader", password: "example123" });
    const pair = await api.login({
      username: "qa_reader",
      password: "example123",
    });
    tokens.set(pair);
    assert.equal((await api.me()).username, "qa_reader");
    assert.equal(sessionStorage.getItem("password"), null);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const refreshed = await refreshIdentity();
    assert.notEqual(refreshed.refreshToken, pair.refreshToken);
  },
);
await check(
  "book catalog: search, empty results, pagination and real fixture counts",
  async () => {
    const books = await api.books({ page: 1, size: 2 });
    assert.equal(books.total, 4);
    assert.equal(books.records.length, 2);
    assert.equal(
      (await api.books({ page: 1, size: 2, keyword: "不存在" })).total,
      0,
    );
    const page = await api.words(1, {
      page: 2,
      size: 10,
      learningStatus: "ALL",
    });
    assert.equal(page.records.length, 10);
    assert.equal(page.total, 32);
    const prefix = await api.words(1, {
      page: 1,
      size: 10,
      learningStatus: "ALL",
      keyword: "abs",
    });
    assert.deepEqual(
      prefix.records.map((w) => w.word),
      ["absorb", "abstract"],
    );
  },
);
await check(
  "selection retains IDs across pages and only toggles the given page",
  async () => {
    const selection = useSelection();
    selection.toggle(1, true);
    selection.togglePage([11, 12], true);
    assert.equal(selection.count.value, 3);
    selection.togglePage([11, 12], false);
    assert.deepEqual([...selection.selected.value], [1]);
    selection.clear();
    assert.equal(selection.count.value, 0);
  },
);
let batchId;
await check(
  "BOOK selection uses ordered unlearned words; unanswered item has no translation",
  async () => {
    const batch = await api.create({
      bookId: 1,
      selectionType: "BOOK",
      count: 2,
    });
    batchId = batch.batchId;
    const progress = await api.progress(batchId);
    assert.equal(progress.answeredCount, 0);
    const item = await api.item(batchId, progress.nextItemId);
    assert.equal(item.word, "abandon");
    assert.equal(item.sortOrder, 1);
    assert.equal("translation" in item, false);
    await assert.rejects(api.answer(batchId, item.nextItemId, 1), /按顺序/);
  },
);
await check(
  "answer saves definition, remains idempotent, and known can be corrected",
  async () => {
    const progress = await api.progress(batchId);
    const item = await api.item(batchId, progress.nextItemId);
    const saved = await api.answer(batchId, item.itemId, 1);
    assert.match(saved.translation, /放弃/);
    assert.equal(saved.answeredCount, 1);
    const retried = await api.answer(batchId, item.itemId, 1);
    assert.equal(retried.answeredCount, 1);
    assert.equal(retried.answeredAt, saved.answeredAt);
    const corrected = await api.answer(batchId, item.itemId, 3);
    assert.equal(corrected.result, 3);
    assert.equal(corrected.answeredCount, 1);
  },
);
await check(
  "refresh resumes first unanswered; final answer completes the batch",
  async () => {
    const progress = await api.progress(batchId);
    assert.equal(progress.answeredCount, 1);
    const item = await api.item(batchId, progress.nextItemId);
    assert.equal(item.word, "absorb");
    assert.equal(item.answered, false);
    const saved = await api.answer(batchId, item.itemId, 2);
    assert.equal(saved.status, "COMPLETED");
    assert.equal(saved.nextItemId, null);
    assert.equal(
      (await api.batches({ page: 1, size: 10, status: "COMPLETED" })).total,
      1,
    );
    assert.equal(
      (await api.words(1, { page: 1, size: 10, learningStatus: "LEARNED" }))
        .total,
      0,
    );
  },
);
await check(
  "result counts are user self reports and filters match saved answers",
  async () => {
    const result = await api.result(batchId);
    assert.equal(result.totalCount, 2);
    assert.equal(result.knownCount, 0);
    assert.equal(result.uncertainCount, 1);
    assert.equal(result.unknownCount, 1);
    const words = await api.resultWords(batchId, {
      page: 1,
      size: 10,
      result: 3,
    });
    assert.equal(words.total, 1);
    assert.equal(words.records[0].word, "abandon");
  },
);
await check(
  "relearn creates a distinct batch and leaves source unchanged",
  async () => {
    const before = await api.result(batchId);
    const relearn = await api.relearn(batchId);
    assert.notEqual(relearn.batchId, batchId);
    assert.equal(relearn.wordCount, 2);
    assert.deepEqual(await api.result(batchId), before);
  },
);
await check(
  "manual selection preserves word-book order and handles long words",
  async () => {
    const batch = await api.create({
      bookId: 1,
      selectionType: "MANUAL",
      wordIds: [1032, 1001, 1031],
    });
    const progress = await api.progress(batch.batchId);
    assert.equal(
      (await api.item(batch.batchId, progress.nextItemId)).word,
      "abandon",
    );
    const words = await api.words(1, {
      page: 1,
      size: 10,
      learningStatus: "ALL",
      keyword: "character",
    });
    assert.equal(words.records[0].word, "characteristically");
  },
);
await check(
  "async resources discard stale responses and preserve readable errors",
  async () => {
    const resource = useResource();
    let resolveOld;
    const old = resource.load(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    await resource.load(async () => "new");
    resolveOld("old");
    await old;
    assert.equal(resource.data.value, "new");
    await resource.load(async () => {
      throw new Error("请求失败");
    });
    assert.equal(resource.error.value, "请求失败");
    assert.equal(resource.loading.value, false);
  },
);

// Test actual Axios interceptors with deterministic server responses, independent of fixture adapter.
const fixtureAdapter = http.defaults.adapter;
function ok(config, data) {
  return {
    config,
    data: { code: "OK", message: "成功", data },
    status: 200,
    statusText: "OK",
    headers: new AxiosHeaders(),
  };
}
function unauthorized(config, code = "UNAUTHENTICATED") {
  const response = {
    ...ok(config, null),
    status: 401,
    data: { code, message: "身份失效", data: null },
  };
  throw new AxiosError("401", "ERR_BAD_REQUEST", config, undefined, response);
}
function pair(suffix) {
  return {
    accessToken: `access-${suffix}`,
    refreshToken: `refresh-${suffix}`,
    tokenType: "Bearer",
    expiresIn: 1800,
    user: { id: 1, username: "qa_reader", nickname: null },
  };
}
await check(
  "concurrent 401 requests share exactly one refresh and each retries once",
  async () => {
    tokens.set(pair("old"));
    let refreshes = 0;
    let calls = 0;
    http.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return ok(config, pair("new"));
      }
      calls++;
      if (config.headers.get("Authorization") === "Bearer access-old")
        unauthorized(config);
      return ok(config, { id: 1, username: "qa_reader", nickname: null });
    };
    const users = await Promise.all([api.me(), api.me(), api.me()]);
    assert.equal(users.length, 3);
    assert.equal(refreshes, 1);
    assert.equal(calls, 6);
  },
);
await check(
  "login failure never refreshes; invalid refresh clears identity once",
  async () => {
    let refreshes = 0;
    let expired = 0;
    setExpiredHandler(() => expired++);
    http.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") refreshes++;
      unauthorized(config);
    };
    await assert.rejects(
      api.login({ username: "qa_reader", password: "bad-pass" }),
    );
    assert.equal(refreshes, 0);
    await assert.rejects(api.me());
    assert.equal(refreshes, 1);
    assert.equal(expired, 1);
    assert.equal(tokens.access(), null);
    assert.equal(tokens.refresh(), null);
  },
);
await check(
  "a request that remains 401 after refresh stops after one retry",
  async () => {
    tokens.set(pair("retry"));
    let calls = 0;
    let refreshes = 0;
    http.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshes++;
        return ok(config, pair("retry-new"));
      }
      calls++;
      unauthorized(config);
    };
    await assert.rejects(api.me());
    assert.equal(refreshes, 1);
    assert.equal(calls, 2);
    assert.equal(tokens.refresh(), null);
  },
);
await check(
  "logout during refresh cannot restore a cleared identity",
  async () => {
    tokens.set(pair("race"));
    let release;
    http.defaults.adapter = (config) =>
      new Promise((resolve) => {
        release = () => resolve(ok(config, pair("race-new")));
      });
    const pending = refreshIdentity();
    await new Promise((resolve) => setTimeout(resolve, 0));
    tokens.clear();
    release();
    await assert.rejects(pending, /账户状态已变更/);
    assert.equal(tokens.access(), null);
  },
);
await check(
  "non-auth failures do not refresh or retry batch creation",
  async () => {
    tokens.set(pair("failure"));
    let calls = 0;
    http.defaults.adapter = async () => {
      calls++;
      throw new AxiosError("Network Error", "ERR_NETWORK");
    };
    await assert.rejects(
      api.create({ bookId: 1, selectionType: "BOOK", count: 20 }),
      /无法连接/,
    );
    assert.equal(calls, 1);
  },
);
http.defaults.adapter = fixtureAdapter;
console.log(
  `\n${passed} contract/state checks passed. Browser visual checks are separate.`,
);
