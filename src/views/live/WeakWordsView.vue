<script setup lang="ts">
import { computed, ref } from 'vue';
import { RotateCcw } from 'lucide-vue-next';
import { useWeakWords } from '../../composables/useWeakWords';
import type { WeakWord } from '../../types/words';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import WordHistoryDialog from '../../components/learning/WordHistoryDialog.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
import AppButton from '../../components/ui/AppButton.vue';
import DictationLaunchNotice from '../../components/learning/DictationLaunchNotice.vue';
import { useDictationLaunch } from '../../composables/useDictationLaunch';
const weak = useWeakWords();
const { data, loading, error, page, size, selected, count, pageIds, pageSelected } = weak;
const creation = useDictationLaunch();
const { busy, uncertain, created, error: createError } = creation;
const locked = computed(() => busy.value || uncertain.value || !!created.value);
async function start() {
  if (locked.value || loading.value || error.value || count.value < 1 || count.value > 100) return;
  await creation.launch({ source: 'PLAN', wordIds: [...selected.value] });
}
const historyWord = ref<WeakWord>();
const historyOpen = ref(false);
const time = (value: string | null) => value ? value.replace('T', ' ') : '未记录';
</script>
<template>
  <div class="wordlist-page weak-words-page" aria-label="每日学习薄弱词">
    <section class="wordlist-sheet weak-words-sheet">
      <div class="weak-toolbar" aria-label="选词与默写">
        <div class="weak-selection"><label><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pageIds.some(id => selected.has(id))" :disabled="locked || loading || !!error || !pageIds.length" @change="weak.togglePage(pageIds, !pageSelected)" />选择当前页</label><span class="weak-selected-count" aria-live="polite">已选 {{ count }} 词</span><button class="muted-link" :disabled="locked || !count" @click="weak.clear">清空选择</button></div>
        <div class="weak-toolbar-actions"><button class="muted-link" :disabled="loading || locked" @click="weak.refresh"><RotateCcw :size="15" />刷新</button><AppButton :busy="busy" :disabled="locked || loading || !!error || !count || count > 100" @click="start">默写所选</AppButton></div>
      </div>
      <p v-if="count > 100" class="inline-error" role="alert">每次最多选择 100 个单词。</p>
      <DictationLaunchNotice :error="createError" :uncertain="uncertain" :batch-id="created?.batchId" @refresh="$router.push('/dictation#dictation-tasks')" />
      <p v-if="data && !loading && !error && !data.statisticsComplete" class="weak-incomplete-notice" role="status">{{ data.incompleteWordCount }} 个词的历史记录不完整，统计仅供参考。</p>
      <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" :message="data?.total === 0 ? '暂无薄弱词。' : '本页暂无单词，请返回上一页。'" @retry="weak.refresh" />
      <template v-if="!loading && !error"><article v-for="word in data?.records" :key="word.wordId" :class="['weak-word-row', { 'is-selected': selected.has(word.wordId) }]"><label class="weak-word-check"><input type="checkbox" :checked="selected.has(word.wordId)" :disabled="locked || (!selected.has(word.wordId) && count >= 100)" :aria-label="`选择薄弱词 ${word.word}`" @change="weak.toggle(word.wordId, !selected.has(word.wordId))" /></label><div class="weak-word-copy"><RouterLink :to="`/words/${word.wordId}`" class="weak-word-name" lang="en">{{ word.word }}</RouterLink><span v-if="word.phonetic" class="weak-word-phonetic">{{ word.phonetic }}</span><WordMeaning :translation="word.translation" :translation-groups="word.translationGroups" /></div><div class="weak-word-feedback"><span class="learning-badge">最近自评：{{ word.lastResult === 2 ? '模糊' : '不认识' }}</span><p>累计作答 {{ word.answerCount }} 次</p><p>上次练习 {{ time(word.lastAnsweredAt) }}</p><p v-if="!word.statisticsComplete" class="statistics-word-warning">历史记录不完整，反馈仅代表现有事件。</p></div><button class="muted-link" @click="historyWord = word; historyOpen = true">学习历史</button></article></template>
      <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading || locked" @change="page = $event" />
    </section>
    <WordHistoryDialog v-model="historyOpen" :word-id="historyWord?.wordId ?? null" :word="historyWord?.word || ''" />
  </div>
</template>
