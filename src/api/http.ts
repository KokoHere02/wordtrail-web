import axios, { AxiosError, type InternalAxiosRequestConfig, type AxiosRequestConfig } from "axios";
import { tokens } from "./tokens";
import type { Envelope, TokenPair } from "../types/api";

export const mockEnabled = import.meta.env.VITE_ENABLE_MOCK === "true";
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15000,
});
if (mockEnabled) http.defaults.adapter = (await import("./mock")).mockAdapter;

export class ApiError extends Error {
  code: string;
  status?: number;
  constructor(message: string, code = "NETWORK_ERROR", status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
}
// File requests can return a JSON error as a Blob. Decode it before normal error handling.
export async function responseError(data: unknown, fallback: string, status?: number): Promise<ApiError> {
  let value = data;
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    try { value = JSON.parse(await value.text()) as unknown; }
    catch { value = undefined; }
  }
  const fields = value && typeof value === 'object' ? value : {};
  const message = 'message' in fields && typeof fields.message === 'string' ? fields.message : fallback;
  const code = 'code' in fields && typeof fields.code === 'string' ? fields.code : undefined;
  return new ApiError(message || fallback, code, status);
}
let onExpired: () => void = () => {};
export function setExpiredHandler(handler: () => void) {
  onExpired = handler;
}
let refreshing: Promise<TokenPair> | null = null;
let credentialChange: Promise<void> | null = null;
const publicAuth = new Set(['/auth/phone/recover', '/auth/email/recover', '/auth/refresh', '/auth/logout', '/auth/phone/send', '/auth/phone/register', '/auth/phone/password-login', '/auth/phone/code-login', '/auth/email/send', '/auth/email/register', '/auth/email/password-login', '/auth/email/code-login']);
const protectedRequest = (url?: string) => !publicAuth.has(url || '');
// Credential mutations wait for an existing refresh, then block unrelated protected requests.
export async function withCredentialMutation<T>(operation: (refresh: () => Promise<TokenPair>) => Promise<T>): Promise<T> {
  if (credentialChange) throw new ApiError('账户操作正在进行，请稍候。', 'AUTH_OPERATION_BUSY');
  let release!: () => void;
  credentialChange = new Promise<void>(resolve => { release = resolve; });
  try { if (refreshing) await refreshing; return await operation(performRefresh); }
  finally { credentialChange = null; release(); }
}
export async function refreshIdentity(): Promise<TokenPair> {
  if (credentialChange) await credentialChange;
  return performRefresh();
}
function performRefresh(): Promise<TokenPair> {
  if (!refreshing) {
    const refreshToken = tokens.refresh();
    const revision = tokens.revision();
    if (!refreshToken)
      return Promise.reject(new ApiError("请先登录", "UNAUTHENTICATED", 401));
    refreshing = request<TokenPair>("POST", "/auth/refresh", { refreshToken })
      .then((pair) => {
        if (tokens.refresh() !== refreshToken || tokens.revision() !== revision)
          throw new ApiError("账户状态已变更，请重试", "IDENTITY_CHANGED");
        tokens.set(pair);
        return pair;
      })
      .catch((error: unknown) => {
        if (tokens.refresh() === refreshToken && tokens.revision() === revision) {
          tokens.clear();
          onExpired();
        }
        throw error;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}
interface RetryConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
  _security?: boolean;
  _authRevision?: number;
  _authOwner?: number | null;
}
http.interceptors.request.use(async (original) => {
  const config = original as RetryConfig;
  if (protectedRequest(config.url)) {
    if (credentialChange && !config._security) {
      const owner = tokens.owner();
      await credentialChange;
      if (owner !== tokens.owner()) throw new ApiError('账户状态已变更，请重新登录。', 'IDENTITY_CHANGED');
    }
    if (tokens.access())
      config.headers.set("Authorization", `Bearer ${tokens.access()}`);
    else config.headers.delete('Authorization');
    config._authRevision = tokens.revision();
    config._authOwner = tokens.owner();
  }
  return config;
});
http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError<Envelope<null>>(error)) throw error;
    const config = error.config as RetryConfig | undefined;
    const isProtected = config && protectedRequest(config.url);
    const failure = await responseError(error.response?.data, error.code === AxiosError.ECONNABORTED ? '请求超时，请重试' : '暂时无法连接服务，请检查网络后重试', error.response?.status);
    if (failure.code === 'UNAUTHENTICATED' && error.response?.status === 401 && isProtected) {
      if (credentialChange && !config._security) await credentialChange;
      if (tokens.owner() !== config._authOwner || !tokens.access() && tokens.revision() !== config._authRevision) throw new ApiError('账户状态已变更，请重新登录。', 'IDENTITY_CHANGED');
    }
    if (failure.code === 'UNAUTHENTICATED' && error.response?.status === 401 && isProtected && !config._retried) {
      config._retried = true;
      if (!tokens.refresh()) {
        tokens.clear();
        onExpired();
        throw new ApiError("登录已失效，请重新登录", "UNAUTHENTICATED", 401);
      }
      // A delayed 401 may arrive after another request has already refreshed the token.
      if (config.headers.get("Authorization") === `Bearer ${tokens.access()}`)
        await (config._security ? performRefresh() : refreshIdentity());
      config.headers.set("Authorization", `Bearer ${tokens.access()}`);
      return http(config);
    }
    if (failure.code === 'UNAUTHENTICATED' && error.response?.status === 401 && isProtected && config._authRevision === tokens.revision()) {
      tokens.clear();
      onExpired();
    }
    throw failure;
  },
);
export async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  data?: unknown,
  params?: object,
  options?: { security?: boolean },
): Promise<T> {
  const config: AxiosRequestConfig & { _security?: boolean } = {
    method,
    url,
    data,
    params,
    _security: options?.security,
  };
  const response = await http.request<Envelope<T>>(config);
  if (response.data.code !== "OK")
    throw new ApiError(response.data.message, response.data.code);
  return response.data.data;
}
