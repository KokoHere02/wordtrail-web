import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../api";
import { ApiError, refreshIdentity, withCredentialMutation } from "../api/http";
import { accountApi } from '../api/account';
import { tokens } from "../api/tokens";
import type { Credentials, User, TokenPair } from "../types/api";
import { useBooksStore } from "./books";
export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const accountBusy = ref(false);
  async function runAccount<T>(operation: () => Promise<T>) {
    if (accountBusy.value) throw new ApiError('账户操作正在进行，请稍候。', 'AUTH_OPERATION_BUSY');
    accountBusy.value = true;
    try { return await operation(); } finally { accountBusy.value = false; }
  }
  let restored: Promise<void> | null = null;
  function clear() {
    user.value = null;
    tokens.clear();
    useBooksStore().clear();
  }
  async function restore() {
    if (!restored)
      restored = (async () => {
        if (tokens.refresh()) {
          try {
            user.value = (await refreshIdentity()).user;
            user.value = await api.me();
          } catch {
            clear();
          }
        }
      })();
    await restored;
  }
  async function login(body: Credentials) {
    await runAccount(() => withCredentialMutation(async () => {
      const pair = await api.login(body);
      tokens.set(pair);
      user.value = pair.user;
    }));
  }
  async function logout() {
    await runAccount(() => withCredentialMutation(async () => {
      const token = tokens.refresh();
      clear();
      if (token) await api.logout(token);
    }));
  }
  async function secure(operation: (refresh: () => Promise<TokenPair>) => Promise<void>) {
    try { await runAccount(() => withCredentialMutation(operation)); }
    catch (value) {
      if (value instanceof ApiError && value.code === 'UNAUTHENTICATED' && value.status === 401) clear();
      const unknown = !(value instanceof ApiError) || value.code !== 'AUTH_OPERATION_BUSY' && (value.status === undefined || value.status >= 500);
      if (unknown) {
        clear();
        throw new ApiError('安全操作结果尚未确认，请重新登录后核对。', 'AUTH_OPERATION_UNCERTAIN');
      }
      throw value;
    }
  }
  async function changePassword(currentPassword: string, newPassword: string) {
    await secure(async () => { await accountApi.password(currentPassword, newPassword); clear(); });
  }
  async function logoutOthers(currentPassword: string) {
    await secure(async refresh => {
      let pair;
      try { pair = await accountApi.logoutOthers(currentPassword); }
      catch (value) {
        if (!(value instanceof ApiError) || value.code !== 'AUTH_SESSION_UPGRADE_REQUIRED') throw value;
        await refresh();
        pair = await accountApi.logoutOthers(currentPassword);
      }
      tokens.set(pair); user.value = pair.user;
    });
  }
  async function revokeSession(id: string, current: boolean) {
    await secure(async () => { await accountApi.revoke(id); if (current) clear(); });
  }
  async function upgradeSession() {
    await secure(async refresh => { user.value = (await refresh()).user; });
  }
  return { user, accountBusy, restore, login, logout, clear, changePassword, logoutOthers, revokeSession, upgradeSession };
});
