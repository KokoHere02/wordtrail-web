<script setup lang="ts">
import { ref } from 'vue';
import { RotateCcw } from 'lucide-vue-next';
import { useWeakWords } from '../../composables/useWeakWords';
import type { LearningSource, WeakWord } from '../../types/words';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import WordHistoryDialog from '../../components/learning/WordHistoryDialog.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
import { useWordSentenceCounts } from '../../composables/useWordSentenceCounts';
import WordSentencePractice from '../../components/learning/WordSentencePractice.vue';
const weak = useWeakWords();
const { data, loading, error, source, page, size, selected, count, pageIds, pageSelected } = weak;
const links = useWordSentenceCounts(() => data.value?.records.map(row => row.wordId) || []);
const { counts: sentenceCounts, loading: linksLoading, error: linksError } = links;
const sources: { value: LearningSource; label: string }[] = [{ value: 'DAILY', label: '每日学习' }, { value: 'PRACTICE', label: '历史认读专项' }];
const historyWord = ref<WeakWord>();
const historyOpen = ref(false);
const time = (value: string | null) => value ? value.replace('T', ' ') : '未记录';
</script>
<template>
  <div class="wordlist-page weak-words-page">
    <header class="library-heading"><div><h1>薄弱词</h1></div></header>
    <section class="wordlist-sheet weak-words-sheet">
      <div class="wordlist-tools"><div class="category-tabs" role="group" aria-label="薄弱词来源"><button v-for="entry in sources" :key="entry.value" :class="{ active: source === entry.value }" :aria-pressed="source === entry.value" @click="source = entry.value">{{ entry.label }}</button></div><button class="muted-link" :disabled="loading" @click="weak.refresh"><RotateCcw :size="15" />刷新</button></div>
      <template v-if="data && !loading && !error"><div class="weak-data-scope"><p>仅基于已记录学习事件 · {{ data.source === 'DAILY' ? '每日学习' : '历史认读专项' }}</p><p v-if="data.firstRecordedAt || data.lastRecordedAt">记录范围：{{ time(data.firstRecordedAt) }} — {{ time(data.lastRecordedAt) }}（北京时间）</p><p v-else>暂无已记录的正常作答时间。</p></div><p v-if="!data.statisticsComplete" class="weak-incomplete-notice" role="status">仅基于已记录事件，部分历史缺少记录。{{ data.incompleteWordCount }} 个词的统计不完整；次数仅含保留的正常作答。</p></template>
      <div class="wordlist-selection"><label><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pageIds.some(id => selected.has(id))" :disabled="loading || !pageIds.length" @change="weak.togglePage(pageIds, !pageSelected)" />选择当前页</label><span class="weak-selected-count">已选 {{ count }} 词</span><button class="muted-link" :disabled="!count" @click="weak.clear">清空选择</button></div>
      <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" :message="data?.total === 0 ? '本来源暂无已记录的薄弱词。' : '本页暂无单词，请返回上一页。'" @retry="weak.refresh" />
      <template v-if="!loading && !error"><article v-for="word in data?.records" :key="word.wordId" class="weak-word-row"><label class="weak-word-check"><input type="checkbox" :checked="selected.has(word.wordId)" :aria-label="`选择薄弱词 ${word.word}`" @change="weak.toggle(word.wordId, !selected.has(word.wordId))" /></label><div class="weak-word-copy"><RouterLink :to="`/words/${word.wordId}`" class="weak-word-name" lang="en">{{ word.word }}</RouterLink><span v-if="word.phonetic" class="weak-word-phonetic">{{ word.phonetic }}</span><WordMeaning :translation="word.translation" :translation-groups="word.translationGroups" /><p class="subtle-copy">关联句子：{{ linksLoading ? '读取中…' : linksError ? '暂不可用' : sentenceCounts.get(word.wordId) ?? '未返回' }}<span v-if="!linksLoading && !linksError"> 句</span></p></div><div class="weak-word-feedback"><span class="learning-badge">最近有效测评：{{ word.lastResult === 2 ? '模糊' : '不认识' }}</span><p>本来源累计作答 {{ word.answerCount }} 次</p><p>上次正常作答 {{ time(word.lastAnsweredAt) }}</p><p v-if="!word.statisticsComplete" class="statistics-word-warning">历史记录不完整，反馈仅代表现有事件。</p></div><button class="muted-link" @click="historyWord = word; historyOpen = true">学习历史</button></article></template>
      <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="page = $event" />
    </section>
    <div class="weak-sentence-section"><p v-if="linksLoading" class="subtle-copy" role="status">正在读取本页关联句子数量…</p><p v-if="linksError" class="inline-error" role="alert">关联数量读取失败：{{ linksError }} <button class="muted-link" @click="links.refresh">重试关联数量</button></p><WordSentencePractice :word-ids="[...selected]" :disabled="loading || !!error" /></div>
    <WordHistoryDialog v-model="historyOpen" :word-id="historyWord?.wordId ?? null" :word="historyWord?.word || ''" />
  </div>
</template>
