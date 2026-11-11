// Exercises the unified settings UI with isolated synthetic API responses.
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { build } from 'vite';

const window = new Window({ url: 'http://127.0.0.1:5173/' });
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'sessionStorage', 'localStorage', 'Document', 'ShadowRoot', 'Element', 'HTMLElement', 'HTMLInputElement', 'SVGElement', 'Node', 'Text', 'Comment', 'Event', 'MouseEvent'])
  Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.document.body.innerHTML = '<div id="app"></div>';
const { default: vue } = await import('@vitejs/plugin-vue');
await build({ configFile: false, plugins: [vue()], mode: 'mock', logLevel: 'warn', build: { target: 'es2022', outDir: '.qa-unified-settings-dist', emptyOutDir: false, minify: false, lib: { entry: 'tests/sentences-entry.ts', formats: ['es'], fileName: 'ui' }, rolldownOptions: { external: ['vue', 'vue-router', 'pinia', 'axios', 'lucide-vue-next'] } } });
const { router, http, useAuthStore, tokens } = await import('../.qa-unified-settings-dist/ui.js');
const document = window.document;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, label) { const deadline = Date.now() + 8000; while (!test()) { if (Date.now() > deadline) throw new Error(`Timeout: ${label}`); await delay(10); } }
function input(selector, value) { const node = document.querySelector(selector); assert.ok(node, selector); node.value = value; node.dispatchEvent(new window.Event('input', { bubbles: true })); }
function button(text) { return [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text); }
async function click(text) { await until(() => button(text), text); button(text).click(); }

const user = { id: 42, username: 'synthetic', nickname: null, phone: '13800000001' };
const pair = { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh', tokenType: 'Bearer', expiresIn: 1800, user };
const settings = { dailyTarget: 50, newWordTarget: 20, reviewLimit: 30, pronunciation: { autoPlay: false, accent: 'US', playbackRate: 1, repeatCount: 1 } };
const sessions = [{ sessionId: '00000000000000000000000000000001', deviceName: '测试设备', current: false, createdAt: '2026-01-01T00:00:00', lastRefreshedAt: '2026-01-02T00:00:00', expiresAt: '2026-02-01T00:00:00' }];
const writes = [];
http.defaults.adapter = async config => {
  const ok = data => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data } });
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  if (config.url === '/auth/refresh') return ok(pair);
  if (config.url === '/auth/me') return ok(user);
  if (config.url === '/learning/settings') return ok(settings);
  if (config.url === '/learning/settings/allocation') { writes.push(body); Object.assign(settings, body, { dailyTarget: body.newWordTarget + body.reviewLimit }); return ok(settings); }
  if (config.url === '/auth/sessions') return ok({ page: 1, size: 10, total: sessions.length, records: sessions });
  if (config.url === '/auth/sessions/00000000000000000000000000000001/revoke') { sessions.length = 0; return ok(null); }
  if (config.url === '/auth/phone/send-auth') return ok(null);
  throw new Error(`Unexpected fixture request: ${config.url}`);
};
tokens.set(pair); useAuthStore().user = user;
await router.push('/settings');
await until(() => document.querySelector('#settings-panel-overview')?.textContent.includes('20 词'), 'overview data');
assert.match(document.querySelector('#settings-panel-overview').textContent, /138\*\*\*\*0001/);
await click('修改');
await until(() => router.currentRoute.value.query.editor === 'password' && document.querySelector('#password-editor').style.display !== 'none', 'overview opens password editor');
input('#new-password', 'synthetic-password'); input('#confirm-password', 'different-password');
document.querySelector('#confirm-password').dispatchEvent(new window.Event('blur'));
await until(() => document.querySelector('#password-mismatch'), 'password mismatch on blur');
assert.equal(document.querySelector('#confirm-password').getAttribute('aria-invalid'), 'true');
input('#confirm-password', 'synthetic-password');
await until(() => !document.querySelector('#password-mismatch'), 'matching passwords clear error');
await click('设置总览');
await click('每日配额');
await until(() => document.querySelector('#new-word-target'), 'allocation form');
input('#new-word-target', '12'); input('#review-limit', '18');
await click('保存每日配额');
await until(() => writes.length === 1, 'allocation saved');
assert.deepEqual(writes[0], { newWordTarget: 12, reviewLimit: 18 });
await click('设置总览');
await until(() => document.querySelector('#settings-panel-overview').textContent.includes('12 词'), 'saved values on overview');
await click('账户安全');
await until(() => document.querySelector('#password-code'), 'security form');
await click('更换手机号');
assert.notEqual(document.querySelector('#phone-editor').style.display, 'none');
input('#new-phone', '13900000000');
await click('登录设备');
await until(() => document.querySelector('.account-device-row')?.textContent.includes('测试设备'), 'device list');
await click('撤销会话');
await until(() => sessions.length === 0, 'device revoked');
await click('账户安全');
await until(() => document.querySelector('#new-phone')?.value === '13900000000', 'form state retained');
await router.push('/settings/security');
await until(() => router.currentRoute.value.query.section === 'security', 'legacy link redirects');
assert.equal(router.currentRoute.value.path, '/settings');
console.log('PASS unified settings overview, allocation, retained security form, device revocation and old security link');
window.happyDOM.abort();
