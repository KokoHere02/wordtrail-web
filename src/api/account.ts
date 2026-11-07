import { request } from './http';
import type { Page, TokenPair } from '../types/api';
import type { AuthSession } from '../types/account';
export const accountApi = {
  sendCode: (phone: string, purpose: 'REGISTER' | 'LOGIN') => request<null>('POST', '/auth/phone/send', { phone, purpose }),
  sendProtectedCode: (phone: string, purpose: 'PASSWORD' | 'CHANGE_OLD' | 'CHANGE_NEW') => request<null>('POST', '/auth/phone/send-auth', { phone, purpose }),
  registerPhone: (phone: string, code: string, password: string) => request<TokenPair>('POST', '/auth/phone/register', { phone, code, password }),
  passwordLogin: (phone: string, password: string) => request<TokenPair>('POST', '/auth/phone/password-login', { phone, password }),
  codeLogin: (phone: string, code: string) => request<TokenPair>('POST', '/auth/phone/code-login', { phone, code }),
  passwordByCode: (code: string, newPassword: string) => request<null>('PUT', '/auth/phone/password', { code, newPassword }, undefined, { security: true }),
  changePhone: (oldCode: string, newPhone: string, newCode: string) => request<null>('PUT', '/auth/phone/binding', { oldCode, newPhone, newCode }, undefined, { security: true }),
  sessions: (page: number, size: number) => request<Page<AuthSession>>('GET', '/auth/sessions', undefined, { page, size }),
  revoke: (id: string) => request<null>('POST', `/auth/sessions/${encodeURIComponent(id)}/revoke`, undefined, undefined, { security: true }),
  logoutOthers: (currentPassword: string) => request<TokenPair>('POST', '/auth/logout-others', { currentPassword }, undefined, { security: true }),
};
