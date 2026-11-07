<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronDown, LockKeyhole, Smartphone } from 'lucide-vue-next';
import { useAccountSecurity, sessionLocalTime } from '../../composables/useAccountSecurity';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
const props = defineProps<{ view: 'security' | 'devices'; editor?: 'password' | 'phone' }>();
const security = useAccountSecurity(false);
watch(() => props.view, view => { if (view === 'devices') void security.refresh(); }, { immediate: true });
const { auth, data, loading, error, page, size, newPassword, confirmation, othersPassword, passwordCode, oldCode, newPhone, newCode, cooldown, sending, formError, notice, needsUpgrade } = security;
const passwordBlurred = ref(false);
const passwordsMismatch = computed(() => passwordBlurred.value && !!newPassword.value && !!confirmation.value && newPassword.value !== confirmation.value);
watch([newPassword, confirmation], ([password, confirm]) => { if (!password && !confirm) passwordBlurred.value = false; });
const activeEditor = ref<'password' | 'phone' | null>(null);
watch(() => props.editor, value => { if (value) activeEditor.value = value; }, { immediate: true });
function toggleEditor(value: 'password' | 'phone') {
  activeEditor.value = activeEditor.value === value ? null : value;
  formError.value = ''; notice.value = '';
}
</script>
<template>
  <div class="account-security">
    <header class="security-heading"><div><p class="security-eyebrow">{{ view === 'security' ? 'ACCOUNT SECURITY' : 'DEVICE SESSIONS' }}</p><h2>{{ view === 'security' ? '账户安全' : '登录设备' }}</h2><p>{{ view === 'security' ? '管理你的登录方式与绑定信息。' : '查看和管理账户的设备会话。' }}</p></div></header>
    <p v-if="formError" class="security-feedback security-feedback-error" role="alert">{{ formError }}</p><p v-if="notice" class="security-feedback" role="status">{{ notice }}</p>
    <div v-show="view === 'security'" class="security-settings">
      <section class="security-item" aria-labelledby="phone-title">
        <div class="security-item-heading"><span class="security-icon"><Smartphone :size="20" aria-hidden="true" /></span><div class="security-item-copy"><h3 id="phone-title">绑定手机号</h3><p>{{ auth.user?.phone ? auth.user.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '尚未绑定手机号' }}</p></div><button class="security-expand" type="button" :disabled="auth.accountBusy || sending" :aria-expanded="activeEditor === 'phone'" aria-controls="phone-editor" @click="toggleEditor('phone')">{{ activeEditor === 'phone' ? '收起' : '更换手机号' }}<ChevronDown :size="16" :class="{ expanded: activeEditor === 'phone' }" aria-hidden="true" /></button></div>
        <div id="phone-editor" v-show="activeEditor === 'phone'" class="security-details"><p class="security-detail-intro">请分别验证原手机号和新手机号。更换成功后，所有设备需要重新登录。</p><form class="security-form" novalidate @submit.prevent="security.changePhone"><fieldset :disabled="auth.accountBusy"><div class="security-field"><label for="old-code">原手机号验证码</label><div class="security-code"><input id="old-code" v-model.trim="oldCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="输入原手机号验证码" /><button type="button" :disabled="sending || cooldown.CHANGE_OLD > 0" @click="security.sendCode('CHANGE_OLD')">{{ cooldown.CHANGE_OLD ? `${cooldown.CHANGE_OLD} 秒后重发` : '获取验证码' }}</button></div></div><div class="security-field"><label for="new-phone">新手机号</label><input id="new-phone" v-model.trim="newPhone" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel" placeholder="输入新手机号" /></div><div class="security-field"><label for="new-code">新手机号验证码</label><div class="security-code"><input id="new-code" v-model.trim="newCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="输入新手机号验证码" /><button type="button" :disabled="sending || cooldown.CHANGE_NEW > 0" @click="security.sendCode('CHANGE_NEW')">{{ cooldown.CHANGE_NEW ? `${cooldown.CHANGE_NEW} 秒后重发` : '获取验证码' }}</button></div></div><button class="btn btn-primary security-submit">确认更换手机号</button></fieldset></form></div>
      </section>
      <section class="security-item" aria-labelledby="password-title">
        <div class="security-item-heading"><span class="security-icon"><LockKeyhole :size="20" aria-hidden="true" /></span><div class="security-item-copy"><h3 id="password-title">登录密码</h3><p>通过已绑定的手机号验证后设置或修改</p></div><button class="security-expand" type="button" :disabled="auth.accountBusy || sending" :aria-expanded="activeEditor === 'password'" aria-controls="password-editor" @click="toggleEditor('password')">{{ activeEditor === 'password' ? '收起' : '修改密码' }}<ChevronDown :size="16" :class="{ expanded: activeEditor === 'password' }" aria-hidden="true" /></button></div>
        <div id="password-editor" v-show="activeEditor === 'password'" class="security-details"><p class="security-detail-intro">修改成功后，所有设备需要重新登录。</p><form class="security-form" novalidate @submit.prevent="security.password"><fieldset :disabled="auth.accountBusy"><div class="security-field"><label for="password-code">短信验证码</label><div class="security-code"><input id="password-code" v-model.trim="passwordCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="输入短信验证码" /><button type="button" :disabled="sending || cooldown.PASSWORD > 0" @click="security.sendCode('PASSWORD')">{{ cooldown.PASSWORD ? `${cooldown.PASSWORD} 秒后重发` : '获取验证码' }}</button></div></div><div class="security-field"><label for="new-password">新密码</label><input id="new-password" v-model="newPassword" type="password" autocomplete="new-password" placeholder="请输入 8～64 个字符" @blur="passwordBlurred = true" /></div><div class="security-field"><label for="confirm-password">确认新密码</label><input id="confirm-password" v-model="confirmation" type="password" autocomplete="new-password" placeholder="再次输入新密码" :aria-invalid="passwordsMismatch" :aria-describedby="passwordsMismatch ? 'password-mismatch' : undefined" @blur="passwordBlurred = true" /><p v-if="passwordsMismatch" id="password-mismatch" class="security-field-error" role="status">两次输入的密码不一致。</p></div><button class="btn btn-primary security-submit">修改密码并重新登录</button></fieldset></form></div>
      </section>
    </div>
    <section v-show="view === 'devices'" class="account-section" aria-labelledby="sessions-title"><div class="sentence-linked-heading"><h2 id="sessions-title">设备会话</h2><button class="muted-link" :disabled="loading || auth.accountBusy" @click="security.refresh">刷新设备</button></div><p class="subtle-copy">设备名称由登录时自定义；以下时间已转为本地时间。最近刷新时间不代表每次使用时间。</p><StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="暂无可列出的有效设备会话，旧凭证可能尚未升级。" @retry="security.refresh" /><button v-if="needsUpgrade || data?.total === 0" class="btn btn-secondary" :disabled="auth.accountBusy" @click="security.upgrade">升级登录凭证</button><article v-for="session in !loading && !error ? data?.records : []" :key="session.sessionId" class="account-device-row"><div><h3>{{ session.deviceName }} <span v-if="session.current" class="learning-badge">当前会话</span></h3><dl><div><dt>登录</dt><dd>{{ sessionLocalTime(session.createdAt) }}</dd></div><div><dt>最近刷新</dt><dd>{{ sessionLocalTime(session.lastRefreshedAt) }}</dd></div><div><dt>到期</dt><dd>{{ sessionLocalTime(session.expiresAt) }}</dd></div></dl></div><button class="btn btn-secondary" :disabled="auth.accountBusy" @click="security.revoke(session)">{{ session.current ? '退出此设备' : '撤销会话' }}</button></article><AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading || auth.accountBusy" @change="page = $event; security.refresh()" />
      <form class="sentence-editor" novalidate @submit.prevent="security.logoutOthers"><fieldset :disabled="auth.accountBusy"><label for="others-password">验证当前密码，退出其他设备</label><input id="others-password" v-model="othersPassword" type="password" autocomplete="current-password" /><button class="btn btn-secondary">退出其他设备</button></fieldset></form>
    </section>
  </div>
