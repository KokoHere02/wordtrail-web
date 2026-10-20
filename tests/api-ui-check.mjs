// Simulated DOM integration test. This deliberately does not claim browser layout verification.
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { build } from "vite";
import { AxiosError } from "axios";
const window = new Window({ url: "http://127.0.0.1:5173/" });
for (const key of [
  "window",
  "document",
  "navigator",
  "history",
  "location",
  "sessionStorage",
  "localStorage",
  "Document",
  "ShadowRoot",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "SVGElement",
  "Node",
  "Text",
  "Comment",
  "Event",
  "MouseEvent",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}
window.document.body.innerHTML = '<div id="app"></div>';
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
const { default: vue } = await import("@vitejs/plugin-vue");
await build({
  configFile: false,
  plugins: [vue()],
  mode: "mock",
  define: { "import.meta.env.VITE_UI_PREVIEW": '"false"' },
  logLevel: "warn",
  build: {
    target: "es2022",
    outDir: ".qa-ui-dist",
    emptyOutDir: true,
    minify: false,
    lib: { entry: "tests/app-entry.ts", formats: ["es"], fileName: "ui" },
    rolldownOptions: {
      external: ["vue", "vue-router", "pinia", "axios", "lucide-vue-next"],
    },
  },
});
const { router, http } = await import("../.qa-ui-dist/ui.js");
const document = window.document;
async function until(predicate, label) {
  const deadline = Date.now() + 8000;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out: ${label}\n${document.body.textContent}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
function input(selector, value) {
  const element = document.querySelector(selector);
  assert.ok(element, selector);
  element.value = value;
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
}
function clickText(text) {
  const element = [...document.querySelectorAll("button")].find(
    (el) => el.textContent.trim() === text,
  );
  assert.ok(element, `Button: ${text}`);
  assert.equal(element.disabled, false, `Enabled: ${text}`);
  element.click();
}
function selectWord(word) {
  const element = document.querySelector(`input[aria-label="选择 ${word}"]`);
  assert.ok(element);
  element.checked = true;
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}
async function readyClick(text) {
  await until(() => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === text && !el.disabled), `ready ${text}`);
  clickText(text);
}
await until(() => document.querySelector("#username"), "login view");
assert.ok(document.querySelector(".mock-notice"));
// Field errors and focus are real Vue events, but browser focus styling remains unverified.
clickText("登录");
await until(
  () =>
    document.querySelector("#username")?.getAttribute("aria-invalid") ===
    "true",
  "field validation",
);
input("#username", "dom_reader");
input("#password", "example123");
clickText("登录");
await until(() => document.querySelector('.daily-equation'), 'live today after login');
assert.match(document.querySelector('.daily-equation').textContent, /0/);
await router.push('/learn');
await until(() => document.querySelector('.library-empty h1')?.textContent.includes('暂时没有待学'), 'empty daily plan does not generate sample words');
await router.push('/books');
await until(
  () => document.querySelectorAll(".library-card").length === 4,
  "catalog after login",
);
await router.push("/books/1");
await until(
  () => document.querySelectorAll(".preview-word-row").length === 10,
  "word detail list",
);
assert.match(document.querySelector("h1").textContent, /四级核心词汇/);
selectWord("abandon");
document.querySelector('button[aria-label="下一页"]').click();
await until(
  () => document.querySelector('input[aria-label="选择 accurate"]'),
  "second page",
);
selectWord("accurate");
await until(
  () => document.querySelector(".selected-count")?.textContent.includes("2"),
  "cross page count",
);
input("input[type=search]", "no_such_prefix");
document.querySelector('form[role="search"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await until(
  () =>
    document.querySelector(".state-panel")?.textContent.includes("没有找到"),
  "empty state",
);
assert.match(document.querySelector(".selected-count").textContent, /2/);
input("input[type=search]", "");
document.querySelector('form[role="search"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await until(
  () => document.querySelectorAll(".preview-word-row").length === 10,
  "clear search",
);
document.querySelector('details').open = true;
clickText("练习已选 2 词");
await until(
  () => document.querySelector(".study-word")?.textContent === "abandon",
  "study first word",
);
assert.equal(document.querySelector(".study-meaning"), null);
assert.equal(document.querySelector(".sidebar"), null);
const originalAdapter = http.defaults.adapter;
let failedPracticeBody;
http.defaults.adapter = async (config) => {
  if (config.url.endsWith("/answer")) {
    failedPracticeBody = config.data;
    throw new AxiosError("Network Error", "ERR_NETWORK");
  }
  return originalAdapter(config);
};
clickText("认识");
await until(
  () => document.querySelector(".form-error")?.textContent.includes("无法连接"),
  "save failure remains on word",
);
assert.equal(document.querySelector(".study-word").textContent, "abandon");
assert.equal(document.querySelector(".study-meaning"), null);
assert.equal(document.querySelector(".next-button").disabled, true);
let retriedPracticeBody;
http.defaults.adapter = async config => { if (config.url.endsWith('/answer')) retriedPracticeBody = config.data; return originalAdapter(config); };
clickText("认识");
await until(
  () => document.querySelector(".study-meaning")?.textContent.includes("放弃"),
  "saved reveal",
);
assert.equal(document.querySelector(".study-word").textContent, "abandon");
assert.equal(retriedPracticeBody, failedPracticeBody);
http.defaults.adapter = originalAdapter;
clickText("记错了");
await until(
  () =>
    [...document.querySelectorAll(".answer-button")]
      .find((el) => el.textContent.trim() === "不认识")
      ?.getAttribute("aria-pressed") === "true",
  "correction",
);
clickText("下一个");
await until(
  () => document.querySelector(".study-word")?.textContent === "accurate",
  "second word",
);
assert.match(
  document.querySelector(".study-progress").textContent,
  /1\s*\/\s*2/,
);
const studyPath = router.currentRoute.value.path;
await router.push("/learning");
await router.push(studyPath);
await until(
  () => document.querySelector(".study-word")?.textContent === "accurate",
  "resume first unanswered",
);
clickText("不确定");
await until(
  () => document.querySelector(".study-meaning")?.textContent.includes("准确"),
  "final reveal",
);
clickText("完成本轮");
await until(() => document.querySelector(".result-stats"), "result page");
assert.deepEqual(
  [...document.querySelectorAll(".result-stat strong")].map(
    (el) => el.textContent,
  ),
  ["2", "0", "1", "1"],
);
clickText("不认识");
await until(
  () => document.querySelectorAll(".result-row").length === 1,
  "filtered results",
);
assert.equal(
  document.querySelector(".result-row .word-name").textContent,
  "abandon",
);
const resultPath = router.currentRoute.value.path;
clickText("重学不确定／不认识的词");
await until(
  () => document.querySelector(".study-word")?.textContent === "abandon",
  "new relearn batch",
);
assert.notEqual(
  router.currentRoute.value.params.batchId,
  resultPath.split("/")[2],
);
await router.push(resultPath);
await until(
  () => document.querySelector(".result-stats"),
  "original results remain",
);
assert.equal(document.querySelector(".result-stat strong").textContent, "2");
await router.push("/books/2");
await until(
  () => document.querySelectorAll(".preview-word-row").length === 10,
  "different book",
);
assert.match(document.querySelector(".selected-count").textContent, /0/);
assert.equal(
  document.querySelector('#practice-count').value,
  "20",
);
input('#practice-count', "1");
document.querySelector('details').open = true;
clickText("按词书开始练习");
await until(
  () => document.querySelector(".study-word")?.textContent === "abandon",
  "BOOK start without manual selection",
);
assert.match(
  document.querySelector(".study-progress").textContent,
  /0\s*\/\s*1/,
);
clickText("认识");
await until(
  () => document.querySelector(".study-meaning"),
  "known single word",
);
clickText("完成本轮");
await until(() => document.querySelector(".result-stats"), "all known result");
assert.match(
  document.querySelector(".relearn-panel").textContent,
  /暂无需要重学/,
);
assert.equal(
  [...document.querySelectorAll("button")].some((el) =>
    el.textContent.includes("重学不确定"),
  ),
  false,
);
// Default learning uses the new plan/daily APIs, never the practice result endpoints.
await router.push('/books/1');
await until(() => document.querySelector('input[aria-label="选择 abandon"]'), 'joinable words');
selectWord('abandon');
selectWord('absorb');
await until(() => document.querySelector('.selected-count')?.textContent.includes('2'), 'two selected for plan');
clickText('加入学习计划');
await until(() => document.querySelector('.live-notice')?.textContent.includes('新增 2'), 'join plan receipt');
assert.match(document.querySelector('.selected-count').textContent, /0/);
await router.push('/plan');
await until(() => document.querySelectorAll('.live-plan-row').length === 2, 'plan from API');
const abandonPlanRow = [...document.querySelectorAll('.live-plan-row')].find(row => row.querySelector('strong')?.textContent === 'abandon');
[...abandonPlanRow.querySelectorAll('button')].find(button => button.textContent === '暂停').click();
await until(() => document.querySelectorAll('.live-plan-row').length === 1, 'pause removes from active list');
clickText('已暂停');
await until(() => document.querySelectorAll('.live-plan-row').length === 1 && document.querySelector('.live-plan-row').textContent.includes('abandon'), 'paused filter');
clickText('重新启用');
await until(() => document.querySelector('.state-panel')?.textContent.includes('没有符合'), 'reactivated leaves paused filter');
await router.push('/today');
await until(() => document.querySelector('.daily-equation'), 'real candidate pools');
assert.match(document.querySelector('.today-plan').textContent, /2 个启用/);
assert.equal(document.body.textContent.includes('连续学习 7 天'), false);
await router.push('/learn');
await until(() => document.querySelector('.memory-title h1')?.textContent.trim() === 'abandon', 'daily first word');
assert.equal(document.querySelector('.memory-meaning'), null);
const dailyAdapter = http.defaults.adapter;
let originalWrite;
http.defaults.adapter = async config => {
  if (config.url.endsWith('/answer')) { originalWrite = config.data; await dailyAdapter(config); throw new AxiosError('timeout', AxiosError.ECONNABORTED, config); }
  return dailyAdapter(config);
};
document.querySelector('.recall-known').click();
await until(() => document.querySelector('.live-error')?.textContent.includes('超时'), 'daily unknown write outcome');
assert.equal(document.querySelector('.memory-meaning'), null);
assert.ok(document.querySelector('.recall-known').disabled);
let retryWrite;
http.defaults.adapter = async config => { if (config.url.endsWith('/answer')) retryWrite = config.data; return dailyAdapter(config); };
clickText('重试原请求');
await until(() => document.querySelector('.memory-meaning')?.textContent.includes('放弃'), 'daily saved meaning');
assert.equal(retryWrite, originalWrite);
assert.equal(document.querySelector('.memory-title h1').textContent.trim(), 'abandon');
await until(() => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === '记错了'), 'correction eligibility');
clickText('记错了');
await until(() => document.querySelector('.recall-forgot').getAttribute('aria-pressed') === 'true', 'daily correction');
await readyClick('下一个单词');
await until(() => document.querySelector('.memory-title h1')?.textContent.trim() === 'absorb', 'next server queue word');
assert.equal(document.querySelector('.memory-meaning'), null);
document.querySelector('.recall-known').click();
await until(() => document.querySelector('.memory-meaning')?.textContent.includes('吸收'), 'daily second saved');
await readyClick('下一个单词');
await until(() => document.querySelector('.memory-title h1')?.textContent.trim() === 'abandon', 'reinforcement uses same word');
assert.equal(document.querySelector('.memory-meaning'), null);
document.querySelector('.recall-known').click();
await until(() => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === '完成本轮'), 'last answer still visible');
await readyClick('完成本轮');
await until(() => document.querySelector('.live-daily-result .session-stats'), 'daily result from API');
assert.match(document.querySelector('.session-stat-grid').textContent, /2 \/ 2/);
assert.match(document.querySelector('.session-stat-grid').textContent, /3作答次数/);
assert.equal(document.body.textContent.includes('正确率'), false);
await router.push('/records');
await readyClick('已完成');
await until(() => document.querySelectorAll('.record-card').length === 1, 'daily records from API');
http.defaults.adapter = dailyAdapter;

