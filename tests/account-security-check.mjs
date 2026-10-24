// Synthetic credentials only. Never print request bodies or token values.
import assert from 'node:assert/strict';
import { build } from 'vite';
import { AxiosError } from 'axios';
import { createPinia, setActivePinia } from 'pinia';
class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
globalThis.sessionStorage = new MemoryStorage(); globalThis.localStorage = new MemoryStorage();
await build({ configFile: false, mode: 'mock', logLevel: 'warn', build: { ssr: 'tests/test-entry.ts', target: 'es2022', outDir: '.qa-dist', emptyOutDir: true } });
const { api, http, tokens, refreshIdentity, setExpiredHandler, accountApi, useAuthStore } = await import('../.qa-dist/test-entry.js');
setActivePinia(createPinia());
const auth = useAuthStore();
let expired = 0, serial = 0, refreshes = 0, actionCalls = 0;
setExpiredHandler(() => { expired++; auth.clear(); });
const user = { id: 10, username: 'synthetic_only', nickname: null };
const pair = () => ({ accessToken: `synthetic-access-${++serial}`, refreshToken: `synthetic-refresh-${serial}`, tokenType: 'Bearer', expiresIn: 1800, user });
const ok = (config, data) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data } });
function reject(config, code, status = 401) { throw new AxiosError('synthetic failure', 'ERR_BAD_RESPONSE', config, undefined, { config, status, headers: {}, data: { code, message: code, data: null } }); }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test) { const end = Date.now() + 3000; while (!test()) { if (Date.now() > end) throw new Error('Operation did not settle'); await delay(5); } }
function signedIn() { tokens.set(pair()); auth.user = user; }
signedIn();
let bad = true;
http.defaults.adapter = async config => {
  if (config.url === '/auth/refresh') { refreshes++; return ok(config, pair()); }
  assert.equal(config.headers.has('Authorization'), true, 'protected auth routes carry Bearer');
  if (bad) reject(config, 'BAD_CREDENTIALS');
  return ok(config, null);
};
const initialRevision = tokens.revision();
await assert.rejects(auth.changePassword(' synthetic old ', ' synthetic new '), error => error.code === 'BAD_CREDENTIALS');
assert.equal(refreshes, 0); assert.equal(expired, 0); assert.equal(tokens.revision(), initialRevision); assert.ok(auth.user);
console.log('PASS BAD_CREDENTIALS is a password error with no refresh, retry or credential removal');

signedIn(); const previous = tokens.access(); let calls = 0;
http.defaults.adapter = async config => {
  if (config.url === '/auth/refresh') { refreshes++; await delay(25); return ok(config, pair()); }
  calls++; if (config.headers.get('Authorization') === `Bearer ${previous}`) reject(config, 'UNAUTHENTICATED');
  return ok(config, config.url === '/auth/sessions' ? { page: 1, size: 10, total: 0, records: [] } : user);
};
const beforeRefresh = refreshes;
await Promise.all([api.me(), accountApi.sessions(1, 10), api.me()]);
assert.equal(refreshes, beforeRefresh + 1); assert.equal(calls, 6);
http.defaults.adapter = async config => { if (config.url === '/auth/refresh') refreshes++; reject(config, 'OTHER_AUTH_ERROR'); };
await assert.rejects(accountApi.sessions(1, 10), error => error.code === 'OTHER_AUTH_ERROR'); assert.equal(refreshes, beforeRefresh + 1); assert.ok(tokens.access());
console.log('PASS concurrent protected auth/business calls share one refresh; only UNAUTHENTICATED may refresh');

signedIn(); let releaseRefresh, releaseMutation, readCalls = 0;
http.defaults.adapter = async config => {
  if (config.url === '/auth/refresh') { refreshes++; return new Promise(resolve => { releaseRefresh = () => resolve(ok(config, pair())); }); }
  if (config.url === '/auth/logout-others') { actionCalls++; return new Promise(resolve => { releaseMutation = () => resolve(ok(config, pair())); }); }
  readCalls++; return ok(config, { page: 1, size: 10, total: 0, records: [] });
};
const pendingRefresh = refreshIdentity(); await until(() => releaseRefresh);
const mutation = auth.logoutOthers(' synthetic old '); const blockedRead = accountApi.sessions(1, 10);
await assert.rejects(auth.changePassword(' synthetic old ', ' synthetic new '), error => error.code === 'AUTH_OPERATION_BUSY');
await delay(20); assert.equal(actionCalls, 0); assert.equal(readCalls, 0);
releaseRefresh(); await pendingRefresh; await until(() => releaseMutation);
const rotatedRevision = tokens.revision(); assert.equal(readCalls, 0);
releaseMutation(); await mutation; await blockedRead;
assert.equal(tokens.revision(), rotatedRevision + 1); assert.equal(readCalls, 1);
assert.equal(auth.accountBusy, false);
console.log('PASS credential mutations wait for refresh, block parallel mutations and release reads only after both new credentials are stored');

