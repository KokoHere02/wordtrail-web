// Test real Vue components in a simulated DOM. This is not a pixel/layout test.
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
  "KeyboardEvent",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import("@vitejs/plugin-vue");
await build({
  configFile: false,
  plugins: [vue()],
  mode: "development",
  logLevel: "warn",
  define: { "import.meta.env.VITE_UI_PREVIEW": '"true"' },
  build: {
    target: "es2022",
    outDir: ".qa-visual-dist",
    emptyOutDir: true,
    minify: false,
    lib: { entry: "tests/app-entry.ts", formats: ["es"], fileName: "visual" },
    rolldownOptions: {
      external: ["vue", "vue-router", "pinia", "axios", "lucide-vue-next"],
    },
  },
});
const { router, http, app, usePreviewStore } =
  await import("../.qa-visual-dist/visual.js");
let networkCalls = 0;
http.defaults.adapter = async () => {
  networkCalls++;
  throw new Error("The UI preview must not make API calls");
};
const document = window.document;
async function until(predicate, label) {
  const deadline = Date.now() + 7000;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out: ${label}\n${document.body.textContent}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
function click(text) {
  const button = [...document.querySelectorAll("button")].find(
    (element) =>
      element.textContent.trim() === text ||
      element.querySelector("strong,h2")?.textContent.trim() === text,
  );
  assert.ok(button, `button: ${text}`);
  assert.equal(button.disabled, false);
  button.click();
}
function fill(selector, value) {
  const element = document.querySelector(selector);
  assert.ok(element, selector);
  element.value = value;
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
}
function change(selector, value) {
  const element = document.querySelector(selector);
  assert.ok(element, selector);
  element.value = value;
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}
function word(word) {
  const input = document.querySelector(`input[aria-label="选择 ${word}"]`);
  assert.ok(input);
  input.checked = true;
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
}
await until(() => document.querySelector(".today-hero"), "today without login");
assert.equal(router.currentRoute.value.path, "/today");
assert.match(document.querySelector("h1").textContent, /一点点，记得更久/);
assert.deepEqual(
  [...document.querySelectorAll(".daily-equation strong")].map(
    (element) => element.textContent,
  ),
  ["32", "12", "44"],
);
assert.equal(document.querySelector(".sidebar"), null);
const store = usePreviewStore();
document.querySelector('button[aria-label="打开偏好设置"]').click();
await until(() => document.querySelector("[role=dialog]"), "settings dialog");
document.querySelector('button[aria-label="增加每日新词"]').click();
await until(
  () =>
    document.querySelectorAll(".daily-equation strong")[1].textContent === "13",
  "reactive daily plan",
);
document.querySelector('button[aria-label="减少每日新词"]').click();
click("就按这个节奏");
await until(() => !document.querySelector("[role=dialog]"), "close settings");
await router.push("/learn");
await until(
  () => document.querySelector(".memory-title h1")?.textContent === "abandon",
  "memory reference state",
);
assert.match(
  document.querySelector(".practice-counter").textContent,
  /9\s*\/\s*44/,
);
assert.match(
  document.querySelector(".memory-example").textContent,
  /Never abandon your dreams/,
);
document.dispatchEvent(
  new window.KeyboardEvent("keydown", { key: "3", bubbles: true }),
);
await until(
  () =>
    document.querySelector(".recall-known").getAttribute("aria-pressed") ===
    "true",
  "shortcut answer feedback",
);
await until(
  () => document.querySelector(".memory-title h1")?.textContent === "absorb",
  "animated auto advance",
);
assert.equal(store.memoryDone, 9);
await until(
  () => !document.querySelector(".recall-uncertain").disabled,
  "ready for next memory answer",
);
store.autoNext = false;
click("模糊");
await until(
  () => document.querySelector(".recall-caption button"),
  "manual next mode",
);
assert.equal(document.querySelector(".memory-title h1").textContent, "absorb");
click("下一个单词");
await until(
  () => document.querySelector(".memory-title h1")?.textContent === "abstract",
  "manual next word",
);
await router.push("/dictation");
await until(() => document.querySelector("#spelling-input"), "dictation input");
assert.equal(document.querySelector("#spelling-input").value, "aban");
assert.equal(document.querySelectorAll(".letter-cell.filled").length, 4);
fill("#spelling-input", "abandon");
await until(
  () => document.querySelector(".spelling-correct"),
  "correct spelling feedback",
);
assert.equal(
  document.querySelectorAll(".session-stat-grid strong")[2].textContent,
  "7",
);
click("下一个词");
await until(
  () =>
    document.querySelector(".dictation-meaning").textContent.includes("吸收"),
  "next spelling word",
);
click("查看答案");
await until(
  () => document.querySelector("#spelling-input").value === "absorb",
  "reveal spelling",
);
assert.equal(
  document.querySelectorAll(".session-stat-grid strong")[2].textContent,
  "7",
);
click("下一个词");
await until(
  () =>
    document.querySelector(".dictation-meaning").textContent.includes("抽象"),
  "third spelling word",
);
fill("#spelling-input", "abstracx");
await until(
  () => document.querySelector(".spelling-error"),
  "spelling mistake feedback",
);
fill("#spelling-input", "abstract");
await until(
  () => document.querySelector(".spelling-correct"),
  "edit spelling mistake",
);
await router.push("/books");
await until(
  () => document.querySelectorAll(".library-card").length === 6,
  "five books and create card",
);
click("程序员");
await until(
  () => document.querySelectorAll(".library-card").length === 1,
  "category filter",
);
assert.match(document.querySelector(".library-card h2").textContent, /程序员/);
fill(".library-search input", "not-a-book");
await until(() => document.querySelector(".library-empty"), "empty search");
fill(".library-search input", "");
click("全部");
await until(
  () => document.querySelectorAll(".library-card").length === 6,
  "restore catalog",
);
click("创建我的词单");
await until(
  () => document.querySelector("#new-list-name"),
  "create list dialog",
);
fill("#new-list-name", "给未来的自己");
fill("#new-list-words", "abandon absorb");
click("创建词单");
await until(
  () =>
    document.querySelector(".library-card h2")?.textContent === "给未来的自己",
  "new list persisted",
);
await router.push("/books/1");
await until(
  () => document.querySelectorAll(".preview-word-row").length === 10,
  "word list",
);
word("abandon");
document.querySelector('button[aria-label="下一页"]').click();
await until(
  () => document.querySelector('input[aria-label="选择 achieve"]'),
  "second word page",
);
word("achieve");
assert.equal(store.selected.length, 2);
click("开始学习");
await until(
  () => document.querySelector(".memory-title h1")?.textContent === "abandon",
  "selected word session",
);
assert.match(
  document.querySelector(".practice-counter").textContent,
  /1\s*\/\s*2/,
);
click("认识");
await until(
  () => document.querySelector(".recall-caption button"),
  "first selected answer",
);
click("下一个单词");
await until(
  () => document.querySelector(".memory-title h1")?.textContent === "achieve",
  "selected second word",
);
await until(
  () => !document.querySelector(".recall-uncertain").disabled,
  "second word ready",
);
click("模糊");
await until(
  () => document.querySelector(".recall-caption button"),
  "second selected answer",
);
click("下一个单词");
await until(
  () => document.querySelector(".result-celebration"),
  "round completion",
);
assert.deepEqual(
  [...document.querySelectorAll(".preview-result-stats strong")].map(
    (element) => element.textContent,
  ),
  ["2", "1", "1", "0"],
);
await router.push("/records");
await until(
  () => document.querySelector(".record-card"),
  "saved learning record",
);
assert.equal(store.records.length, 1);
assert.equal(networkCalls, 0);
console.log(
  "PASS new UI: no API calls; today/settings; memory keyboard, feedback and auto/manual transitions; dictation edit/reveal; book search/category/create; cross-page choice; result and records.",
);
console.log(
  "Simulated DOM only. Real responsive geometry, fonts, screenshots and animation smoothness remain browser checks.",
);
app.unmount();
await window.happyDOM.close();
