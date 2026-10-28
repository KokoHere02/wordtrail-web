<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { RotateCcw } from 'lucide-vue-next';
import { useLearningInsights } from '../../composables/useLearningInsights';
import type { LearningSource } from '../../types/words';
import type { TrendDays } from '../../types/insights';
import StatePanel from '../../components/ui/StatePanel.vue';
import LearningSummaryCards from '../../components/learning/LearningSummaryCards.vue';
import LearningTrendChart from '../../components/learning/LearningTrendChart.vue';
import LearningCoverageNotice from '../../components/learning/LearningCoverageNotice.vue';
import DailyStatisticsDetails from '../../components/learning/DailyStatisticsDetails.vue';
import TrainingStatistics from '../../components/learning/TrainingStatistics.vue';
const route = useRoute();
const initialDate = typeof route.query.date === 'string' ? route.query.date : undefined;
const insights = useLearningInsights(route.query.source === 'PRACTICE' ? 'PRACTICE' : 'DAILY');
const { source, days, summary, trends } = insights;
const sources: { value: LearningSource; label: string }[] = [{ value: 'DAILY', label: '每日学习' }, { value: 'PRACTICE', label: '历史认读专项' }];
const windows: TrendDays[] = [7, 30];
const detailRevision = ref(0);
function refreshStatistics() { detailRevision.value++; return insights.refresh(); }
</script>
<template>
  <div class="wordlist-page statistics-page">
    <header class="library-heading"><div><h1>学习统计</h1></div><div class="live-actions"><RouterLink to="/records" class="muted-link">每日任务记录</RouterLink></div></header>
    <div class="insights-controls"><div class="category-tabs" role="group" aria-label="统计来源"><button v-for="entry in sources" :key="entry.value" :class="{ active: source === entry.value }" :aria-pressed="source === entry.value" @click="source = entry.value">{{ entry.label }}</button></div><button class="muted-link" :disabled="summary.loading.value || trends.loading.value" @click="refreshStatistics"><RotateCcw :size="15" />刷新统计</button></div>
    <section class="insights-summary-panel" :aria-busy="summary.loading.value" aria-label="学习概览"><StatePanel :loading="summary.loading.value" :error="summary.error.value" @retry="insights.loadSummary" /><LearningSummaryCards v-if="summary.data.value && !summary.loading.value && !summary.error.value" :summary="summary.data.value" /></section>
    <section class="insights-trend-panel" :aria-busy="trends.loading.value" aria-label="学习趋势"><div class="insights-trend-heading"><div><h2>学习趋势</h2><p v-if="trends.data.value && !trends.loading.value && !trends.error.value">{{ trends.data.value.from || '日期未提供' }} — {{ trends.data.value.to || '日期未提供' }} · 北京时间</p></div><div class="segmented" role="group" aria-label="趋势时间范围"><button v-for="window in windows" :key="window" :class="{ selected: days === window }" :aria-pressed="days === window" @click="days = window">最近 {{ window }} 天</button></div></div><StatePanel :loading="trends.loading.value" :error="trends.error.value" @retry="insights.loadTrends" /><template v-if="trends.data.value && !trends.loading.value && !trends.error.value"><div class="insights-window-totals" aria-label="窗口合计"><div><strong>{{ trends.data.value.totalTrainingCount }}</strong><span>窗口训练合计 · 次</span></div><div v-if="source === 'DAILY'"><strong>{{ trends.data.value.totalRecalledCount }}</strong><span>窗口回忆完成合计 · 词</span></div><div><strong>{{ trends.data.value.totalCompletedCount }}</strong><span>窗口完成合计 · 词</span></div><div><strong>{{ trends.data.value.totalAnswerCount }}</strong><span>窗口作答合计 · 次</span></div></div><LearningTrendChart :records="trends.data.value.records" :show-recalled="source === 'DAILY'" /><LearningCoverageNotice :coverage="trends.data.value.coverage" /><details class="copy-note insights-counting-note"><summary>趋势口径</summary><p>合计为逐日相加，同一词跨日完成分别计数，完成不代表掌握。{{ source === 'DAILY' ? '训练次数包含 ANSWER 与 REVEAL，含输错和追加训练；作答次数只计真实 ANSWER。完成数取去重 DONE 明细，回忆完成只计明确记录，不等于永久掌握；更正不新增活动。' : '专项完成词数按正常作答日期在当天去重，跨批次重复作答仍计次数；不按批次完成日期分摊。' }}</p></details></template></section>
    <TrainingStatistics v-if="source === 'DAILY'" :key="`training-${detailRevision}`" :initial-date="initialDate" />
    <DailyStatisticsDetails v-if="source === 'DAILY'" :key="`daily-${detailRevision}`" :initial-date="initialDate" />
  </div>
</template>
