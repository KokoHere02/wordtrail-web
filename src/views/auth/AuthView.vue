<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Moon, Sun } from 'lucide-vue-next';
import { accountApi } from '../../api/account';
import { errorMessage, mockEnabled } from '../../api/http';
import { useAuthStore } from '../../stores/auth';
import { useTheme } from '../../composables/useTheme';
import AppButton from '../../components/ui/AppButton.vue';
const route = useRoute(), router = useRouter(), auth = useAuthStore();
const { isDark, toggleTheme } = useTheme();
const registering = computed(() => route.path === '/register');
const mode = ref<'password' | 'code'>('password');
const form = reactive({ phone: '', password: '', code: '' });
const busy = ref(false), sending = ref(false), remaining = ref(0), error = ref('');
const notice = ref(sessionStorage.getItem('wordtrail.security-notice') || '');
sessionStorage.removeItem('wordtrail.security-notice');
if (sessionStorage.getItem('wordtrail.logout-notice')) { notice.value = '本地已退出。服务端退出未能确认，请稍后重试。'; sessionStorage.removeItem('wordtrail.logout-notice'); }
const redirect = computed(() => {
  const value = route.query.redirect;
  return typeof value === 'string' && /^\/(today|learn|plan|records|books|learning|study|statistics|settings|sentences|dictation|words|weak-words)(\/|$|\?)/.test(value) ? value : '/today';
});
let timer: ReturnType<typeof setInterval> | undefined;
onUnmounted(() => clearInterval(timer));
watch([registering, mode], () => { form.password = ''; form.code = ''; error.value = ''; });
async function send() {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) { error.value = '请输入正确的中国大陆手机号。'; return; }
  sending.value = true; error.value = '';
  try {
    await accountApi.sendCode(form.phone, registering.value ? 'REGISTER' : 'LOGIN');
    notice.value = '验证码已发送，请注意查收。'; remaining.value = 60;
    clearInterval(timer); timer = setInterval(() => { if (--remaining.value <= 0) clearInterval(timer); }, 1000);
  } catch (value) { error.value = errorMessage(value); }
  finally { sending.value = false; }
}
async function submit() {
  if (busy.value) return;
  if (!/^1[3-9]\d{9}$/.test(form.phone)) { error.value = '请输入正确的中国大陆手机号。'; return; }
  if ((registering.value || mode.value === 'password') && ([...form.password].length < 8 || [...form.password].length > 64)) { error.value = '密码须为 8～64 个字符。'; return; }
  if ((registering.value || mode.value === 'code') && !/^\d{6}$/.test(form.code)) { error.value = '请输入 6 位验证码。'; return; }
  busy.value = true; error.value = '';
  try {
    await auth.loginPhone(() => registering.value ? accountApi.registerPhone(form.phone, form.code, form.password) : mode.value === 'password' ? accountApi.passwordLogin(form.phone, form.password) : accountApi.codeLogin(form.phone, form.code));
    form.password = ''; form.code = ''; await router.replace(redirect.value);
  } catch (value) { error.value = errorMessage(value); }
  finally { busy.value = false; }
}
</script>
<template>
  <main class="auth-shell">
    <RouterLink class="auth-wordmark" to="/login" aria-label="拾词登录页">
      <span class="auth-monogram" aria-hidden="true">W</span><span>拾词 <small>WORDORY</small></span>
    </RouterLink>
    <button class="auth-theme-toggle" type="button" :aria-pressed="isDark" :aria-label="isDark ? '切换浅色主题' : '切换深色主题'" :title="isDark ? '切换浅色主题' : '切换深色主题'" @click="toggleTheme">
      <Sun v-if="isDark" :size="21" aria-hidden="true" /><Moon v-else :size="21" aria-hidden="true" />
    </button>
    <div class="auth-layout">
      <aside class="word-entry" aria-label="单词释义">
        <div class="entry-index"><span>No. 037</span><span aria-hidden="true"></span></div>
        <div class="entry-copy">
          <h2 lang="en">serendipity</h2>
          <p class="entry-phonetic">/ˌserənˈdɪpəti/</p>
          <p class="entry-definition"><i>n.</i><span>意外的幸运；在无意中发现美好事物的机缘</span></p>
          <blockquote lang="en">I found a lovely little bookshop by chance.</blockquote>
        </div>
        <svg class="entry-art" viewBox="0 0 310 175" fill="none" aria-hidden="true">
          <g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.25">
            <path d="M35 120 155 104l99 14-120 19zM35 120c-6 6-7 18-1 23l101 15 119-19v-21M34 143l100 16c-4-7-4-15 0-22m5 2 108-17m-108 21 108-17m-108 21 108-17M59 91l99-15 74 11-99 15zM59 91c-5 5-5 14-1 19l74 12 100-16V87M58 110l74 12c-3-6-3-14 1-20m4 1 88-13m-88 18 88-14m-88 18 88-14"/>
            <path d="M231 116c16-18 27-40 32-69m-23 54c14-2 24-7 33-15m-22-12c-10-4-16-12-18-23m24 4c11-5 18-13 19-23m-13 37c9 0 18-4 25-11m-25-10c-4-10-3-19 2-28"/>
            <path d="M233 51c10 1 17 7 19 17-10-1-17-7-19-17Zm43-19c0 10-6 18-17 22 0-10 6-18 17-22Zm12 26c-4 9-13 13-24 12 4-9 12-13 24-12ZM265 20c6 8 5 18-1 27-6-8-5-18 1-27ZM273 86c-5 8-15 12-26 11 5-8 14-12 26-11Z"/>
          </g>
        </svg>
        <div class="entry-bottom" aria-hidden="true"></div>
      </aside>

      <section class="auth-panel" :aria-label="registering ? '注册拾词' : '登录拾词'">
        <div v-if="!registering" class="auth-tabs" role="tablist" aria-label="登录方式">
          <button type="button" role="tab" :aria-selected="mode === 'password'" :class="{ selected: mode === 'password' }" @click="mode = 'password'">密码登录</button>
          <button type="button" role="tab" :aria-selected="mode === 'code'" :class="{ selected: mode === 'code' }" @click="mode = 'code'">验证码登录</button>
          <span class="auth-tab-indicator" :class="{ 'on-code': mode === 'code' }" aria-hidden="true"></span>
        </div>
        <p v-if="!registering && mode === 'code'" class="auth-code-hint">未注册的手机号验证后将自动创建账户，可登录后在账户安全中设置密码。</p>
        <p v-if="registering" class="auth-intro">用手机号开始你的学习旅程</p>
        <div v-if="notice" class="auth-notice" role="status">{{ notice }}</div>
        <form class="auth-form" novalidate @submit.prevent="submit">
          <div class="auth-field"><label for="phone">手机号</label><input id="phone" v-model.trim="form.phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="11" placeholder="请输入手机号" :disabled="busy" /></div>
          <Transition name="credential-switch" mode="out-in">
            <div :key="registering ? 'register' : mode" class="auth-credential-fields">
              <div v-if="registering || mode === 'code'" class="auth-field"><label for="code">短信验证码</label><div class="code-input"><input id="code" v-model.trim="form.code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="请输入 6 位验证码" :disabled="busy" /><button type="button" :disabled="busy || sending || remaining > 0" @click="send">{{ remaining ? `${remaining} 秒后重发` : sending ? '发送中…' : '获取验证码' }}</button></div></div>
              <div v-if="registering || mode === 'password'" class="auth-field"><label for="password">{{ registering ? '设置密码' : '密码' }}</label><input id="password" v-model="form.password" type="password" :autocomplete="registering ? 'new-password' : 'current-password'" :placeholder="registering ? '请输入 8～64 个字符' : '请输入密码'" :disabled="busy" /></div>
            </div>
          </Transition>
          <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
          <AppButton type="submit" class="auth-action" :busy="busy">{{ registering ? '注册并登录' : '登录' }}</AppButton>
        </form>
        <p class="auth-alternate">{{ registering ? '已有账户？' : '还没有账户？' }}<RouterLink :to="{ path: registering ? '/login' : '/register', query: route.query }">{{ registering ? '去登录' : '注册账户' }}</RouterLink></p>
        <p v-if="mockEnabled" class="auth-demo">当前为离线演示，验证码为 123456，请勿输入真实密码。</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.auth-shell {
  position: relative;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 100px clamp(28px, 5vw, 80px) 56px;
  background: var(--bg);
  color: var(--accent);
}
.auth-theme-toggle {
  position: absolute;
  top: 24px;
  right: clamp(24px, 5vw, 80px);
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
}
.auth-theme-toggle:hover { background: var(--hover); }
.auth-layout {
  width: min(100%, 1320px);
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(340px, .88fr);
  gap: clamp(72px, 9vw, 150px);
  align-items: center;
}
.word-entry {
  position: relative;
  min-height: 650px;
  display: flex;
  flex-direction: column;
  font-family: var(--font-serif);
}
.entry-index { display: flex; align-items: center; gap: 20px; font-style: italic; font-size: 18px; letter-spacing: .03em; }
.entry-index span:last-child { flex: 1; height: 1px; background: currentColor; opacity: .8; }
.entry-copy { padding: clamp(55px, 7vw, 100px) 0 0 20px; }
.entry-copy h2 { margin: 0; font: 500 clamp(58px, 7.1vw, 104px)/.98 var(--font-serif); letter-spacing: -.055em; overflow-wrap: anywhere; }
.entry-phonetic { margin: 16px 0 0; font-size: clamp(19px, 2vw, 27px); letter-spacing: .015em; }
.entry-definition { display: flex; gap: 16px; align-items: baseline; margin: 43px 0 0; font-family: var(--font-serif), "Songti SC", "SimSun", serif; font-size: clamp(17px, 1.5vw, 22px); line-height: 1.8; }
.entry-definition i { font-size: 1.15em; }
.entry-copy blockquote { margin: 46px 0 0 4px; padding: 2px 0 2px 20px; border-left: 1px solid currentColor; font: italic clamp(16px, 1.4vw, 20px)/1.6 var(--font-serif); }
.entry-art { width: min(53%, 275px); height: auto; align-self: flex-end; margin-top: auto; margin-right: 25px; }
.entry-bottom { height: 1px; width: 100%; background: currentColor; opacity: .8; margin-top: 20px; }
.auth-panel { width: 100%; max-width: 440px; justify-self: center; color: var(--accent); }
.auth-wordmark { position: absolute; top: 26px; left: clamp(28px, 5vw, 80px); display: flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; font-family: "Songti SC", "SimSun", var(--font-serif); font-size: 19px; font-weight: 600; letter-spacing: .04em; }
.auth-wordmark small { font: 600 15px/1 var(--font-serif); letter-spacing: .09em; }
.auth-monogram { font: 600 49px/.85 var(--font-serif); letter-spacing: -.09em; }
.auth-tabs { position: relative; display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--line); margin-bottom: 28px; }
.auth-tabs button { position: relative; padding: 0 8px 15px; border: 0; background: transparent; color: var(--muted); font-size: 16px; cursor: pointer; }
.auth-tabs button.selected { color: var(--accent); font-weight: 600; }
.auth-tab-indicator { position: absolute; left: 0; bottom: -1px; width: 50%; height: 2px; background: var(--accent); transition: transform 240ms ease; }
.auth-tab-indicator.on-code { transform: translateX(100%); }
.auth-intro { text-align: center; color: var(--muted); margin: 0 0 30px; font-size: 14px; }
.auth-code-hint { color: var(--muted); margin: -12px 0 22px; font-size: 13px; line-height: 1.6; }
.auth-form { display: grid; gap: 22px; }
.auth-credential-fields { display: grid; gap: 22px; }
.credential-switch-enter-active, .credential-switch-leave-active { transition: opacity 150ms ease, transform 150ms ease; }
.credential-switch-enter-from { opacity: 0; transform: translateY(7px); }
.credential-switch-leave-to { opacity: 0; transform: translateY(-5px); }
.auth-field { display: grid; gap: 9px; min-width: 0; }
.auth-field label { color: var(--ink); font-size: 15px; font-weight: 600; }
.auth-field input { width: 100%; min-width: 0; height: 50px; border: 1px solid var(--answer-border); border-radius: 12px; padding: 0 14px; background: transparent; color: var(--ink); font: inherit; font-size: 15px; }
.auth-field input::placeholder { color: var(--text-placeholder); }
.code-input { display: flex; align-items: stretch; border: 1px solid var(--answer-border); border-radius: 12px; }
.code-input input { flex: 1; border: 0; }
.code-input button { flex: none; margin: 10px 0; padding: 0 13px; border: 0; border-left: 1px solid var(--line); background: transparent; color: var(--accent); font-size: 14px; cursor: pointer; }
.code-input button:disabled { color: var(--muted); cursor: not-allowed; }
.auth-action { width: 100%; min-height: 52px; margin-top: 8px; border-radius: 6px; font-size: 17px; font-weight: 600; letter-spacing: .12em; }
.auth-alternate { margin: 28px 0 0; text-align: center; color: var(--muted); font-size: 14px; }
.auth-alternate a { margin-left: 6px; color: var(--accent); text-decoration: underline; text-underline-offset: 4px; }
.auth-notice, .auth-error, .auth-demo { font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.auth-notice { margin: 0 0 20px; color: var(--accent); }
.auth-error { margin: -8px 0 0; color: var(--error); }
.auth-demo { margin: 24px 0 0; text-align: center; color: var(--muted); }
@media (max-width: 900px) {
  .auth-layout { gap: 48px; grid-template-columns: minmax(0, 1fr) minmax(300px, .9fr); }
  .word-entry { min-height: 560px; }
  .entry-copy { padding-left: 0; }
  .entry-copy h2 { font-size: clamp(48px, 7vw, 70px); }
  .entry-definition { font-size: 17px; }
}
@media (max-width: 700px) {
  .auth-shell { padding: 100px 24px 48px; align-items: start; }
  .auth-wordmark { top: 24px; left: 24px; }
  .auth-theme-toggle { top: 16px; right: 16px; }
  .auth-layout { width: min(100%, 440px); display: flex; flex-direction: column-reverse; gap: 70px; }
  .auth-panel { max-width: none; }
  .word-entry { width: 100%; min-height: 0; }
  .entry-copy { padding-top: 40px; }
  .entry-copy h2 { font-size: clamp(48px, 12vw, 72px); }
  .entry-definition { margin-top: 26px; }
  .entry-copy blockquote { margin-top: 26px; }
  .entry-art { width: 48%; margin-top: 12px; margin-right: 0; }
  .entry-bottom { margin-top: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .credential-switch-enter-active, .credential-switch-leave-active, .auth-tab-indicator { transition: none; }
}
</style>
