<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { dictationApi } from '../../api/dictation';
import { ApiError } from '../../api/http';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { DictationTask, DictationWord } from '../../types/dictation';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import DictationStats from '../../components/learning/DictationStats.vue';
import DictationWordRows from '../../components/learning/DictationWordRows.vue';
const id = Number(useRoute().params.batchId);
const summary = useResource<DictationTask>();
const words = useResource<Page<DictationWord>>();
const page = ref(1);
const size = 10;
async function loadWords() {
  if (!summary.data.value || summary.data.value.singleAttempt !== false && summary.data.value.status !== 'COMPLETED') return;
  await words.load(async () => {
    try { return await dictationApi.resultWords(id, { page: page.value, size }); }
    catch (value) { if (value instanceof ApiError && value.code === 'DICTATION_NOT_COMPLETED') await summary.load(() => dictationApi.task(id)); throw value; }
  });
}
async function refresh() {
  await summary.load(() => dictationApi.task(id));
  if (!summary.error.value && summary.data.value && (summary.data.value.singleAttempt === false || summary.data.value.status === 'COMPLETED')) await loadWords();
}
function changePage(value: number) { page.value = value; void loadWords(); }
onMounted(refresh);
</script>
<template>
  <div class="wordlist-page dictation-result"><header class="library-heading"><div><h1 v-if="summary.data.value?.singleAttempt === false">旧版默写记录</h1></div><RouterLink to="/dictation" class="muted-link">默写记录</RouterLink></header><StatePanel :loading="summary.loading.value" :error="summary.error.value" @retry="refresh" />
    <template v-if="summary.data.value && !summary.loading.value && !summary.error.value"><template v-if="summary.data.value.singleAttempt === false || summary.data.value.status === 'COMPLETED'"><DictationStats :task="summary.data.value" /><p v-if="summary.data.value.singleAttempt === false" class="subtle-copy">旧版练习仅供回顾，不计算测验正确率。</p><div class="live-actions dictation-result-actions"><RouterLink to="/dictation/mistakes" class="btn btn-primary">错词另开测验</RouterLink><RouterLink to="/dictation" class="btn btn-secondary">新建测验</RouterLink></div><h2>本轮单词</h2><StatePanel :loading="words.loading.value" :error="words.error.value" :empty="words.data.value?.total === 0" message="本轮暂无可回顾的单词。" @retry="loadWords" /><DictationWordRows v-if="words.data.value && !words.loading.value && !words.error.value" :records="words.data.value.records" /><AppPagination v-if="words.data.value" :page="page" :size="size" :total="words.data.value.total" :disabled="words.loading.value" @change="changePage" /></template><div v-else class="library-empty"><h2>{{ summary.data.value.status === 'ABANDONED' ? '本轮已放弃' : '本轮尚未结束' }}</h2><RouterLink v-if="summary.data.value.singleAttempt && summary.data.value.canContinue && summary.data.value.status === 'IN_PROGRESS'" :to="`/dictation/${id}`" class="btn btn-primary">继续测验</RouterLink><RouterLink to="/dictation" class="btn btn-secondary">新建测验</RouterLink></div></template>
  </div>
</template>
<style scoped>
.dictation-result :deep(.dictation-word-row) {
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) auto;
  align-items: start;
  gap: 20px;
  padding: 20px;
  margin-top: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}
.dictation-result :deep(.dictation-word-copy) { display: flex; flex-direction: column; gap: 8px; padding: 2px 0; }
.dictation-result :deep(.dictation-word-copy > strong) { color: var(--ink); font-size: 24px; }
.dictation-result :deep(.dictation-word-copy > strong),
.dictation-result :deep(.dictation-word-copy > .word-meaning) { min-width: 0; overflow-wrap: anywhere; }
.dictation-result :deep(.dictation-word-feedback) { min-width: 0; padding: 13px 15px; border-radius: 9px; background: var(--hover); }
.dictation-result :deep(.dictation-feedback-meta) { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--muted); font-size: 12px; }
.dictation-result :deep(.dictation-result-badge) { padding: 2px 8px; border-radius: 6px; background: var(--sage); color: var(--accent-strong); font-weight: 650; }
.dictation-result :deep(.dictation-result-badge.is-incorrect) { background: var(--spelling-error-bg); color: var(--spelling-error); }
.dictation-result :deep(.dictation-result-badge.is-revealed) { background: var(--surface); color: var(--muted); }
.dictation-result :deep(.dictation-last-input) { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; margin: 10px 0 8px; }
.dictation-result :deep(.dictation-input-label) { color: var(--muted); font-size: 12px; }
.dictation-result :deep(.dictation-input-value) { color: var(--ink); font-size: 18px; font-weight: 650; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.dictation-result :deep(.dictation-input-empty) { color: var(--muted); font-size: 15px; }
.dictation-result :deep(.dictation-word-feedback time) { color: var(--muted); font-size: 12px; }
.dictation-result :deep(.dictation-word-row > button) { white-space: nowrap; }
@media (max-width: 700px) {
  .dictation-result :deep(.dictation-word-row) { grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 15px; }
  .dictation-result :deep(.dictation-word-copy) { grid-column: 1; }
  .dictation-result :deep(.dictation-word-feedback) { grid-column: 1 / -1; grid-row: 2; }
  .dictation-result :deep(.dictation-word-row > button) { grid-column: 2; grid-row: 1; justify-self: end; }
}
</style>