</template>

<style scoped>
.security-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 30px; }
.security-heading h2 { margin: 0; color: var(--ink); font-size: 24px; font-weight: 600; letter-spacing: -.025em; }
.security-heading p:not(.security-eyebrow) { margin-top: 8px; color: var(--muted); font-size: 14px; line-height: 1.6; }
.security-eyebrow { margin: 0 0 10px; color: var(--accent); font-size: 10px; font-weight: 600; letter-spacing: .14em; }
.security-settings { border: 1px solid var(--line); border-radius: 16px; background: var(--surface); overflow: hidden; }
.security-item + .security-item { border-top: 1px solid var(--line); }
.security-item-heading { display: flex; align-items: center; gap: 17px; min-height: 114px; padding: 24px 28px; }
.security-icon { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 12px; background: var(--sage); color: var(--accent); }
.security-item-copy { flex: 1; min-width: 0; }
.security-item-copy h3 { margin: 0; color: var(--ink); font-size: 16px; font-weight: 600; }
.security-item-copy p { margin-top: 6px; color: var(--muted); font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
.security-expand { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; flex: none; padding: 0 14px; border: 1px solid var(--answer-border); border-radius: 9px; background: transparent; color: var(--accent); font-size: 14px; cursor: pointer; }
.security-expand:hover:not(:disabled) { background: var(--hover); }
.security-expand:disabled { cursor: not-allowed; opacity: .55; }
.security-expand svg { transition: transform var(--motion-fast); }
.security-expand svg.expanded { transform: rotate(180deg); }
.security-details { padding: 0 28px 30px 89px; }
.security-detail-intro { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.7; }
.security-form { width: min(100%, 480px); margin-top: 22px; }
.security-form fieldset { display: grid; gap: 18px; min-width: 0; }
.security-form fieldset:disabled { opacity: .65; }
.security-field { display: grid; gap: 8px; min-width: 0; }
.security-field label { color: var(--ink); font-size: 13px; font-weight: 500; }
.security-field input { width: 100%; min-width: 0; height: 46px; padding: 0 13px; border: 1px solid var(--answer-border); border-radius: 9px; background: var(--bg); color: var(--ink); font: inherit; font-size: 14px; }
.security-field input::placeholder { color: var(--text-placeholder); }
.security-field input[aria-invalid="true"] { border-color: var(--error); }
.security-field-error { margin: 0; color: var(--error); font-size: 13px; line-height: 1.5; }
.security-code { display: flex; gap: 10px; min-width: 0; }
.security-code input { flex: 1; }
.security-code button { flex: none; min-width: 116px; padding: 0 12px; border: 1px solid var(--answer-border); border-radius: 9px; background: transparent; color: var(--accent); font-size: 13px; cursor: pointer; }
.security-code button:hover:not(:disabled) { background: var(--hover); }
.security-code button:disabled { color: var(--muted); cursor: not-allowed; }
.security-submit { justify-self: start; margin-top: 4px; }
.security-feedback { margin: 0 0 18px; padding: 12px 16px; border: 1px solid var(--notice-border); border-radius: 9px; color: var(--ink); background: var(--sage); font-size: 14px; }
.security-feedback-error { color: var(--error); border-color: var(--error-border); background: var(--error-bg); }
@media (max-width: 600px) {
  .security-heading { margin-bottom: 22px; }
  .security-item-heading { flex-wrap: wrap; gap: 12px; min-height: 0; padding: 20px; }
  .security-item-copy { flex: 1 1 calc(100% - 60px); }
  .security-expand { margin-left: 56px; }
  .security-details { padding: 0 20px 24px; }
  .security-code button { min-width: 98px; padding-inline: 8px; }
}
@media (prefers-reduced-motion: reduce) { .security-expand svg { transition: none; } }
</style>
