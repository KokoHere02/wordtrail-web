<script setup lang="ts">
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
const route = useRoute();
const initialDate = typeof route.query.date === 'string' ? route.query.date : undefined;
const insights = useLearningInsights();
const { source, days, summary, trends } = insights;
const sources: { value: LearningSource; label: string }[] = [{ value: 'DAILY', label: '每日学习' }, { value: 'PRACTICE', label: '认识专项' }];
const windows: TrendDays[] = [7, 30];
</script>
<template>
  <div class="wordlist-page statistics-page">
    <header class="library-heading"><div><h1>学习统计</h1></div><div class="live-actions"><RouterLink to="/records" class="muted-link">每日任务记录</RouterLink><RouterLink to="/learning" class="muted-link">认识专项记录</RouterLink></div></header>
    <div class="insights-controls"><div class="category-tabs" role="group" aria-label="统计来源"><button v-for="entry in sources" :key="entry.value" :class="{ active: source === entry.value }" :aria-pressed="source === entry.value" @click="source = entry.value">{{ entry.label }}</button></div><button class="muted-link" :disabled="summary.loading.value || trends.loading.value" @click="insights.refresh"><RotateCcw :size="15" />刷新统计</button></div>
    <section class="insights-summary-panel" :aria-busy="summary.loading.value" aria-label="学习概览"><StatePanel :loading="summary.loading.value" :error="summary.error.value" @retry="insights.loadSummary" /><LearningSummaryCards v-if="summary.data.value && !summary.loading.value && !summary.error.value" :summary="summary.data.value" /></section>
    <section class="insights-trend-panel" :aria-busy="trends.loading.value" aria-label="学习趋势"><div class="insights-trend-heading"><div><h2>学习趋势</h2><p v-if="trends.data.value && !trends.loading.value && !trends.error.value">{{ trends.data.value.from || '日期未提供' }} — {{ trends.data.value.to || '日期未提供' }} · 北京时间</p></div><div class="segmented" role="group" aria-label="趋势时间范围"><button v-for="window in windows" :key="window" :class="{ selected: days === window }" :aria-pressed="days === window" @click="days = window">最近 {{ window }} 天</button></div></div><StatePanel :loading="trends.loading.value" :error="trends.error.value" @retry="insights.loadTrends" /><template v-if="trends.data.value && !trends.loading.value && !trends.error.value"><div class="insights-window-totals" aria-label="窗口合计"><div><strong>{{ trends.data.value.totalCompletedCount }}</strong><span>窗口完成合计 · 词</span></div><div><strong>{{ trends.data.value.totalAnswerCount }}</strong><span>窗口作答合计 · 次</span></div></div><LearningTrendChart :records="trends.data.value.records" /><LearningCoverageNotice :coverage="trends.data.value.coverage" /><details class="copy-note insights-counting-note"><summary>趋势口径</summary><p>合计为逐日相加，同一词跨日完成分别计数，完成不代表掌握。{{ source === 'DAILY' ? '每日完成数取 DONE 明细，跳过不计完成；作答次数取正常事件，含强化、不含更正。' : '专项完成词数按正常作答日期在当天去重，跨批次重复作答仍计次数；不按批次完成日期分摊。' }}</p></details></template></section>
    <DailyStatisticsDetails v-if="source === 'DAILY'" :initial-date="initialDate" />
  </div>
</template>
