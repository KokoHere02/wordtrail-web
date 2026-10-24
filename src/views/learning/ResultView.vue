<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-vue-next";
import { api } from "../../api";
import { ApiError } from "../../api/http";
import { usePracticeLaunch } from '../../composables/usePracticeLaunch';
import PracticeLaunchNotice from '../../components/learning/PracticeLaunchNotice.vue';
import { useResource } from "../../composables/useResource";
import type { Page, Result, RoundResult, RoundWord } from "../../types/api";
import AppButton from "../../components/ui/AppButton.vue";
import AppPagination from "../../components/ui/AppPagination.vue";
import StatePanel from "../../components/ui/StatePanel.vue";
import WordMeaning from '../../components/word/WordMeaning.vue';
const id = Number(useRoute().params.batchId);
const summary = useResource<RoundResult>();
const words = useResource<Page<RoundWord>>();
const filter = ref<Result | undefined>();
const page = ref(1);
const size = 10;
const creation = usePracticeLaunch(async error => {
  if (error instanceof ApiError && error.code === 'NO_RELEARN_WORDS') {
    await Promise.all([summary.load(() => api.result(id)), words.load(() => api.resultWords(id, { page: page.value, size, ...(filter.value ? { result: filter.value } : {}) }))]);
  }
});
const { busy, error, uncertain, created } = creation;
const filters: { value: Result | undefined; label: string }[] = [
  { value: undefined, label: "全部" },
  { value: 1, label: "认识" },
  { value: 2, label: "不确定" },
  { value: 3, label: "不认识" },
];
const labels = { 1: "认识", 2: "不确定", 3: "不认识" };
function loadWords() {
  void words.load(() =>
    api.resultWords(id, {
      page: page.value,
      size,
      ...(filter.value ? { result: filter.value } : {}),
    }),
  );
}
function loadSummary() {
  void summary.load(() => api.result(id));
}
watch(filter, () => {
  page.value = 1;
  loadWords();
});
onMounted(() => {
  loadSummary();
  loadWords();
});
function changePage(value: number) {
  page.value = value;
  loadWords();
}
async function relearn() {
  if (summary.loading.value || summary.error.value || !summary.data.value?.relearnCount) return;
  await creation.launch(() => api.relearn(id));
}
</script>
<template>
  <div class="wordlist-page practice-result-page">
  <RouterLink to="/learning" class="back-link"
    ><ArrowLeft :size="15" />我的学习</RouterLink
  ><StatePanel
    :loading="summary.loading.value"
    :error="summary.error.value"
    @retry="loadSummary"
  /><template v-if="summary.data.value && !summary.loading.value && !summary.error.value"
    ><section class="round-heading">
      <div class="round-check"><Check :size="23" :stroke-width="1.5" /></div>
      <h1>本轮已完成</h1>
      <p>{{ summary.data.value.bookName || (summary.data.value.bookId === null ? '跨词本专项' : '词书专项') }}</p>
    </section>
    <section class="result-stats" aria-label="本轮认识专项统计">
      <div class="result-stat">
        <strong>{{ summary.data.value.totalCount }}</strong
        ><span>不同词数</span>
      </div>
      <div class="result-stat">
        <strong>{{ summary.data.value.completedCount ?? '—' }}</strong
        ><span>完成词数</span>
      </div>
      <div class="result-stat">
        <strong>{{ summary.data.value.answerCount ?? '—' }}</strong
        ><span>已记录作答次数</span>
      </div>
      <div class="result-stat">
        <strong>{{ summary.data.value.unfamiliarCount ?? '—' }}</strong
        ><span>仍不熟悉词数</span>
      </div>
    </section>
    <div class="result-self-reports" aria-label="本轮最终自评"><span>认识 {{ summary.data.value.knownCount }}</span><span>模糊 {{ summary.data.value.uncertainCount }}</span><span>不认识 {{ summary.data.value.unknownCount }}</span></div>
    <p class="self-report-note">本轮自评 · 完成及反馈来自本批次明细，作答次数仅含已记录事件。</p>
    <p v-if="summary.data.value.statisticsComplete === false" class="weak-incomplete-notice" role="status">部分历史缺少记录，{{ summary.data.value.incompleteWordCount }} 个词的统计不完整。0 次不表示从未学习，次数不从完成词数推算。</p>
    <p v-else-if="summary.data.value.statisticsComplete !== true" class="weak-incomplete-notice" role="status">接口尚未提供事件统计信息，无法确认历史完整性。</p>
    <div class="relearn-panel">
      <div>
        <h2>再次练习</h2>
        <p>
          {{
            summary.data.value.relearnCount
              ? `${summary.data.value.relearnCount} 个词待重学`
              : "暂无需要重学的词。"
          }}
        </p>
      </div>
      <AppButton
        v-if="summary.data.value.relearnCount"
        :busy="busy"
        :disabled="uncertain || !!created"
        @click="relearn"
        ><RotateCcw :size="16" />再次练习模糊／不认识的词</AppButton
      ><RouterLink v-else to="/books" class="btn btn-secondary"
        >继续选词<ArrowRight :size="16"
      /></RouterLink>
    </div>
    <PracticeLaunchNotice :error="error" :uncertain="uncertain" :batch-id="created?.batchId" />
    <p class="weak-practice-note subtle-copy">专项不会改变每日薄弱词和长期复习安排。</p>
    <div class="list-toolbar">
      <div class="section-title"><h2>本轮词汇</h2></div>
      <div class="segmented" role="group" aria-label="自评结果筛选">
        <button
          v-for="f in filters"
          :key="f.label"
          :class="{ selected: filter === f.value }"
          :aria-pressed="filter === f.value"
          @click="filter = f.value"
        >
          {{ f.label }}
        </button>
      </div>
    </div>
    <StatePanel
      :loading="words.loading.value"
      :error="words.error.value"
      :empty="words.data.value?.total === 0"
      message="本轮没有这一自评分类的单词。"
      @retry="loadWords" />
    <div v-if="!words.loading.value && !words.error.value">
      <div
        v-for="word in words.data.value?.records"
        :key="word.itemId"
        class="word-row result-row"
      >
        <RouterLink :to="`/words/${word.wordId}`" class="word-name" lang="en">{{ word.word }}</RouterLink>
        <WordMeaning class="word-translation" :translation="word.translation" :translation-groups="word.translationGroups" />
        <div class="result-word-feedback"><span :class="['result-tag', { known: word.result === 1 }]">{{
          labels[word.result]
        }}</span><p>已记录作答 {{ word.answerCount ?? '—' }} 次</p><p v-if="word.statisticsComplete === false" class="statistics-word-warning">历史记录不完整</p></div>
      </div>
    </div>
    <AppPagination
      v-if="words.data.value"
      :page="page"
      :size="size"
      :total="words.data.value.total"
      :disabled="words.loading.value"
      @change="changePage"
  /></template>
  </div>
</template>
