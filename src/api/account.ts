import { request } from './http';
import type { Page, TokenPair } from '../types/api';
import type { AuthSession } from '../types/account';
export const accountApi = {
  sessions: (page: number, size: number) => request<Page<AuthSession>>('GET', '/auth/sessions', undefined, { page, size }),
  revoke: (id: string) => request<null>('POST', `/auth/sessions/${encodeURIComponent(id)}/revoke`, undefined, undefined, { security: true }),
  password: (currentPassword: string, newPassword: string) => request<null>('PUT', '/auth/password', { currentPassword, newPassword }, undefined, { security: true }),
  logoutOthers: (currentPassword: string) => request<TokenPair>('POST', '/auth/logout-others', { currentPassword }, undefined, { security: true }),
};
