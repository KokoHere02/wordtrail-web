import type { TokenPair } from "../types/api";
let access: string | null = null;
let revision = 0;
let owner: number | null = null;
const key = "wordtrail.refresh";
export const tokens = {
  access: () => access,
  refresh: () => sessionStorage.getItem(key),
  revision: () => revision,
  owner: () => owner,
  set(pair: TokenPair) {
    sessionStorage.setItem(key, pair.refreshToken);
    access = pair.accessToken;
    owner = pair.user.id;
    revision++;
  },
  clear() {
    access = null;
    owner = null;
    revision++;
    sessionStorage.removeItem(key);
  },
};
