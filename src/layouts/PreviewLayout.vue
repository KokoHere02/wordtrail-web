<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  Check,
  ChevronDown,
  Keyboard,
  Minus,
  Plus,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-vue-next";
import BrandMark from "../components/ui/BrandMark.vue";
import AppDialog from "../components/ui/AppDialog.vue";
import { usePreviewStore } from "../stores/preview";
const route = useRoute();
const store = usePreviewStore();
const nav = [
  { label: "今日", path: "/today" },
  { label: "学习", path: "/learn" },
  { label: "词库", path: "/books" },
  { label: "记录", path: "/records" },
];
const activeIndex = computed(() =>
  route.path.startsWith("/books")
    ? 2
    : route.path.startsWith("/records") || route.path.includes("/result")
      ? 3
      : route.path === "/today"
        ? 0
        : 1,
);
const footer = computed(() =>
  route.path === "/dictation"
    ? "dictation"
    : route.path === "/learn"
      ? "memory"
      : route.path === "/today"
        ? "today"
        : "other",
);
const comfortable = ref(false);
watch(comfortable, (value) => {
  document.documentElement.dataset.comfort = String(value);
});
watch(
  () => route.path,
  () => {
    store.profileOpen = false;
  },
);
function updateDaily(amount: number) {
  store.dailyNew = Math.min(40, Math.max(5, store.dailyNew + amount));
}
function dismissProfile(event: Event) {
  if (
    store.profileOpen &&
    event.target instanceof HTMLElement &&
    !event.target.closest(".profile-menu,.profile-trigger")
  )
    store.profileOpen = false;
}
function keyboard(event: KeyboardEvent) {
  if (event.key === "Escape") store.profileOpen = false;
}
onMounted(() => {
  document.addEventListener("click", dismissProfile);
  document.addEventListener("keydown", keyboard);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", dismissProfile);
  document.removeEventListener("keydown", keyboard);
});
</script>
<template>
  <div class="wordory-app">
    <a class="skip-link" href="#main">跳至主要内容</a>
    <header class="site-header">
      <BrandMark />
      <nav class="main-nav" aria-label="主导航">
        <span
          class="nav-indicator"
          :style="{ transform: `translateX(${activeIndex * 100}%)` }"
          aria-hidden="true"
        /><RouterLink
          v-for="(item, index) in nav"
          :key="item.path"
          :to="item.path"
          :class="{ active: activeIndex === index }"
          :aria-current="activeIndex === index ? 'page' : undefined"
          >{{ item.label }}</RouterLink
        >
      </nav>
      <div class="header-actions">
        <button
          class="round-icon appearance-button"
          :aria-pressed="comfortable"
          :aria-label="comfortable ? '关闭护眼底色' : '开启护眼底色'"
          @click="comfortable = !comfortable"
        >
          <Sun :size="24" :stroke-width="1.7" /></button
        ><button
          class="round-icon"
          aria-label="打开偏好设置"
          @click="store.settingsOpen = true"
        >
          <SlidersHorizontal :size="23" :stroke-width="1.7" /></button
        ><button
          class="profile-button profile-trigger"
          aria-label="打开个人菜单"
          :aria-expanded="store.profileOpen"
          @click="store.profileOpen = !store.profileOpen"
        >
          H
        </button>
      </div>
    </header>
    <Transition name="popover"
      ><aside v-if="store.profileOpen" class="profile-menu">
        <div class="profile-menu-head">
          <span class="profile-button">H</span>
          <div>
            <strong>Hello, 拾词的你</strong><span>每天一点，慢慢记牢。</span>
          </div>
          <button
            class="round-icon"
            aria-label="关闭个人菜单"
            @click="store.profileOpen = false"
          >
            <X :size="16" />
          </button>
        </div>
        <div class="preview-note">
          <span class="status-orb" />本地 UI 预览<span
            >学习数据为设计演示，未连接后端。</span
          >
        </div>
        <RouterLink to="/records"
          >我的学习记录<ChevronDown :size="15"
        /></RouterLink></aside
    ></Transition>
    <main
      id="main"
      :class="['page-stage', { 'practice-stage': activeIndex === 1 }]"
      tabindex="-1"
    >
      <RouterView v-slot="{ Component }"
        ><Transition name="page" mode="out-in"
          ><component :is="Component" :key="route.path" /></Transition
      ></RouterView>
    </main>
    <footer class="site-footer">
      <span class="footer-motto"
        ><span class="status-orb" />每天一点，慢慢记牢。</span
      >
      <div v-if="footer === 'today'" class="keyboard-hint">
        <kbd>Enter</kbd><span>开始今日学习</span>
      </div>
      <div v-else-if="footer === 'memory'" class="keyboard-hint">
        <kbd>1</kbd><span>忘记</span><kbd>2</kbd><span>模糊</span><kbd>3</kbd
        ><span>认识</span>
      </div>
      <div v-else-if="footer === 'dictation'" class="keyboard-hint">
        <kbd>Backspace</kbd><span>修改</span><span class="hint-dot">·</span
        ><kbd>Ctrl + J</kbd><span>播放发音</span>
      </div>
      <span v-else class="footer-aside">选择适合自己的节奏。</span>
    </footer>
    <AppDialog
      v-model="store.settingsOpen"
      title="找到舒服的学习节奏"
      description="一点点调整，让每次积累都更适合自己。"
      ><div class="settings-row">
        <div>
          <strong>每日新词</strong>
          <p>先复习，再学习新词</p>
        </div>
        <div class="number-stepper">
          <button
            aria-label="减少每日新词"
            :disabled="store.dailyNew <= 5"
            @click="updateDaily(-1)"
          >
            <Minus :size="16" /></button
          ><span>{{ store.dailyNew }}</span
          ><button
            aria-label="增加每日新词"
            :disabled="store.dailyNew >= 40"
            @click="updateDaily(1)"
          >
            <Plus :size="16" />
          </button>
        </div>
      </div>
      <label class="settings-row"
        ><div>
          <strong>自评后自动切词</strong>
          <p>保留片刻反馈，再进入下一个词</p>
        </div>
        <input
          v-model="store.autoNext"
          class="toggle-input"
          type="checkbox" /><span class="toggle-switch" /></label
      ><label class="settings-row"
        ><div>
          <strong>单词发音</strong>
          <p>使用浏览器提供的语音朗读</p>
        </div>
        <input
          v-model="store.sound"
          class="toggle-input"
          type="checkbox" /><span class="toggle-switch"
      /></label>
      <div class="settings-tip">
        <Keyboard :size="18" /><span
          >学习时按 1 / 2 / 3 自评，默写时按 Ctrl + J 发音。</span
        >
      </div>
      <button
        class="btn btn-primary dialog-confirm"
        @click="store.settingsOpen = false"
      >
        就按这个节奏<Check :size="18" /></button
    ></AppDialog>
    <Transition name="toast"
      ><div v-if="store.toast" class="global-toast" role="status">
        <Check :size="17" />{{ store.toast }}
      </div></Transition
    >
  </div>
</template>
