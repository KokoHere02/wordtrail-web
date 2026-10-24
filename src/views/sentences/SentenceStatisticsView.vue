<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { sentencesApi } from '../../api/sentences';
import { sentenceServiceError } from '../../api/sentenceManagement';
import { useResource } from '../../composables/useResource';
import type { SentenceStatistics } from '../../types/sentences';
import SentenceTrendChart from '../../components/learning/SentenceTrendChart.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
const days = ref<7 | 30>(7);
const { data, loading, error, load } = useResource<SentenceStatistics>();
const totals = [ { key: 'submissionCount', label: '提交数' }, { key: 'answerCount', label: '输入译文数' }, { key: 'revealCount', label: '直接查看解析数' }, { key: 'selfReviewCount', label: '自评完成数' }, { key: 'learningDayCount', label: '累计学习天数' } ] as const;
function refresh() { const range = days.value; return load(async () => { try { return await sentencesApi.statistics(range); } catch (value) { throw new Error(sentenceServiceError(value)); } }); }
watch(days, refresh);
onMounted(refresh);
</script>
<template>
  <div class="wordlist-page sentence-statistics"><header class="library-heading"><h1>句子学习统计</h1><button class="muted-link" :disabled="loading" @click="refresh">刷新统计</button></header><StatePanel :loading="loading" :error="error" @retry="refresh" />
    <template v-if="data && !loading && !error"><section aria-labelledby="sentence-totals-title"><h2 id="sentence-totals-title">全部历史</h2><dl class="sentence-stat-grid"><div v-for="metric in totals" :key="metric.key"><dt>{{ metric.label }}</dt><dd>{{ data[metric.key] }}<small v-if="metric.key === 'learningDayCount'"> 天</small></dd></div></dl></section><section class="sentence-current-counts" aria-labelledby="sentence-current-title"><h2 id="sentence-current-title">当前状态</h2><div class="sentence-current-links"><RouterLink to="/sentences/review">待巩固 <strong>{{ data.weakSentenceCount }}</strong> 句</RouterLink><RouterLink to="/sentences/due">可安排到期 <strong>{{ data.dueSentenceCount }}</strong> 句</RouterLink></div><p class="subtle-copy">到期数不含停用题目和进行中轮次中未完成的题目。</p></section></template>
    <section class="sentence-stat-trend" aria-labelledby="sentence-trend-title"><div class="sentence-linked-heading"><h2 id="sentence-trend-title">每日趋势</h2><div class="category-tabs" role="group" aria-label="趋势区间"><button v-for="range in ([7, 30] as const)" :key="range" :aria-pressed="days === range" :class="{ active: days === range }" @click="days = range">最近 {{ range }} 天</button></div></div><template v-if="data && !loading && !error"><p class="subtle-copy">{{ data.from }} — {{ data.to }} · 北京时间</p><SentenceTrendChart :records="data.days" /><p class="subtle-copy sentence-stat-note">提交按实际提交日、自评按实际自评日计入。累计学习天数不代表连续天数；自评不代表客观正确率。</p></template></section>
  </div>
</template>
