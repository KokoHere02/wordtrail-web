<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ArrowRight, Search } from 'lucide-vue-next';
import { api } from '../../api';
import { dailyApi } from '../../api/daily';
import { errorMessage } from '../../api/http';
import { useBooksStore } from '../../stores/books';
import { useResource } from '../../composables/useResource';
import { useSelection } from '../../composables/useSelection';
import type { Book, BookWord, Page, LearningStatus } from '../../types/api';
import BookCover from '../../components/word/BookCover.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import WordHistoryDialog from '../../components/learning/WordHistoryDialog.vue';
const historyWord = ref<BookWord>();
const historyOpen = ref(false);
const id = Number(useRoute().params.bookId);
const router = useRouter();
const book = ref<Book>();
const bookError = ref('');
const keyword = ref('');
const appliedKeyword = ref('');
const filter = ref<LearningStatus>('ALL');
const filters: { value: LearningStatus; label: string }[] = [{ value: 'ALL', label: '全部' }, { value: 'UNLEARNED', label: '未学' }, { value: 'LEARNED', label: '已学' }];
const page = ref(1);
const size = 10;
const selection = useSelection();
const { data, loading, error, load } = useResource<Page<BookWord>>();
const busy = ref(false);
const saveError = ref('');
const notice = ref('');
const practiceCount = ref(20);
const pageIds = computed(() => data.value?.records.map(w => w.id) || []);
const pageSelected = computed(() => pageIds.value.length > 0 && pageIds.value.every(id => selection.selected.value.has(id)));
const refresh = () => load(() => api.words(id, { page: page.value, size, keyword: appliedKeyword.value || undefined, learningStatus: filter.value }));
async function loadBook() { bookError.value = ''; try { book.value = await useBooksStore().find(id); } catch (e) { bookError.value = errorMessage(e); } }
function search() { appliedKeyword.value = keyword.value.trim(); if (page.value !== 1) page.value = 1; else void refresh(); }
watch(filter, () => { if (page.value !== 1) page.value = 1; else void refresh(); });
watch(page, refresh);
onMounted(() => { void loadBook(); void refresh(); });
async function join() {
  if (busy.value || !selection.count.value || selection.count.value > 100) return;
  busy.value = true; saveError.value = ''; notice.value = '';
  try {
    const result = await dailyApi.join(id, [...selection.selected.value]);
    notice.value = `新增 ${result.addedCount} 词，恢复 ${result.reactivatedCount} 词，已在计划中 ${result.unchangedCount} 词。新增词不追加到已生成的今日任务；恢复可还原进行中任务的原明细，已结束任务不重开。`;
    selection.clear();
  } catch (e) { saveError.value = errorMessage(e); }
  finally { busy.value = false; }
}
async function practice(manual: boolean) {
  if (busy.value || (manual && (!selection.count.value || selection.count.value > 100))) return;
  if (!manual && (!Number.isInteger(practiceCount.value) || practiceCount.value < 1 || practiceCount.value > 100)) { saveError.value = '本轮数量须为 1～100 的整数。'; return; }
  busy.value = true; saveError.value = '';
  try {
    const created = await api.create(manual ? { bookId: id, selectionType: 'MANUAL', wordIds: [...selection.selected.value] } : { bookId: id, selectionType: 'BOOK', count: practiceCount.value });
    await router.push(`/study/${created.batchId}`);
  } catch (e) { saveError.value = errorMessage(e); }
  finally { busy.value = false; }
}
</script>
<template>
  <div class="wordlist-page">
    <RouterLink to="/books" class="muted-link back-to-library"><ArrowLeft :size="17" />返回词库</RouterLink>
    <StatePanel :error="bookError" @retry="loadBook" />
    <header class="wordlist-heading"><BookCover :label="book?.name || '词书'" /><div><p class="overline">YOUR WORD COLLECTION</p><h1>{{ book?.name || '词书词表' }}</h1><p>{{ book?.description }}</p><span class="subtle-copy">{{ book ? `${book.wordCount.toLocaleString()} 词` : '正在读取词书信息…' }}</span></div><RouterLink to="/plan" class="btn btn-secondary">我的学习计划</RouterLink></header>
    <section class="wordlist-sheet">
      <div class="wordlist-tools">
        <div class="category-tabs" role="group" aria-label="单词学习状态"><button v-for="entry in filters" :key="entry.value" :class="{ active: filter === entry.value }" :aria-pressed="filter === entry.value" :disabled="busy" @click="filter = entry.value">{{ entry.label }}</button></div>
        <form class="library-search" role="search" @submit.prevent="search"><Search :size="19" /><input v-model="keyword" type="search" placeholder="寻找一个单词" aria-label="搜索单词" :disabled="busy" /><button class="violet-link" type="submit" :disabled="busy">搜索</button></form>
      </div>
      <div class="wordlist-selection"><label><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pageIds.some(id => selection.selected.value.has(id))" :disabled="loading || busy || !pageIds.length" @change="selection.togglePage(pageIds, !pageSelected)" />选择当前页</label><span class="selected-count">已选 {{ selection.count.value }} 词</span><button class="muted-link" :disabled="busy || !selection.count.value" @click="selection.clear">清空选择</button></div>
      <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" message="没有找到符合条件的单词。" @retry="refresh" />
      <template v-if="!loading && !error"><div v-for="word in data?.records" :key="word.id" class="preview-word-row"><label><input type="checkbox" :checked="selection.selected.value.has(word.id)" :disabled="busy" :aria-label="`选择 ${word.word}`" @change="selection.toggle(word.id, !selection.selected.value.has(word.id))" /><span><strong lang="en">{{ word.word }}</strong><small>{{ word.phonetic }}</small></span></label><p>{{ word.translation || '暂无释义' }}</p><span :class="['word-selected-state', { added: word.learned }]">{{ word.learned ? '已学' : '未学' }}<button class="muted-link" @click="historyWord = word; historyOpen = true">学习历史</button></span></div></template>
      <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading || busy" @change="page = $event" />
    </section>
    <p v-if="notice" class="live-notice" role="status">{{ notice }}</p><p v-if="saveError" class="inline-error" role="alert">{{ saveError }}</p>
    <div class="wordlist-bottom"><span>{{ selection.count.value > 100 ? '每次最多加入 100 词，请减少选择。' : '选择会跨页保留；每次最多加入 100 词。' }}</span><button class="btn btn-primary" :disabled="busy || !selection.count.value || selection.count.value > 100" @click="join">{{ busy ? '正在提交…' : '加入学习计划' }}<ArrowRight :size="18" /></button></div>
    <details class="live-practice-options"><summary>专项练习</summary><p class="subtle-copy">独立练习，不更新长期计划的复习进度。</p><div class="live-actions"><button class="btn btn-secondary" :disabled="busy || !selection.count.value || selection.count.value > 100" @click="practice(true)">练习已选 {{ selection.count.value }} 词</button><label for="practice-count">本轮数量</label><input id="practice-count" v-model.number="practiceCount" type="number" min="1" max="100" :disabled="busy" /><button class="btn btn-secondary" :disabled="busy" @click="practice(false)">按词书开始练习</button></div></details>
    <WordHistoryDialog v-model="historyOpen" :word-id="historyWord?.id ?? null" :word="historyWord?.word || ''" />
  </div>
</template>
