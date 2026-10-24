<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LogOut, Moon, Sun } from 'lucide-vue-next';
import BrandMark from '../components/ui/BrandMark.vue';
import AppDialog from '../components/ui/AppDialog.vue';
import { useAuthStore } from '../stores/auth';
import { mockEnabled } from '../api/http';
import { useTheme } from '../composables/useTheme';
import ContentNav from '../components/layout/ContentNav.vue';
import RecordNav from '../components/layout/RecordNav.vue';
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const profileOpen = ref(false);
const { isDark, toggleTheme } = useTheme();
const signingOut = ref(false);
const name = computed(() => auth.user?.nickname || auth.user?.username || '');
const nav = [
  { label: '今日', shortLabel: '今日', path: '/today' },
  { label: '学习', shortLabel: '学习', path: '/learn' },
  { label: '内容库', shortLabel: '内容库', path: '/books' },
  { label: '记录', shortLabel: '记录', path: '/records' },
];
const activeIndex = computed(() => {
  const path = route.path;
  if (route.meta.workspace) return 1;
  if (path.startsWith('/records') || path.startsWith('/learning') || path === '/statistics' || path === '/sentences/records' || path === '/sentences/statistics' || path.includes('/result')) return 3;
  if (path.startsWith('/books') || path.startsWith('/words/') || path.startsWith('/sentences') || path === '/weak-words' || path === '/plan' || path === '/dictation/mistakes') return 2;
  return path === '/today' || path.startsWith('/settings') ? 0 : 1;
});
const isReview = computed(() => route.path === '/learn' || route.path.startsWith('/learn/') || route.path.startsWith('/study/') || /^\/dictation\/\d+$/.test(route.path) || /^\/sentences\/sessions\/\d+$/.test(route.path));
watch(() => route.path, () => { profileOpen.value = false; });
async function logout() {
  if (signingOut.value || auth.accountBusy) return;
  signingOut.value = true;
  try { await auth.logout(); }
  catch { sessionStorage.setItem('wordtrail.logout-notice', 'true'); }
  finally { signingOut.value = false; await router.replace('/login'); }
}
</script>
<template>
  <div :class="['wordory-app', 'compact-copy', { 'is-review': isReview }]">
    <a class="skip-link" href="#main">跳至主要内容</a>
    <header class="site-header app-site-header">
      <BrandMark />
      <nav class="main-nav app-main-nav" aria-label="主导航" :style="{ '--nav-count': nav.length }">
        <span class="nav-indicator" :style="{ transform: `translateX(${activeIndex * 100}%)` }" aria-hidden="true" />
        <RouterLink v-for="(entry, index) in nav" :key="entry.path" :to="entry.path" :aria-label="entry.label" :class="{ active: index === activeIndex }" :aria-current="index === activeIndex ? 'page' : undefined"><span :class="{ 'app-nav-label': entry.label !== entry.shortLabel }">{{ entry.label }}</span><span v-if="entry.label !== entry.shortLabel" class="app-nav-short" aria-hidden="true">{{ entry.shortLabel }}</span></RouterLink>
      </nav>
      <div class="header-actions">
        <button class="round-icon appearance-button" :aria-pressed="isDark" :aria-label="isDark ? '切换浅色主题' : '切换深色主题'" :title="isDark ? '切换浅色主题' : '切换深色主题'" @click="toggleTheme"><Sun v-if="isDark" :size="21" /><Moon v-else :size="21" /></button>
        <button class="profile-button" aria-label="打开账户菜单" @click="profileOpen = true">{{ name.slice(0, 1).toUpperCase() }}</button>
      </div>
    </header>
    <p v-if="mockEnabled" class="live-mode-note" role="status">Mock 演示模式</p>
    <main id="main" :class="['page-stage', { 'practice-stage': isReview, 'review-stage': isReview }]" tabindex="-1">
      <ContentNav v-if="activeIndex === 2" /><RecordNav v-if="activeIndex === 3" />
      <RouterView v-slot="{ Component }"><KeepAlive include="StudyWorkspaceView" :max="1"><component v-if="auth.user" :is="Component" :key="route.meta.workspace ? `workspace:${auth.user?.id}` : `${auth.user?.id}:${route.path}`" /></KeepAlive></RouterView>
    </main>
    <AppDialog v-model="profileOpen" title="我的账户" :description="name">
      <RouterLink to="/settings" class="btn btn-secondary dialog-confirm" @click="profileOpen = false">每日目标设置</RouterLink>
      <RouterLink to="/settings/security" class="btn btn-secondary dialog-confirm" @click="profileOpen = false">账户安全与设备</RouterLink>
      <button class="btn btn-primary dialog-confirm" :disabled="signingOut || auth.accountBusy" @click="logout"><LogOut :size="18" />{{ signingOut ? '正在退出…' : '退出登录' }}</button>
    </AppDialog>
  </div>
</template>
