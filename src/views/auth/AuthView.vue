<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowRight } from "lucide-vue-next";
import { api } from "../../api";
import { errorMessage, mockEnabled } from "../../api/http";
import { useAuthStore } from "../../stores/auth";
import AppButton from "../../components/ui/AppButton.vue";
import BrandMark from "../../components/ui/BrandMark.vue";
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const registering = computed(() => route.path === "/register");
const form = reactive({ username: "", password: "", nickname: "", deviceName: "" });
const errors = reactive({ username: "", password: "", nickname: "", deviceName: "" });
const busy = ref(false);
const error = ref("");
const notice = ref("");
if (sessionStorage.getItem('wordtrail.security-notice')) {
  notice.value = sessionStorage.getItem('wordtrail.security-notice') || '';
  sessionStorage.removeItem('wordtrail.security-notice');
}
if (sessionStorage.getItem("wordtrail.logout-notice")) {
  notice.value = "本地已退出。服务端退出未能确认，请稍后重试。";
  sessionStorage.removeItem("wordtrail.logout-notice");
}
const redirect = computed(() => {
  const value = route.query.redirect;
  return typeof value === "string" &&
    /^\/(today|learn|plan|records|books|learning|study|statistics|settings|sentences|dictation|words|weak-words)(\/|$|\?)/.test(value)
    ? value
    : "/today";
});
watch(registering, () => {
  form.password = "";
  error.value = "";
  Object.assign(errors, { username: "", password: "", nickname: "", deviceName: "" });
});
async function submit() {
  if (busy.value) return;
  errors.username = /^[a-zA-Z0-9_]{4,32}$/.test(form.username.trim())
    ? ""
    : "用户名须为 4～32 位字母、数字或下划线。";
  errors.password =
    [...form.password].length >= 8 && [...form.password].length <= 64
      ? ""
      : "密码须为 8～64 个字符。";
  errors.nickname =
    registering.value && form.nickname.trim().length > 64
      ? "昵称不能超过 64 个字符。"
      : "";
  errors.deviceName = !registering.value && [...form.deviceName.trim()].length > 100 ? '设备名称最多 100 个字符。' : '';
  if (Object.values(errors).some(Boolean)) {
    document
      .getElementById(
        errors.username
          ? "username"
          : errors.password
            ? "password"
            : errors.nickname ? "nickname" : "device-name",
      )
      ?.focus();
    return;
  }
  error.value = "";
  busy.value = true;
  try {
    if (registering.value) {
      await api.register({
        username: form.username.trim(),
        password: form.password,
        ...(form.nickname.trim() ? { nickname: form.nickname.trim() } : {}),
      });
      form.password = "";
      notice.value = "注册成功，请使用刚才的账号登录。";
      await router.replace({
        path: "/login",
        query: { redirect: redirect.value },
      });
    } else {
      await auth.login({
        username: form.username.trim(),
        password: form.password,
        ...(form.deviceName.trim() ? { deviceName: form.deviceName.trim() } : {}),
      });
      form.password = "";
      await router.replace(redirect.value);
    }
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="auth-page">
    <BrandMark />
    <section class="auth-card">
      <h1>{{ registering ? "创建账户" : "欢迎回来" }}</h1>
      <div v-if="notice" class="notice" role="status">{{ notice }}</div>
      <form novalidate @submit.prevent="submit">
        <div class="field">
          <label for="username">用户名</label
          ><input
            id="username"
            v-model="form.username"
            name="username"
            autocomplete="username"
            placeholder="你的用户名"
            :disabled="busy"
            :aria-invalid="!!errors.username"
            aria-describedby="username-help"
          /><small
            id="username-help"
            :class="{ 'field-error': errors.username }"
            >{{ errors.username || "4～32 位英文字母、数字或下划线" }}</small
          >
        </div>
        <div v-if="registering" class="field">
          <label for="nickname">昵称 <span class="muted">（可选）</span></label
          ><input
            id="nickname"
            v-model="form.nickname"
            name="nickname"
            autocomplete="nickname"
            placeholder="希望我们如何称呼你"
            :disabled="busy"
            :aria-invalid="!!errors.nickname"
            :aria-describedby="errors.nickname ? 'nickname-help' : undefined"
          /><small
            v-if="errors.nickname"
            id="nickname-help"
            class="field-error"
            >{{ errors.nickname }}</small
          >
        </div>
        <div class="field">
          <label for="password">密码</label
          ><input
            id="password"
            v-model="form.password"
            type="password"
            name="password"
            :autocomplete="registering ? 'new-password' : 'current-password'"
            placeholder="输入密码"
            :disabled="busy"
            :aria-invalid="!!errors.password"
            aria-describedby="password-help"
          /><small
            id="password-help"
            :class="{ 'field-error': errors.password }"
            >{{ errors.password || "8～64 个字符" }}</small
          >
        </div>
        <div v-if="!registering" class="field"><label for="device-name">设备名称（可选）</label><input id="device-name" v-model="form.deviceName" :disabled="busy" autocomplete="off" :aria-invalid="!!errors.deviceName" aria-describedby="device-name-help" placeholder="例如：我的笔记本" /><small id="device-name-help" :class="{ 'field-error': errors.deviceName }">{{ errors.deviceName || '仅作自定义标记，不识别实际硬件' }}</small></div>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <AppButton type="submit" class="auth-submit" :busy="busy"
          >{{ registering ? "创建账户" : "登录" }}<ArrowRight :size="17"
        /></AppButton>
      </form>
      <div class="auth-switch">
        {{ registering ? "已有账户？" : "还没有账户？"
        }}<RouterLink
          :to="{
            path: registering ? '/login' : '/register',
            query: route.query,
          }"
          >{{ registering ? "去登录" : "注册账户" }}</RouterLink
        >
      </div>
    </section>
    <p v-if="mockEnabled" class="mock-notice">
      当前为离线演示，数据仅保存在此浏览器。可使用任意符合格式的账号与密码体验，请勿输入真实密码。
    </p>
  </main>
</template>
