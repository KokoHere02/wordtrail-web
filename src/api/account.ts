import { request } from './http';
import type { Page, TokenPair, User } from '../types/api';
import type { AuthSession } from '../types/account';
export const accountApi = {
  sendEmailCode: (email: string, purpose: 'REGISTER' | 'LOGIN' | 'RECOVERY') => request<null>('POST', '/auth/email/send', { email, purpose }),
  recoverEmail: (email: string, code: string, newPassword: string) => request<null>('POST', '/auth/email/recover', { email, code, newPassword }),
  recoverPhone: (phone: string, code: string, newPassword: string) => request<null>('POST', '/auth/phone/recover', { phone, code, newPassword }),
  sendBindEmailCode: (email: string) => request<null>('POST', '/auth/email/send-bind', { email }),
  sendEmailPasswordCode: () => request<null>('POST', '/auth/email/send-password'),
  sendChangeEmailCode: (purpose: 'CHANGE_OLD' | 'CHANGE_NEW', newEmail: string | null) => request<null>('POST', '/auth/email/send-change', { purpose, newEmail }),
  changeEmail: (oldCode: string, newEmail: string, newCode: string) => request<null>('PUT', '/auth/email/change', { oldCode, newEmail, newCode }, undefined, { security: true }),
  emailPasswordByCode: (code: string, newPassword: string) => request<null>('PUT', '/auth/email/password', { code, newPassword }, undefined, { security: true }),
  registerEmail: (email: string, code: string, password: string) => request<TokenPair>('POST', '/auth/email/register', { email, code, password }),
  emailPasswordLogin: (email: string, password: string) => request<TokenPair>('POST', '/auth/email/password-login', { email, password }),
  emailCodeLogin: (email: string, code: string) => request<TokenPair>('POST', '/auth/email/code-login', { email, code }),
  bindEmail: (email: string, code: string, phoneCode: string | null, password: string | null) => request<User>('PUT', '/auth/email/binding', { email, code, phoneCode, password }, undefined, { security: true }),
  sendCode: (phone: string, purpose: 'REGISTER' | 'LOGIN' | 'RECOVERY') => request<null>('POST', '/auth/phone/send', { phone, purpose }),
  sendProtectedCode: (phone: string, purpose: 'PASSWORD' | 'CHANGE_OLD' | 'CHANGE_NEW' | 'EMAIL_BIND') => request<null>('POST', '/auth/phone/send-auth', { phone, purpose }),
  registerPhone: (phone: string, code: string, password: string) => request<TokenPair>('POST', '/auth/phone/register', { phone, code, password }),
  passwordLogin: (phone: string, password: string) => request<TokenPair>('POST', '/auth/phone/password-login', { phone, password }),
  codeLogin: (phone: string, code: string) => request<TokenPair>('POST', '/auth/phone/code-login', { phone, code }),
  passwordByCode: (code: string, newPassword: string) => request<null>('PUT', '/auth/phone/password', { code, newPassword }, undefined, { security: true }),
  changePhone: (oldCode: string, newPhone: string, newCode: string) => request<null>('PUT', '/auth/phone/binding', { oldCode, newPhone, newCode }, undefined, { security: true }),
  sessions: (page: number, size: number) => request<Page<AuthSession>>('GET', '/auth/sessions', undefined, { page, size }),
  revoke: (id: string) => request<null>('POST', `/auth/sessions/${encodeURIComponent(id)}/revoke`, undefined, undefined, { security: true }),
  logoutOthers: (currentPassword: string) => request<TokenPair>('POST', '/auth/logout-others', { currentPassword }, undefined, { security: true }),
};
