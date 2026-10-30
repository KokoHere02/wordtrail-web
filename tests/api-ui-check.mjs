import { seedHistoricalPractice } from './helpers/legacy-practice.mjs';
// Simulated DOM integration test. This deliberately does not claim browser layout verification.
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { build } from "vite";
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
const { router, http, dailyApi, api, app } = await import("../.qa-ui-dist/ui.js");
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
assert.equal(document.querySelector('.live-practice-options'), null);
const dictionary = (await api.words(1, { page: 1, size: 3, learningStatus: 'ALL' })).records;
seedHistoricalPractice(localStorage, 'dom_reader', dictionary);
const historyBefore = localStorage.getItem('wordtrail.mock.dom_reader');
const originalAdapter = http.defaults.adapter, calls = [];
http.defaults.adapter = async config => { calls.push({ method: config.method, url: config.url }); return originalAdapter(config); };
const dailyBefore = await dailyApi.today();
for (const path of ['/learning', '/study/900', '/learning/900/result', '/study', '/learning/900']) {
  await router.push(path);
  await until(() => document.querySelector('.retired-practice h1'), 'retired notice');
  assert.match(document.querySelector('.retired-practice h1').textContent, /已下线/);
  assert.equal(document.querySelector('.learning-card'), null);
  assert.equal(document.querySelector('[href="/learn"]').textContent.includes('学习'), true);
}
assert.equal(calls.some(call => call.url === '/learning-batches' || /^\/learning-batches\/\d+(?!\/daily)(?:$|\/)/.test(call.url) || call.url.endsWith('/start')), false);
assert.deepEqual(await dailyApi.today(), dailyBefore);
assert.equal(localStorage.getItem('wordtrail.mock.dom_reader'), historyBefore);
await router.push('/statistics?source=PRACTICE');
await until(() => document.querySelector('.overview-streaks strong'), 'old historical statistics link falls back to daily statistics');
assert.equal(document.querySelector('.statistics-overview').textContent.includes('历史认读专项'), false);
await router.push('/records'); await until(() => document.querySelector('.records-page'), 'records');
assert.equal(document.querySelector('a[href="/learning"]'), null);
await router.push('/words/1001'); await until(() => document.querySelector('.word-detail-heading'), 'word detail');
clickText('学习历史'); await until(() => document.querySelector('.history-event'), 'historical events');
assert.match(document.querySelector('[role="dialog"]').textContent, /历史认读专项/);
assert.equal(calls.some(call => call.method !== 'get' && !call.url.startsWith('/auth/')), false);
console.log('PASS old links display retirement without requests or conversion; menus/book entries removed; PRACTICE statistics and word history remain read-only');
app.unmount(); await window.happyDOM.close();
