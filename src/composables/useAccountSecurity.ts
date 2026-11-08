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
  const bindEmailAddress = ref(''), bindEmailCode = ref(''), bindPhoneCode = ref(''), bindPassword = ref('');
  const bindMethod = ref<'phone' | 'password'>(auth.user?.phone ? 'phone' : 'password');
  const bindEmailCooldown = ref(0), bindPhoneCooldown = ref(0);
  const changeEmailAddress = ref(''), changeEmailOldCode = ref(''), changeEmailNewCode = ref('');
  const changeEmailCooldown = reactive({ CHANGE_OLD: 0, CHANGE_NEW: 0 });
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
    if (purpose === 'PASSWORD' && !auth.user?.phone && auth.user?.email) {
      sending.value = true; error.value = ''; notice.value = '';
      try { await accountApi.sendEmailPasswordCode(); notice.value = '邮箱验证码已发送，请注意查收。'; cooldown.PASSWORD = 60; const timer = setInterval(() => { if (--cooldown.PASSWORD <= 0) clearInterval(timer); }, 1000); timers.push(timer); }
      catch (value) { error.value = message(value); } finally { sending.value = false; }
      return;
    }
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
  async function sendBindingEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bindEmailAddress.value) || bindEmailAddress.value.length > 254) { error.value = '请输入有效的邮箱地址。'; return; }
    sending.value = true; error.value = ''; notice.value = '';
    try { await accountApi.sendBindEmailCode(bindEmailAddress.value); notice.value = '邮箱验证码已发送，请注意查收。'; bindEmailCooldown.value = 60; const timer = setInterval(() => { if (--bindEmailCooldown.value <= 0) clearInterval(timer); }, 1000); timers.push(timer); }
    catch (value) { error.value = message(value); } finally { sending.value = false; }
  }
  async function sendBindingPhone() {
    if (!auth.user?.phone) { error.value = '当前账户未绑定手机号，请使用密码验证。'; return; }
    sending.value = true; error.value = ''; notice.value = '';
    try { await accountApi.sendProtectedCode(auth.user.phone, 'EMAIL_BIND'); notice.value = '短信验证码已发送，请注意查收。'; bindPhoneCooldown.value = 60; const timer = setInterval(() => { if (--bindPhoneCooldown.value <= 0) clearInterval(timer); }, 1000); timers.push(timer); }
    catch (value) { error.value = message(value); } finally { sending.value = false; }
  }
  async function bindEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bindEmailAddress.value) || !/^\d{6}$/.test(bindEmailCode.value) || (bindMethod.value === 'phone' ? !/^\d{6}$/.test(bindPhoneCode.value) : !valid(bindPassword.value))) { error.value = '请输入邮箱、验证码和有效的身份验证信息。'; return; }
    try { await run(() => auth.bindEmail(bindEmailAddress.value, bindEmailCode.value, bindMethod.value === 'phone' ? bindPhoneCode.value : null, bindMethod.value === 'password' ? bindPassword.value : null), '邮箱已绑定。'); }
    finally { bindEmailCode.value = ''; bindPhoneCode.value = ''; bindPassword.value = ''; }
  }
  async function sendChangeEmail(purpose: 'CHANGE_OLD' | 'CHANGE_NEW') {
    if (!auth.user?.email) { error.value = '当前账户未绑定邮箱。'; return; }
    const address = changeEmailAddress.value.trim();
    if (purpose === 'CHANGE_NEW') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254) { error.value = '请输入有效的新邮箱地址。'; return; }
      if (address.toLowerCase() === auth.user.email.toLowerCase()) { error.value = '新邮箱不能与原邮箱相同。'; return; }
    }
    sending.value = true; error.value = ''; notice.value = '';
    try {
      await accountApi.sendChangeEmailCode(purpose, purpose === 'CHANGE_NEW' ? address : null);
      notice.value = purpose === 'CHANGE_OLD' ? '验证码已发送至原邮箱。' : '验证码已发送至新邮箱。';
      changeEmailCooldown[purpose] = 60;
      const timer = setInterval(() => { if (--changeEmailCooldown[purpose] <= 0) clearInterval(timer); }, 1000); timers.push(timer);
    } catch (value) { error.value = message(value); } finally { sending.value = false; }
  }
  async function changeEmail() {
    const address = changeEmailAddress.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254 || !/^\d{6}$/.test(changeEmailOldCode.value) || !/^\d{6}$/.test(changeEmailNewCode.value)) { error.value = '请输入正确的新邮箱和两次验证码。'; return; }
    if (address.toLowerCase() === auth.user?.email?.toLowerCase()) { error.value = '新邮箱不能与原邮箱相同。'; return; }
    await run(() => auth.changeEmail(changeEmailOldCode.value, address, changeEmailNewCode.value), '邮箱已更换，请重新登录。');
    if (!auth.user) { changeEmailOldCode.value = ''; changeEmailNewCode.value = ''; }
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
  return { auth, ...resource, page, size, currentPassword, newPassword, confirmation, othersPassword, passwordCode, oldCode, newPhone, newCode, cooldown, sending, formError: error, notice, needsUpgrade, refresh, password, changePhone, sendCode, logoutOthers, revoke, upgrade, bindEmailAddress, bindEmailCode, bindPhoneCode, bindPassword, bindMethod, bindEmailCooldown, bindPhoneCooldown, sendBindingEmail, sendBindingPhone, bindEmail, changeEmailAddress, changeEmailOldCode, changeEmailNewCode, changeEmailCooldown, sendChangeEmail, changeEmail };
}
