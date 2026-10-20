import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
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
let onExpired: () => void = () => {};
export function setExpiredHandler(handler: () => void) {
  onExpired = handler;
}
let refreshing: Promise<TokenPair> | null = null;
export function refreshIdentity(): Promise<TokenPair> {
  if (!refreshing) {
    const refreshToken = tokens.refresh();
    if (!refreshToken)
      return Promise.reject(new ApiError("请先登录", "UNAUTHENTICATED", 401));
    refreshing = request<TokenPair>("POST", "/auth/refresh", { refreshToken })
      .then((pair) => {
        if (tokens.refresh() !== refreshToken)
          throw new ApiError("账户状态已变更，请重试", "IDENTITY_CHANGED");
        tokens.set(pair);
        return pair;
      })
      .catch((error: unknown) => {
        if (tokens.refresh() === refreshToken) {
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
}
http.interceptors.request.use((config) => {
  if (!config.url?.startsWith("/auth/") || config.url === "/auth/me") {
    if (tokens.access())
      config.headers.set("Authorization", `Bearer ${tokens.access()}`);
  }
  return config;
});
http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError<Envelope<null>>(error)) throw error;
    const config = error.config as RetryConfig | undefined;
    const isProtected =
      config &&
      (!config.url?.startsWith("/auth/") || config.url === "/auth/me");
    if (error.response?.status === 401 && isProtected && !config._retried) {
      config._retried = true;
      if (!tokens.refresh()) {
        tokens.clear();
        onExpired();
        throw new ApiError("登录已失效，请重新登录", "UNAUTHENTICATED", 401);
      }
      // A delayed 401 may arrive after another request has already refreshed the token.
      if (config.headers.get("Authorization") === `Bearer ${tokens.access()}`)
        await refreshIdentity();
      config.headers.set("Authorization", `Bearer ${tokens.access()}`);
      return http(config);
    }
    if (error.response?.status === 401 && isProtected) {
      tokens.clear();
      onExpired();
    }
    throw new ApiError(
      error.response?.data?.message ||
        (error.code === AxiosError.ECONNABORTED
          ? "请求超时，请重试"
          : "暂时无法连接服务，请检查网络后重试"),
      error.response?.data?.code,
      error.response?.status,
    );
  },
);
export async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH",
  url: string,
  data?: unknown,
  params?: object,
): Promise<T> {
  const response = await http.request<Envelope<T>>({
    method,
    url,
    data,
    params,
  });
  if (response.data.code !== "OK")
    throw new ApiError(response.data.message, response.data.code);
  return response.data.data;
}
