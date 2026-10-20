import type { TokenPair } from "../types/api";
let access: string | null = null;
const key = "wordtrail.refresh";
export const tokens = {
  access: () => access,
  refresh: () => sessionStorage.getItem(key),
  set(pair: TokenPair) {
    access = pair.accessToken;
    sessionStorage.setItem(key, pair.refreshToken);
  },
  clear() {
    access = null;
    sessionStorage.removeItem(key);
  },
};
