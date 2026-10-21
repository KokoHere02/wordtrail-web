<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-vue-next";
import { api } from "../../api";
import { errorMessage } from "../../api/http";
import { useResource } from "../../composables/useResource";
import type { Page, Result, RoundResult, RoundWord } from "../../types/api";
import AppButton from "../../components/ui/AppButton.vue";
import AppPagination from "../../components/ui/AppPagination.vue";
import StatePanel from "../../components/ui/StatePanel.vue";
const id = Number(useRoute().params.batchId);
const router = useRouter();
const summary = useResource<RoundResult>();
const words = useResource<Page<RoundWord>>();
const filter = ref<Result | undefined>();
const page = ref(1);
const size = 10;
const busy = ref(false);
const error = ref("");
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
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const batch = await api.relearn(id);
    await router.push(`/study/${batch.batchId}`);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="wordlist-page">
  <RouterLink to="/learning" class="back-link"
    ><ArrowLeft :size="15" />我的学习</RouterLink
  ><StatePanel
    :loading="summary.loading.value"
    :error="summary.error.value"
    @retry="loadSummary"
  /><template v-if="summary.data.value"
    ><section class="round-heading">
      <div class="round-check"><Check :size="23" :stroke-width="1.5" /></div>
      <h1>本轮已完成</h1>
      <p>{{ summary.data.value.bookName || "词汇学习" }} · 本轮已完成</p>
    </section>
    <section class="result-stats" aria-label="本轮自评汇总">
      <div class="result-stat">
        <strong>{{ summary.data.value.totalCount }}</strong
        ><span>本轮单词</span>
      </div>
      <div class="result-stat">
        <strong>{{ summary.data.value.knownCount }}</strong
        ><span>认识</span>
      </div>
      <div class="result-stat">
        <strong>{{ summary.data.value.uncertainCount }}</strong
        ><span>不确定</span>
      </div>
      <div class="result-stat">
        <strong>{{ summary.data.value.unknownCount }}</strong
        ><span>不认识</span>
      </div>
    </section>
    <p class="self-report-note">
      本轮自评结果
    </p>
    <div class="relearn-panel">
      <div>
        <h2>重学</h2>
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
        @click="relearn"
        ><RotateCcw :size="16" />重学不确定／不认识的词</AppButton
      ><RouterLink v-else to="/books" class="btn btn-secondary"
        >继续选词<ArrowRight :size="16"
      /></RouterLink>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
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
        <span class="word-name">{{ word.word }}</span>
        <p class="word-translation">{{ word.translation || "暂无释义" }}</p>
        <span :class="['result-tag', { known: word.result === 1 }]">{{
          labels[word.result]
        }}</span>
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
