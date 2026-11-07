import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError, errorMessage } from '../api/http';
import { accountApi } from '../api/account';
import { useAuthStore } from '../stores/auth';
import { useResource } from './useResource';
import type { AuthSession } from '../types/account';
import type { Page } from '../types/api';
export function sessionLocalTime(value: string) {
  // The device API uses UTC even when a timestamp has no zone suffix.
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  const date = new Date(zoned);
  return Number.isNaN(date.getTime()) ? '时间格式暂不可用' : date.toLocaleString(undefined, { hour12: false });
}
export function useAccountSecurity(autoLoad = true) {
  const auth = useAuthStore(), router = useRouter();
  const resource = useResource<Page<AuthSession>>();
  const page = ref(1), size = 10;
  const currentPassword = ref(''), newPassword = ref(''), confirmation = ref(''), othersPassword = ref('');
  const passwordCode = ref(''), oldCode = ref(''), newPhone = ref(''), newCode = ref('');
  const cooldown = reactive({ PASSWORD: 0, CHANGE_OLD: 0, CHANGE_NEW: 0 }), sending = ref(false);
  const timers: ReturnType<typeof setInterval>[] = [];
  onUnmounted(() => timers.forEach(clearInterval));
  const error = ref(''), notice = ref(''), needsUpgrade = ref(false);
  function message(value: unknown) { return value instanceof ApiError && value.code === 'BAD_CREDENTIALS' ? '当前密码错误，请重新输入。' : errorMessage(value); }
  function refresh() {
    if (auth.accountBusy) return;
    needsUpgrade.value = false;
    return resource.load(async () => {
      try { return await accountApi.sessions(page.value, size); }
      catch (value) {
        if (value instanceof ApiError && value.code === 'AUTH_SESSION_UPGRADE_REQUIRED') { needsUpgrade.value = true; throw new Error('当前凭证需要升级，请刷新登录凭证或重新登录。'); }
        if (value instanceof ApiError && [404, 405].includes(value.status || 0)) throw new Error('设备接口暂不可用，请确认后端已加载新版本并重启。');
        throw value;
      }
    });
  }
  async function signedOut(text: string) { sessionStorage.setItem('wordtrail.security-notice', text); await router.replace('/login'); }
  async function run(operation: () => Promise<void>, success: string) {
    if (auth.accountBusy) return;
    error.value = ''; notice.value = '';
    try {
      await operation();
      if (!auth.user) { await signedOut(success); return; }
      notice.value = success; await refresh();
    } catch (value) {
      error.value = message(value);
      if (!auth.user) await signedOut(error.value);
    }
  }
  const valid = (value: string) => [...value].length >= 8 && [...value].length <= 64;
  async function sendCode(purpose: 'PASSWORD' | 'CHANGE_OLD' | 'CHANGE_NEW') {
    const phone = purpose === 'CHANGE_NEW' ? newPhone.value : auth.user?.phone;
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) { error.value = '请输入有效的手机号。'; return; }
    sending.value = true; error.value = ''; notice.value = '';
    try {
      await accountApi.sendProtectedCode(phone, purpose); notice.value = '验证码已发送，请注意查收。';
      cooldown[purpose] = 60;
      const timer = setInterval(() => { if (--cooldown[purpose] <= 0) clearInterval(timer); }, 1000); timers.push(timer);
    } catch (value) { error.value = message(value); } finally { sending.value = false; }
  }
  async function password() {
    if (auth.accountBusy) return;
    error.value = '';
    if (!/^\d{6}$/.test(passwordCode.value) || !valid(newPassword.value)) { error.value = '请输入 6 位验证码和 8～64 个字符的新密码。'; return; }
    if (newPassword.value !== confirmation.value) { error.value = '两次新密码不一致。'; return; }
    const code = passwordCode.value, next = newPassword.value;
    try { await run(() => auth.changePasswordByCode(code, next), '密码已修改，请使用新密码登录。'); }
    finally { passwordCode.value = ''; newPassword.value = ''; confirmation.value = ''; }
  }
  async function changePhone() {
    if (!/^\d{6}$/.test(oldCode.value) || !/^\d{6}$/.test(newCode.value) || !/^1[3-9]\d{9}$/.test(newPhone.value)) { error.value = '请输入正确的手机号和两次验证码。'; return; }
    try { await run(() => auth.changePhone(oldCode.value, newPhone.value, newCode.value), '手机号已更换，请重新登录。'); }
    finally { oldCode.value = ''; newCode.value = ''; }
  }
  async function logoutOthers() {
    if (auth.accountBusy) return;
    if (!valid(othersPassword.value)) { error.value = '请输入 8～64 个字符的当前密码。'; return; }
    const value = othersPassword.value;
    try { await run(() => auth.logoutOthers(value), '已退出其他设备，当前凭证已更新。'); }
    finally { othersPassword.value = ''; }
  }
  async function revoke(session: AuthSession) { await run(() => auth.revokeSession(session.sessionId, session.current), session.current ? '已退出此设备，请重新登录。' : '该设备会话已撤销。'); }
  async function upgrade() { await run(auth.upgradeSession, '登录凭证已升级。'); }
  if (autoLoad) onMounted(refresh);
  return { auth, ...resource, page, size, currentPassword, newPassword, confirmation, othersPassword, passwordCode, oldCode, newPhone, newCode, cooldown, sending, formError: error, notice, needsUpgrade, refresh, password, changePhone, sendCode, logoutOthers, revoke, upgrade };
}
