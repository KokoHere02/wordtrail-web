<script setup lang="ts">
import { computed } from 'vue';
import { BookOpen, CircleAlert, Library, ListChecks, Quote, Star } from 'lucide-vue-next';
import { useRoute } from 'vue-router';

const route = useRoute();
const sentenceSection = computed(() => route.path === '/sentences' || route.path.startsWith('/sentences/'));
const kinds = [
  { path: '/books', label: '单词', icon: BookOpen },
  { path: '/sentences', label: '句子', icon: Quote },
];
const wordTabs = [
  { path: '/books', label: '词书', icon: Library, matches: (path: string) => path === '/books' || path.startsWith('/books/') || path.startsWith('/words/') },
  { path: '/plan', label: '学习计划', icon: ListChecks, matches: (path: string) => path === '/plan' },
  { path: '/weak-words', label: '薄弱词', icon: CircleAlert, matches: (path: string) => path === '/weak-words' },
  { path: '/consolidation/words', label: '错词与错因', icon: CircleAlert, matches: (path: string) => path === '/consolidation/words' },
];
const sentenceTabs = [
  { label: '句子库', scope: undefined, icon: Library },
  { label: '学习列表', scope: 'learning', icon: ListChecks },
  { label: '收藏', scope: 'favorites', icon: Star },
];
</script>
<template>
  <nav :class="['content-library-nav', { 'sentence-library-top': route.path === '/sentences' }]" aria-label="内容库分类">
    <div class="content-library-kinds workspace-shortcuts" role="group" aria-label="内容类型">
      <RouterLink v-for="(entry, index) in kinds" :key="entry.path" :to="entry.path" :class="{ 'is-active': index === 1 ? sentenceSection : !sentenceSection }" :aria-current="(index === 1 ? sentenceSection : !sentenceSection) ? 'location' : undefined"><component :is="entry.icon" :size="16" :stroke-width="1.7" aria-hidden="true" /><span>{{ entry.label }}</span></RouterLink>
    </div>
    <div v-if="!sentenceSection" class="content-library-tools" role="group" aria-label="单词分类">
      <RouterLink v-for="entry in wordTabs" :key="entry.path" :to="entry.path" :class="{ active: entry.matches(route.path) }" :aria-current="entry.matches(route.path) ? 'page' : undefined"><component :is="entry.icon" :size="17" aria-hidden="true" /><span>{{ entry.label }}</span></RouterLink>
    </div>
    <div v-else-if="route.path !== '/sentences'" class="content-library-tools" role="group" aria-label="句子分类">
      <RouterLink v-for="entry in sentenceTabs" :key="entry.label" :to="{ path: '/sentences', query: entry.scope ? { scope: entry.scope } : {} }"><component :is="entry.icon" :size="17" aria-hidden="true" /><span>{{ entry.label }}</span></RouterLink>
    </div>
  </nav>
</template>
<style scoped>
.content-library-nav { width: min(calc(100% - var(--s5) * 2), var(--content-library-width)); margin: var(--s5) auto 0; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); }
.content-library-nav.sentence-library-top { border-bottom: 0; border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
.content-library-kinds { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s2); padding: var(--s2) var(--s3); border-bottom: 1px solid var(--line); }
.content-library-kinds.workspace-shortcuts { margin: 0; }
.content-library-tools { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s1); min-width: 0; padding: var(--s2) var(--s3); }
.content-library-tools a { display: inline-flex; align-items: center; justify-content: center; gap: var(--s2); min-height: var(--control); padding: var(--s2) var(--s4); border-radius: var(--radius-sm); color: var(--muted); font-size: var(--text-base); white-space: nowrap; transition: color var(--motion-fast), background var(--motion-fast); }
.content-library-tools a:hover { color: var(--ink); background: var(--hover); }
.content-library-tools a.active { color: var(--accent-strong); background: var(--sage); font-weight: 600; }
.content-library-tools a:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 3px; }
.content-library-nav svg { flex-shrink: 0; }
.sentence-library-top .content-library-kinds { border-bottom: 0; }
@media (max-width: 760px) {
  .content-library-tools { gap: var(--s1); }
  .content-library-tools a { padding-inline: var(--s2); font-size: var(--text-sm); }
}
</style>
