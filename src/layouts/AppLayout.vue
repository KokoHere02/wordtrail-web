<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LogOut, Moon, Settings, ShieldCheck, Sun } from 'lucide-vue-next';
import BrandMark from '../components/ui/BrandMark.vue';
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
const name = computed(() => auth.user?.nickname || (auth.user?.phone ? auth.user.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : auth.user?.email || auth.user?.username) || '');
const nav = [
  { label: '今日', shortLabel: '今日', path: '/today' },
  { label: '学习', shortLabel: '学习', path: '/learn' },
  { label: '内容库', shortLabel: '内容库', path: '/books' },
  { label: '记录', shortLabel: '记录', path: '/records' },
];
const activeIndex = computed(() => {
  const path = route.path;
  if (path.startsWith('/settings')) return -1;
  if (route.meta.workspace) return 1;
  if (path.startsWith('/records') || path.startsWith('/learning') || path === '/statistics' || path === '/sentences/records' || path === '/sentences/statistics' || path.includes('/result')) return 3;
  if (path.startsWith('/books') || path.startsWith('/words/') || path.startsWith('/sentences') || path === '/weak-words' || path === '/consolidation/words' || path === '/plan' || path === '/dictation/mistakes') return 2;
  return path === '/today' ? 0 : 1;
});
const isReview = computed(() => route.path === '/learn' || route.path === '/consolidation' || route.path.startsWith('/learn/') || route.path.startsWith('/consolidation/study/') || route.path.startsWith('/follow-typing') || /^\/dictation\/\d+$/.test(route.path) || /^\/sentences\/sessions\/\d+$/.test(route.path));
watch(() => route.path, () => { profileOpen.value = false; });
async function logout() {
  if (signingOut.value || auth.accountBusy) return;
  signingOut.value = true;
  try { await auth.logout(); }
  catch { sessionStorage.setItem('wordtrail.logout-notice', 'true'); }
  finally { signingOut.value = false; await router.replace('/login'); }
}
function closeProfileOnBlur(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) profileOpen.value = false;
}
</script>
<template>
  <div :class="['wordory-app', 'compact-copy', { 'is-review': isReview }]">
    <a class="skip-link" href="#main">跳至主要内容</a>
    <header class="site-header app-site-header">
      <BrandMark />
      <nav class="main-nav app-main-nav" aria-label="主导航" :style="{ '--nav-count': nav.length }">
        <span v-if="activeIndex >= 0" class="nav-indicator" :style="{ transform: `translateX(${activeIndex * 100}%)` }" aria-hidden="true" />
        <RouterLink v-for="(entry, index) in nav" :key="entry.path" :to="entry.path" :aria-label="entry.label" :class="{ active: index === activeIndex }" :aria-current="index === activeIndex ? 'page' : undefined"><span :class="{ 'app-nav-label': entry.label !== entry.shortLabel }">{{ entry.label }}</span><span v-if="entry.label !== entry.shortLabel" class="app-nav-short" aria-hidden="true">{{ entry.shortLabel }}</span></RouterLink>
      </nav>
      <div class="header-actions">
        <button class="round-icon appearance-button" :aria-pressed="isDark" :aria-label="isDark ? '切换浅色主题' : '切换深色主题'" :title="isDark ? '切换浅色主题' : '切换深色主题'" @click="toggleTheme"><Sun v-if="isDark" :size="21" /><Moon v-else :size="21" /></button>
        <RouterLink to="/settings" class="round-icon settings-link" aria-label="学习设置" title="学习设置" :aria-current="route.path.startsWith('/settings') ? 'page' : undefined"><Settings :size="21" aria-hidden="true" /></RouterLink>
        <div class="account-dropdown" @mouseenter="profileOpen = true" @mouseleave="profileOpen = false" @focusin="profileOpen = true" @focusout="closeProfileOnBlur" @keydown.esc="profileOpen = false">
          <button class="profile-button" type="button" aria-label="账户菜单" aria-controls="account-dropdown-menu" :aria-expanded="profileOpen" @click="profileOpen = true">{{ name.slice(0, 1).toUpperCase() }}</button>
          <Transition name="account-dropdown">
            <div v-show="profileOpen" id="account-dropdown-menu" class="account-dropdown-panel">
              <div class="account-dropdown-heading"><span class="account-dropdown-caption">我的账户</span><strong>{{ name }}</strong></div>
              <RouterLink to="/settings/security" class="account-dropdown-item" @click="profileOpen = false"><ShieldCheck :size="18" aria-hidden="true" />账户安全与设备</RouterLink>
              <button class="account-dropdown-item account-dropdown-logout" type="button" :disabled="signingOut || auth.accountBusy" @click="logout"><LogOut :size="18" aria-hidden="true" />{{ signingOut ? '正在退出…' : '退出登录' }}</button>
            </div>
          </Transition>
        </div>
      </div>
    </header>
    <p v-if="mockEnabled" class="live-mode-note" role="status">Mock 演示模式</p>
    <main id="main" :class="['page-stage', { 'practice-stage': isReview, 'review-stage': isReview }]" tabindex="-1">
      <ContentNav v-if="activeIndex === 2" /><RecordNav v-if="activeIndex === 3" />
      <RouterView v-slot="{ Component }"><KeepAlive include="StudyWorkspaceView" :max="1"><component v-if="auth.user" :is="Component" :key="route.meta.workspace ? `workspace:${auth.user?.id}` : `${auth.user?.id}:${route.path}`" /></KeepAlive></RouterView>
    </main>
  </div>
</template>

<style scoped>
.account-dropdown { position: relative; }
.account-dropdown-panel { position: absolute; z-index: 100; top: 100%; right: 0; width: 220px; padding: 12px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); box-shadow: 0 12px 32px rgb(0 0 0 / 14%); transform-origin: top right; }
.account-dropdown-heading { display: grid; gap: 5px; padding: 6px 10px 14px; margin-bottom: 6px; border-bottom: 1px solid var(--line); }
.account-dropdown-heading strong { overflow: hidden; color: var(--ink); text-overflow: ellipsis; white-space: nowrap; }
.account-dropdown-caption { color: var(--muted); font-size: 12px; }
.account-dropdown-item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 42px; padding: 0 10px; border: 0; border-radius: 9px; background: transparent; color: var(--ink); font-size: 14px; text-align: left; text-decoration: none; cursor: pointer; }
.account-dropdown-item:hover, .account-dropdown-item:focus-visible { background: var(--sage); }
.account-dropdown-item:disabled { opacity: .55; cursor: wait; }
.account-dropdown-logout { color: var(--muted); }
.account-dropdown-enter-active, .account-dropdown-leave-active { transition: opacity .18s ease, transform .18s ease; }
.account-dropdown-enter-from, .account-dropdown-leave-to { opacity: 0; transform: translateY(-8px); }
@media (prefers-reduced-motion: reduce) { .account-dropdown-enter-active, .account-dropdown-leave-active { transition: none; } }
</style>