signedIn(); let upgrade = true, upgrades = 0;
http.defaults.adapter = async config => {
  if (config.url === '/auth/refresh') { upgrades++; return ok(config, pair()); }
  if (upgrade) { upgrade = false; reject(config, 'AUTH_SESSION_UPGRADE_REQUIRED', 409); }
  return ok(config, pair());
};
await auth.logoutOthers(' synthetic old '); assert.equal(upgrades, 1); assert.ok(tokens.access()); assert.ok(tokens.refresh());
signedIn(); let releaseLate, first = true;
http.defaults.adapter = async config => {
  if (config.url === '/auth/sessions' && first) { first = false; return new Promise((_, rejectPromise) => { releaseLate = () => { try { reject(config, 'UNAUTHENTICATED'); } catch (error) { rejectPromise(error); } }; }); }
  if (config.url === '/auth/logout-others') return ok(config, pair());
  assert.notEqual(config.url, '/auth/refresh', 'late old 401 uses current pair without an extra refresh');
  return ok(config, { page: 1, size: 10, total: 0, records: [] });
};
const lateRead = accountApi.sessions(1, 10); await until(() => releaseLate); await auth.logoutOthers(' synthetic old '); releaseLate(); await lateRead;
console.log('PASS legacy-session upgrade is bounded and delayed old 401 cannot invalidate the replacement pair');

signedIn(); let releaseRetried, releaseRotation;
http.defaults.adapter = async config => {
  if (config.url === '/auth/refresh') return ok(config, pair());
  if (config.url === '/auth/logout-others') return new Promise(resolve => { releaseRotation = () => resolve(ok(config, pair())); });
  if (!config._retried) reject(config, 'UNAUTHENTICATED');
  return new Promise((_, rejectPromise) => { releaseRetried = () => { try { reject(config, 'UNAUTHENTICATED'); } catch (error) { rejectPromise(error); } }; });
};
const exhausted = api.me().then(() => null, error => error);
await until(() => releaseRetried);
const rotation = auth.logoutOthers(' synthetic old '); await until(() => releaseRotation);
const expiredBefore = expired; releaseRetried(); await delay(10); assert.equal(expired, expiredBefore);
releaseRotation(); await rotation; assert.equal((await exhausted).code, 'UNAUTHENTICATED'); assert.equal(expired, expiredBefore); assert.ok(auth.user); assert.ok(tokens.access());
let releasePassword, queuedReads = 0;
http.defaults.adapter = async config => {
  if (config.url === '/auth/password') return new Promise(resolve => { releasePassword = () => resolve(ok(config, null)); });
  queuedReads++; return ok(config, user);
};
const changing = auth.changePassword(' synthetic old ', ' synthetic new '); await until(() => releasePassword);
const queued = api.me().then(() => null, error => error); await delay(10); releasePassword(); await changing;
assert.equal((await queued).code, 'IDENTITY_CHANGED'); assert.equal(queuedReads, 0);
console.log('PASS exhausted late 401 waits for credential rotation and queued requests cannot cross an identity change');

signedIn(); let releaseOld;
http.defaults.adapter = config => new Promise(resolve => { releaseOld = () => resolve(ok(config, pair())); });
const oldRefresh = refreshIdentity(); await until(() => releaseOld); auth.clear(); signedIn(); const newRevision = tokens.revision(); releaseOld();
await assert.rejects(oldRefresh, error => error.code === 'IDENTITY_CHANGED'); assert.equal(tokens.revision(), newRevision);
const sid = '000000000000000000000000000000ab';
http.defaults.adapter = async config => {
  assert.equal(config.url, `/auth/sessions/${sid}/revoke`); assert.equal(config.data, undefined); return ok(config, null);
};
await auth.revokeSession(sid, false); assert.ok(auth.user); await auth.revokeSession(sid, true); assert.equal(auth.user, null); assert.equal(tokens.access(), null); assert.equal(tokens.refresh(), null);
signedIn();
http.defaults.adapter = async config => { assert.equal(config.url, '/auth/password'); assert.deepEqual(JSON.parse(config.data), { currentPassword: ' synthetic old ', newPassword: ' synthetic new ' }); return ok(config, null); };
await auth.changePassword(' synthetic old ', ' synthetic new '); assert.equal(auth.user, null); assert.equal(tokens.access(), null); assert.equal(tokens.refresh(), null);
console.log('PASS stale refresh cannot overwrite a new identity, opaque session IDs stay strings, current revoke/password success clear both tokens and passwords retain spaces');

signedIn(); let unknownCalls = 0;
http.defaults.adapter = async config => { unknownCalls++; throw new AxiosError('unknown synthetic outcome', 'ECONNABORTED', config); };
await assert.rejects(auth.logoutOthers(' synthetic old '), error => error.code === 'AUTH_OPERATION_UNCERTAIN');
assert.equal(unknownCalls, 1); assert.equal(auth.user, null); assert.equal(tokens.access(), null); assert.equal(tokens.refresh(), null);
console.log('PASS unknown security outcome never blindly repeats and requires fresh login');
console.log('Account credential checks passed with synthetic fixtures; no live password or device operation was performed.');
