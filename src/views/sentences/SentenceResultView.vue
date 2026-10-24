<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { sentencesApi } from '../../api/sentences';
import { ApiError } from '../../api/http';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { SentenceProgress, SentenceHistory } from '../../types/sentences';
import SentenceHistoryRows from '../../components/learning/SentenceHistoryRows.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
const id = Number(useRoute().params.sessionId);
const summary = useResource<SentenceProgress>();
const results = useResource<Page<SentenceHistory>>();
const page = ref(1);
const size = 10;
async function loadResults() {
  if (summary.data.value?.status !== 'COMPLETED') return;
  await results.load(async () => {
    try { return await sentencesApi.result(id, { page: page.value, size }); }
    catch (value) { if (value instanceof ApiError && value.code === 'SENTENCE_SESSION_NOT_COMPLETED') await summary.load(() => sentencesApi.progress(id)); throw value; }
  });
}
async function refresh() { await summary.load(() => sentencesApi.progress(id)); if (!summary.error.value) await loadResults(); }
onMounted(refresh);
</script>
<template>
  <div class="wordlist-page sentence-result"><header class="library-heading"><h1>本轮句子自评</h1><RouterLink to="/sentences/records" class="muted-link">练习记录</RouterLink></header><StatePanel :loading="summary.loading.value" :error="summary.error.value" @retry="refresh" /><template v-if="summary.data.value && !summary.loading.value && !summary.error.value"><template v-if="summary.data.value.status === 'COMPLETED'"><dl class="sentence-result-stats" aria-label="本轮练习统计"><div><dt>本轮句数</dt><dd>{{ summary.data.value.totalCount }}</dd></div><div><dt>已提交</dt><dd>{{ summary.data.value.submissionCount }}</dd></div><div><dt>提交译文</dt><dd>{{ summary.data.value.answerCount }}</dd></div><div><dt>查看解析</dt><dd>{{ summary.data.value.revealCount }}</dd></div><div><dt>已自评</dt><dd>{{ summary.data.value.selfReviewCount }}</dd></div><div><dt>已完成</dt><dd>{{ summary.data.value.completedCount }}</dd></div></dl><div class="sentence-assessment-counts" aria-label="用户自评分布"><span>意思基本一致 {{ summary.data.value.understoodCount }}</span><span>部分理解 {{ summary.data.value.partialCount }}</span><span>未理解 {{ summary.data.value.notUnderstoodCount }}</span></div><p class="sentence-reference-note">以上为用户自评，不代表客观正确率。参考译文不是唯一答案。</p><div class="live-actions sentence-result-actions"><RouterLink to="/sentences/review" class="btn btn-primary">去待巩固练习</RouterLink><RouterLink to="/sentences" class="btn btn-secondary">从题库再次选题</RouterLink></div><StatePanel :loading="results.loading.value" :error="results.error.value" :empty="results.data.value?.total === 0" message="本轮暂无已记录的作答。" @retry="loadResults" /><SentenceHistoryRows v-if="results.data.value && !results.loading.value && !results.error.value" :records="results.data.value.records" /><AppPagination v-if="results.data.value" :page="page" :size="size" :total="results.data.value.total" :disabled="results.loading.value" noun="句" @change="page = $event; loadResults()" /></template><div v-else class="library-empty"><h2>本轮尚未完成</h2><RouterLink :to="`/sentences/sessions/${id}`" class="btn btn-primary">继续练习</RouterLink></div></template></div>
</template>