// New read-only statistics/calendar and settings flows must use their own endpoints.
const endpointCalls = [];
http.defaults.adapter = async config => { endpointCalls.push({ url: config.url, method: config.method, params: config.params, body: config.data }); return dailyAdapter(config); };
await router.push('/settings');
await until(() => document.querySelector('#daily-target'), 'persisted daily target settings');
input('#daily-target', '20.0');
clickText('保存每日目标');
await until(() => document.querySelector('#target-error').textContent.includes('整数'), 'reject decimal form');
assert.equal(endpointCalls.filter(call => call.url === '/learning/settings' && call.method === 'put').length, 0);
input('#daily-target', '200');
await readyClick('保存每日目标');
await until(() => document.querySelector('.live-notice')?.textContent.includes('200'), 'target save receipt');
assert.deepEqual(JSON.parse(endpointCalls.find(call => call.url === '/learning/settings' && call.method === 'put').body), { dailyTarget: 200 });
await router.push('/today');
await until(() => document.querySelector('.daily-equation') && document.querySelector('.today-statistics .statistics-grid'), 'homepage daily statistics');
assert.match(document.querySelector('.live-date').textContent, /20/); // Existing task keeps its target.
await router.push('/statistics');
await until(() => document.querySelectorAll('.calendar-day').length >= 28 && document.querySelectorAll('.statistics-word-row').length === 2, 'calendar and date word details');
assert.equal(endpointCalls.filter(call => call.url === '/learning/today/start').length, 0);
const calendarDate = document.querySelector('.calendar-day.selected').getAttribute('aria-label').slice(0, 10);
assert.ok(document.querySelector('.calendar-day.selected').classList.contains('has-activity'));
assert.match(document.querySelector('.statistics-summary').textContent, /不增加作答次数/);
clickText('学习历史');
await until(() => document.querySelector('.history-event'), 'word history from statistics');
assert.ok(document.querySelector('.history-event').textContent.includes('正常作答') || document.querySelector('.history-event').textContent.includes('更正事件'));
assert.ok(document.querySelector('.history-event').textContent.includes('快照不可用'));
document.querySelector('button[aria-label="关闭弹窗"]').click();
await until(() => !document.querySelector('[role="dialog"]'), 'history closes');
http.defaults.adapter = async config => {
  const response = await dailyAdapter(config);
  if (config.url.endsWith('/history') && response.data.data.records.length) {
    const base = response.data.data.records[0];
    response.data.data.records.unshift({ ...base, logId: 999000, taskType: 'PRACTICE', eventType: 'ANSWER', correctsLogId: null, affectsSchedule: false, scheduleBefore: null, scheduleAfter: null, scheduleAvailable: false });
    response.data.data.total++;
  }
  return response;
};
clickText('学习历史');
await until(() => document.querySelectorAll('.history-group').length === 2, 'DAILY and PRACTICE history groups remain separate');
assert.match(document.querySelectorAll('.history-group')[0].textContent, /本页每日学习事件/);
assert.match(document.querySelectorAll('.history-group')[1].textContent, /本页专项练习事件/);
document.querySelector('button[aria-label="关闭弹窗"]').click();
await until(() => !document.querySelector('[role="dialog"]'), 'mixed history closes');

