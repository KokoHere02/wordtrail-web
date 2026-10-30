<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
const statistics = computed(() => route.path === '/statistics' || route.path === '/sentences/statistics');
</script>
<template>
  <div class="record-navigation">
    <nav class="section-hub-nav" aria-label="记录中心">
      <RouterLink to="/records" :class="{ active: !statistics }" :aria-current="!statistics ? 'page' : undefined">学习记录</RouterLink>
      <RouterLink to="/statistics" :class="{ active: statistics }" :aria-current="statistics ? 'page' : undefined">学习统计</RouterLink>
    </nav>
    <nav v-if="statistics" class="record-stat-nav" aria-label="统计类型">
      <RouterLink to="/statistics" :class="{ active: route.path === '/statistics' }">单词统计</RouterLink>
      <RouterLink to="/sentences/statistics" :class="{ active: route.path === '/sentences/statistics' }">句子统计</RouterLink>
    </nav>
  </div>
</template>
<style scoped>
.section-hub-nav { gap: var(--s8); }
.section-hub-nav > a { padding-inline: var(--s2); letter-spacing: .08em; }
.record-stat-nav { display: flex; gap: var(--s2); width: min(calc(100% - var(--s5) * 2), var(--content-library-width)); margin: var(--s4) auto 0; }
.record-stat-nav a { padding: var(--s2) var(--s4); border-radius: var(--radius-pill); color: var(--muted); }
.record-stat-nav a.active { background: var(--sage); color: var(--accent-strong); }
</style>
