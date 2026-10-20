<script setup lang="ts">
import {
  BookOpen,
  ChevronRight,
  Leaf,
  LogOut,
  NotebookPen,
  UserRound,
} from "lucide-vue-next";
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { errorMessage, mockEnabled } from "../api/http";
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const accountOpen = ref(false);
const exiting = ref(false);
const nav = [
  { to: "/books", label: "词书", icon: BookOpen },
  { to: "/learning", label: "我的学习", icon: NotebookPen },
];
async function logout() {
  if (exiting.value) return;
  exiting.value = true;
  try {
    await auth.logout();
  } catch (e) {
    sessionStorage.setItem("wordtrail.logout-notice", errorMessage(e));
  } finally {
    await router.replace("/login");
    exiting.value = false;
  }
}
</script>
<template>
  <div class="app-shell">
    <a href="#main" class="skip-link">跳至主要内容</a>
    <aside class="sidebar" aria-label="主导航">
      <RouterLink to="/books" class="brand-mark" aria-label="词序首页"
        ><span>W</span><Leaf :size="19"
      /></RouterLink>
      <nav class="side-links">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :class="['side-link', { active: route.path.startsWith(item.to) }]"
          :aria-current="route.path.startsWith(item.to) ? 'page' : undefined"
          ><component :is="item.icon" :size="23" :stroke-width="1.5" /><span>{{
            item.label
          }}</span></RouterLink
        >
      </nav>
      <div class="side-account">
        <button
          class="avatar"
          aria-label="查看账户"
          :aria-expanded="accountOpen"
          @click="accountOpen = !accountOpen"
        >
          <UserRound :size="20" /></button
        ><button
          class="icon-button"
          aria-label="退出登录"
          :disabled="exiting"
          @click="logout"
        >
          <LogOut :size="18" />
        </button>
      </div>
    </aside>
    <div class="app-body">
      <header class="topbar">
        <RouterLink
          :to="route.path.startsWith('/books') ? '/books' : '/learning'"
          class="module-name"
          >{{ route.meta.title }}</RouterLink
        ><ChevronRight :size="14" class="muted desktop-inline" /><span
          class="topbar-context desktop-inline"
          >{{
            route.params.bookId
              ? "词书详情"
              : route.path.endsWith("/result")
                ? "本轮结果"
                : "WordTrail · 词序"
          }}</span
        >
        <div class="topbar-right">
          <span v-if="mockEnabled" class="demo-badge">演示模式</span
          ><span class="quiet-label desktop-inline">一词一步，循序而行</span
          ><button
            class="avatar mobile-account"
            aria-label="查看账户"
            :aria-expanded="accountOpen"
            @click="accountOpen = !accountOpen"
          >
            <UserRound :size="18" />
          </button>
        </div>
      </header>
      <div v-if="accountOpen" class="account-panel">
        <span class="eyebrow">当前账户</span
        ><strong>{{ auth.user?.nickname || auth.user?.username }}</strong
        ><span class="muted">@{{ auth.user?.username }}</span
        ><button class="text-button" :disabled="exiting" @click="logout">
          <LogOut :size="16" />退出登录</button
        ><button class="text-button" @click="accountOpen = false">关闭</button>
      </div>
      <main id="main" class="page-content">
        <RouterView :key="route.path" />
      </main>
    </div>
    <nav class="bottom-nav" aria-label="主导航">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        :class="{ active: route.path.startsWith(item.to) }"
        ><component :is="item.icon" :size="21" /><span>{{
          item.label
        }}</span></RouterLink
      >
    </nav>
  </div>
</template>