// Incomplete aggregates, including zero known events, must never look like an empty learning day.
http.defaults.adapter = async config => {
  const response = await dailyAdapter(config);
  if (config.url === '/learning/statistics/daily') response.data.data = { ...response.data.data, hasLearningActivity: true, answerCount: 0, statisticsComplete: false, incompleteWordCount: 1 };
  if (config.url === '/learning/statistics/calendar') response.data.data = { ...response.data.data, statisticsComplete: false, days: response.data.data.days.map(day => day.learningDate === calendarDate ? { ...day, answerCount: 0, hasLearningActivity: true, statisticsComplete: false, incompleteWordCount: 1 } : day) };
  return response;
};
await router.push('/records');
await router.push('/statistics');
await until(() => document.querySelectorAll('.statistics-warning').length === 2, 'incomplete day and month warnings');
assert.ok(document.querySelector('.calendar-day.has-activity.incomplete'));
assert.equal(document.querySelector('.statistics-summary').textContent.includes('该日没有记录到'), false);
assert.match(document.querySelector('.statistics-summary').textContent, /仅包含已记录的正常作答/);
http.defaults.adapter = dailyAdapter;

// Bulk plan operations use server results and retain selection on an atomic failure.
await router.push('/plan');
await until(() => document.querySelectorAll('.live-plan-row').length === 2, 'plan enhanced controls');
input('input[aria-label="搜索计划单词"]', 'abs');
document.querySelector('form[role="search"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await until(() => document.querySelectorAll('.live-plan-row').length === 1, 'server prefix search');
assert.equal(document.querySelector('.live-plan-row strong').textContent, 'absorb');
const checkbox = document.querySelector('input[aria-label="选择计划单词 absorb"]');
checkbox.checked = true; checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
await until(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === '批量暂停' && !button.disabled), 'bulk selection');
http.defaults.adapter = async config => {
  if (config.url === '/learning-plan/words/status') throw new AxiosError('conflict', 'ERR_BAD_RESPONSE', config, undefined, { config, status: 409, statusText: 'Conflict', headers: {}, data: { code: 'INVALID_PLAN_TRANSITION', message: '整批未修改', data: null } });
  return dailyAdapter(config);
};
clickText('批量暂停');
await until(() => document.querySelector('.inline-error')?.textContent.includes('选择已保留'), 'bulk atomic failure');
assert.equal(document.querySelector('input[aria-label="选择计划单词 absorb"]').checked, true);
http.defaults.adapter = dailyAdapter;
await readyClick('批量暂停');
await until(() => document.querySelector('.live-notice')?.textContent.includes('变更 1 词'), 'bulk server counts');
await readyClick('已暂停');
await until(() => document.querySelectorAll('.live-plan-row').length === 1, 'paused searched plan');
const resumeBox = document.querySelector('input[aria-label="选择计划单词 absorb"]');
resumeBox.checked = true; resumeBox.dispatchEvent(new window.Event('change', { bubbles: true }));
await readyClick('批量恢复');
await until(() => document.querySelector('.live-notice')?.textContent.includes('变更 1 词'), 'bulk resume');
await readyClick('启用中');
await until(() => document.querySelectorAll('.live-plan-row').length === 1, 'active prefix result');
clickText('移出');
await readyClick('确认移出');
await until(() => !document.querySelector('[role="dialog"]'), 'remove confirmation');
await readyClick('已移出');
await until(() => document.querySelectorAll('.live-plan-row').length === 1, 'removed plan');
assert.equal([...document.querySelectorAll('.live-plan-row button')].some(button => button.textContent.includes('重新启用')), false);
assert.match(document.querySelector('.plan-selection-help').textContent, /不能在这里直接恢复/);
clickText('学习历史');
await until(() => document.querySelector('.history-event'), 'removed word still has history');
document.querySelector('button[aria-label="关闭弹窗"]').click();
await until(() => !document.querySelector('[role="dialog"]'), 'removed history closes');
await router.push('/books/2');
await until(() => document.querySelectorAll('.preview-word-row').length === 10, 'book history entry');
clickText('学习历史');
await until(() => document.querySelector('[role="dialog"] .state-panel')?.textContent.includes('不能解释为从未学习'), 'empty history preserves legacy-data uncertainty');
document.querySelector('button[aria-label="关闭弹窗"]').click();
await until(() => !document.querySelector('[role="dialog"]'), 'empty history closes');

document.querySelector('button[aria-label="打开账户菜单"]').click();
await until(() => document.querySelector('[role="dialog"]'), 'profile dialog');
clickText('退出登录');
await until(() => document.querySelector("#username"), "logout");
await router.push("/register?redirect=/books/3");
input("#username", "dom_registered");
input("#nickname", "词序读者");
input("#password", "example123");
clickText("创建账户");
await until(
  () =>
    router.currentRoute.value.path === "/login" &&
    document.querySelector(".notice")?.textContent.includes("注册成功"),
  "registration requires login",
);
input("#password", "example123");
clickText("登录");
await until(
  () =>
    router.currentRoute.value.path === "/books/3" &&
    document.querySelectorAll(".preview-word-row").length === 10,
  "login restores target",
);
console.log(
  "PASS Vue DOM integration: auth/redirect, books/practice, plan search and bulk status with atomic failure, removed-word rules, server daily queue/retry/correction/reinforcement, settings validation and task snapshot, statistics/calendar/incomplete notices, daily/practice history separation and empty-history uncertainty.",
);
console.log(
  "This does not verify pixels, responsive geometry, mobile keyboard or screenshots.",
);
await window.happyDOM.close();
