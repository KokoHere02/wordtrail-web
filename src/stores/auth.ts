import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../api";
import { refreshIdentity } from "../api/http";
import { tokens } from "../api/tokens";
import type { Credentials, User } from "../types/api";
import { useBooksStore } from "./books";
export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
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
    const pair = await api.login(body);
    tokens.set(pair);
    user.value = pair.user;
  }
  async function logout() {
    const token = tokens.refresh();
    clear();
    if (token) await api.logout(token);
  }
  return { user, restore, login, logout, clear };
});
