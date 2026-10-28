<script setup lang="ts">
import { BookOpen, CircleAlert, ListChecks, Quote } from 'lucide-vue-next';
import { useRoute } from 'vue-router';
const route = useRoute();
const kinds = [
  { path: '/books', label: '单词', icon: BookOpen, matches: (path: string) => path === '/books' || path.startsWith('/books/') || path.startsWith('/words/') },
  { path: '/sentences', label: '句子', icon: Quote, matches: (path: string) => path === '/sentences' || path.startsWith('/sentences/') },
];
const tools = [
  { path: '/plan', label: '学习计划', icon: ListChecks },
  { path: '/weak-words', label: '薄弱词', icon: CircleAlert },
];
</script>
<template>
  <nav class="content-library-nav" aria-label="内容库分类">
    <div class="content-library-kinds workspace-shortcuts" role="group" aria-label="内容类型">
      <RouterLink v-for="entry in kinds" :key="entry.path" :to="entry.path" :class="{ active: entry.matches(route.path), 'is-active': entry.matches(route.path) }" :aria-current="entry.matches(route.path) ? 'page' : undefined"><component :is="entry.icon" :size="16" :stroke-width="1.7" aria-hidden="true" /><span>{{ entry.label }}</span></RouterLink>
    </div>
    <div class="content-library-tools" role="group" aria-label="单词学习管理">
      <RouterLink v-for="entry in tools" :key="entry.path" :to="entry.path" :class="{ active: route.path === entry.path }" :aria-current="route.path === entry.path ? 'page' : undefined"><component :is="entry.icon" :size="17" aria-hidden="true" /><span>{{ entry.label }}</span></RouterLink>
    </div>
  </nav>
</template>
<style scoped>
.content-library-nav { display: flex; align-items: center; gap: var(--s5); width: min(calc(100% - var(--s5) * 2), 1120px); margin: var(--s5) auto 0; }
.content-library-kinds, .content-library-tools { display: flex; align-items: center; gap: var(--s2); min-width: 0; }
.content-library-kinds.workspace-shortcuts { margin: 0; }
.content-library-tools { padding-left: var(--s5); border-left: 1px solid var(--line); }
.content-library-tools a { display: inline-flex; align-items: center; justify-content: center; gap: var(--s2); min-height: var(--control); padding: var(--s2) var(--s4); border-radius: var(--radius-sm); color: var(--muted); font-size: var(--text-base); white-space: nowrap; transition: color var(--motion-fast), background var(--motion-fast); }
.content-library-tools a:hover { color: var(--ink); background: var(--hover); }
.content-library-tools a.active { color: var(--accent-strong); background: var(--sage); font-weight: 600; }
.content-library-tools a:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 3px; }
.content-library-nav svg { flex-shrink: 0; }
@media (max-width: 760px) {
  .content-library-nav { flex-direction: column; align-items: stretch; gap: var(--s2); }
  .content-library-kinds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .content-library-tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-left: 0; border-top: 1px solid var(--line); padding: var(--s2) 0 0; gap: var(--s1); }
  .content-library-tools a { padding-inline: var(--s1); font-size: var(--text-sm); }
  .content-library-tools svg { display: none; }
}
</style>
