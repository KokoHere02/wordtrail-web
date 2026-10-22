<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-vue-next';
import { useBookContents } from '../../composables/useBookContents';
import type { BookWordsChange, BookWord, LearningStatus } from '../../types/api';
import BookCover from '../../components/word/BookCover.vue';
import BookProgress from '../../components/word/BookProgress.vue';
import BookEditorDialog from '../../components/word/BookEditorDialog.vue';
import DictionaryCollector from '../../components/word/DictionaryCollector.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import AppDialog from '../../components/ui/AppDialog.vue';
import AppButton from '../../components/ui/AppButton.vue';
import SearchField from '../../components/ui/SearchField.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import WordHistoryDialog from '../../components/learning/WordHistoryDialog.vue';
const id = Number(useRoute().params.bookId);
const contents = useBookContents(id);
const { book, bookLoading, bookError, data, loading, error, selection, keyword, filter, page, size, busy, available, editable, saveError, notice, practiceCount, pageIds, pageSelected } = contents;
const filters: { value: LearningStatus; label: string }[] = [{ value: 'ALL', label: '全部' }, { value: 'UNLEARNED', label: '未学' }, { value: 'LEARNED', label: '已开始' }];
const historyWord = ref<BookWord>();
const historyOpen = ref(false);
const editorOpen = ref(false);
const collectorOpen = ref(false);
const removeOpen = ref(false);
async function collected(result: BookWordsChange) {
  notice.value = `收录 ${result.changedCount} 词 · 已有 ${result.unchangedCount} 词。`;
  await contents.reload();
}
async function remove() { if (await contents.remove()) removeOpen.value = false; }
onMounted(contents.reload);
</script>
<template>
  <div class="wordlist-page">
    <RouterLink to="/books" class="muted-link back-to-library"><ArrowLeft :size="17" />返回词库</RouterLink>
    <StatePanel :loading="bookLoading" :error="bookError" @retry="contents.loadBook" />
    <header v-if="book" class="wordlist-heading"><BookCover :label="book.name" /><div class="book-detail-copy"><span class="subtle-copy">{{ book.bookType === 'PERSONAL' ? '个人词本' : '系统词书' }}</span><h1>{{ book.name }}</h1><p v-if="book.description">{{ book.description }}</p><span class="subtle-copy">{{ book.wordCount.toLocaleString() }} 词</span><BookProgress :book="book" /></div><div class="live-actions"><template v-if="editable"><AppButton variant="secondary" :disabled="busy" @click="editorOpen = true">编辑词本</AppButton><AppButton :disabled="busy" @click="collectorOpen = true"><Plus :size="18" />搜索收词</AppButton></template><RouterLink to="/plan" class="btn btn-secondary">我的学习计划</RouterLink></div></header>
    <section class="wordlist-sheet">
      <div class="wordlist-tools">
        <div class="category-tabs" role="group" aria-label="单词学习状态"><button v-for="entry in filters" :key="entry.value" :class="{ active: filter === entry.value }" :aria-pressed="filter === entry.value" :disabled="busy" @click="filter = entry.value">{{ entry.label }}</button></div>
        <form class="library-search" role="search" @submit.prevent="contents.search"><SearchField v-model="keyword" label="搜索单词" placeholder="寻找一个单词" :disabled="busy" :maxlength="255" /><button class="violet-link" type="submit" :disabled="busy">搜索</button></form>
      </div>
      <div class="wordlist-selection"><label><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pageIds.some(wordId => selection.selected.value.has(wordId))" :disabled="loading || busy || !available || !pageIds.length" @change="selection.togglePage(pageIds, !pageSelected)" />选择当前页</label><span class="selected-count">已选 {{ selection.count.value }} 词</span><button class="muted-link" :disabled="busy || !selection.count.value" @click="selection.clear">清空选择</button><button v-if="editable" class="muted-link" :disabled="busy || loading || !selection.count.value || selection.count.value > 100" @click="saveError = ''; removeOpen = true">移出所选</button></div>
      <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" :message="book?.editable && book.wordCount === 0 ? '词本还是空的，点击搜索收词。' : '没有找到符合条件的单词。'" @retry="contents.refresh" />
      <template v-if="!loading && !error"><div v-for="word in data?.records" :key="word.id" class="preview-word-row"><label><input type="checkbox" :checked="selection.selected.value.has(word.id)" :disabled="busy || !available" :aria-label="`选择 ${word.word}`" @change="selection.toggle(word.id, !selection.selected.value.has(word.id))" /><span><strong lang="en">{{ word.word }}</strong><small>{{ word.phonetic }}</small></span></label><p>{{ word.translation || '暂无释义' }}</p><span :class="['word-selected-state', { added: word.learned }]">{{ word.learned ? '已开始' : '未学' }}<button class="muted-link" @click="historyWord = word; historyOpen = true">学习历史</button></span></div></template>
      <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading || busy" @change="page = $event" />
    </section>
    <p v-if="notice" class="live-notice" role="status">{{ notice }}</p><p v-if="saveError" class="inline-error" role="alert">{{ saveError }}</p>
    <div class="wordlist-bottom"><span>{{ selection.count.value > 100 ? '每批最多 100 词，请减少选择。' : '跨页保留 · 每批最多 100 词' }}</span><button class="btn btn-primary" :disabled="busy || loading || !available || !selection.count.value || selection.count.value > 100" @click="contents.join">{{ busy ? '正在提交…' : '加入学习计划' }}<ArrowRight :size="18" /></button></div>
    <details class="live-practice-options"><summary>专项练习</summary><p class="subtle-copy">不影响每日学习进度。</p><div class="live-actions"><button class="btn btn-secondary" :disabled="busy || !available || !selection.count.value || selection.count.value > 100" @click="contents.practice(true)">练习已选 {{ selection.count.value }} 词</button><label for="practice-count">本轮数量</label><input id="practice-count" v-model.number="practiceCount" type="number" min="1" max="100" :disabled="busy" /><button class="btn btn-secondary" :disabled="busy || !available" @click="contents.practice(false)">按词书开始练习</button></div></details>
    <BookEditorDialog v-if="book" v-model="editorOpen" :book="book" @saved="contents.loadBook" @unavailable="contents.loadBook" />
    <DictionaryCollector v-if="collectorOpen && book" v-model="collectorOpen" :book-id="id" @changed="collected" @unavailable="contents.loadBook" />
    <AppDialog :model-value="removeOpen" title="移出词本？" :description="`移出所选 ${selection.count.value} 词，学习计划与历史保留。`" @update:model-value="value => { if (!busy) removeOpen = value; }"><p v-if="saveError" class="inline-error" role="alert">{{ saveError }}</p><div class="live-actions"><AppButton :busy="busy" :disabled="!editable" @click="remove">确认移出词本</AppButton><AppButton variant="secondary" :disabled="busy" @click="removeOpen = false">取消</AppButton></div></AppDialog>
    <WordHistoryDialog v-model="historyOpen" :word-id="historyWord?.id ?? null" :word="historyWord?.word || ''" />
  </div>
</template>
