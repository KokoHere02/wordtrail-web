<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LogOut, Moon, Sun } from 'lucide-vue-next';
import BrandMark from '../components/ui/BrandMark.vue';
import AppDialog from '../components/ui/AppDialog.vue';
import { useAuthStore } from '../stores/auth';
import { mockEnabled } from '../api/http';
import { useTheme } from '../composables/useTheme';
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const profileOpen = ref(false);
const { isDark, toggleTheme } = useTheme();
const signingOut = ref(false);
const name = computed(() => auth.user?.nickname || auth.user?.username || '');
const nav = [{ label: '今日', path: '/today' }, { label: '学习', path: '/learn' }, { label: '词库', path: '/books' }, { label: '记录', path: '/records' }];
const activeIndex = computed(() => route.path.startsWith('/books') ? 2 : route.path.startsWith('/records') || route.path.startsWith('/learning') || route.path === '/statistics' ? 3 : route.path === '/today' || route.path === '/settings' ? 0 : 1);
watch(() => route.path, () => { profileOpen.value = false; });
async function logout() {
  if (signingOut.value) return;
  signingOut.value = true;
  try { await auth.logout(); }
  catch { sessionStorage.setItem('wordtrail.logout-notice', 'true'); }
  finally { signingOut.value = false; await router.replace('/login'); }
}
</script>
<template>
  <div class="wordory-app compact-copy">
    <a class="skip-link" href="#main">跳至主要内容</a>
    <header class="site-header">
      <BrandMark />
      <nav class="main-nav" aria-label="主导航">
        <span class="nav-indicator" :style="{ transform: `translateX(${activeIndex * 100}%)` }" aria-hidden="true" />
        <RouterLink v-for="(entry, index) in nav" :key="entry.path" :to="entry.path" :class="{ active: index === activeIndex }" :aria-current="index === activeIndex ? 'page' : undefined">{{ entry.label }}</RouterLink>
      </nav>
      <div class="header-actions">
        <button class="round-icon appearance-button" :aria-pressed="isDark" :aria-label="isDark ? '切换浅色主题' : '切换深色主题'" :title="isDark ? '切换浅色主题' : '切换深色主题'" @click="toggleTheme"><Sun v-if="isDark" :size="21" /><Moon v-else :size="21" /></button>
        <button class="profile-button" aria-label="打开账户菜单" @click="profileOpen = true">{{ name.slice(0, 1).toUpperCase() }}</button>
      </div>
    </header>
    <p v-if="mockEnabled" class="live-mode-note" role="status">Mock 演示模式</p>
    <main id="main" :class="['page-stage', { 'practice-stage': route.path.startsWith('/learn') && !route.path.startsWith('/learning') }]" tabindex="-1">
      <RouterView v-slot="{ Component }"><Transition name="page" mode="out-in"><component :is="Component" :key="route.path" /></Transition></RouterView>
    </main>
    <AppDialog v-model="profileOpen" title="我的账户" :description="name">
      <RouterLink to="/plan" class="btn btn-secondary dialog-confirm" @click="profileOpen = false">管理长期学习计划</RouterLink>
      <RouterLink to="/settings" class="btn btn-secondary dialog-confirm" @click="profileOpen = false">每日目标设置</RouterLink>
      <RouterLink to="/statistics" class="btn btn-secondary dialog-confirm" @click="profileOpen = false">学习统计与日历</RouterLink>
      <button class="btn btn-primary dialog-confirm" :disabled="signingOut" @click="logout"><LogOut :size="18" />{{ signingOut ? '正在退出…' : '退出登录' }}</button>
    </AppDialog>
  </div>
</template>
