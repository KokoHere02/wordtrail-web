<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-vue-next';
import { dailyApi } from '../../api/daily';
import { insightsApi } from '../../api/insights';
import { sentencesApi } from '../../api/sentences';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { DailyStatistics, LearningCalendar, StatisticsWord } from '../../types/daily';
import type { LearningSummary, LearningTrend } from '../../types/insights';
import type { SentenceStatistics, SentenceStatisticsAttempt, SentenceStatisticsCalendar, SentenceStatisticsDate } from '../../types/sentences';
import { sentenceAssessmentLabel } from '../../types/sentences';
import StatePanel from '../ui/StatePanel.vue';
import AppDialog from '../ui/AppDialog.vue';
import AppPagination from '../ui/AppPagination.vue';
import StatisticsBarChart from './StatisticsBarChart.vue';
import LearningSummaryCards from './LearningSummaryCards.vue';
import LearningCoverageNotice from './LearningCoverageNotice.vue';
import TrainingStatistics from './TrainingStatistics.vue';
import StatisticsCards from './StatisticsCards.vue';
import WordMeaning from '../word/WordMeaning.vue';
import WordHistoryDialog from './WordHistoryDialog.vue';

const props = defineProps<{ kind: 'word' | 'sentence' }>();
const sentence = computed(() => props.kind === 'sentence');
const route = useRoute();
const range = ref<7 | 30>(7), selected = ref(''), month = ref(''), detailsOpen = ref(false), moreOpen = ref(false), page = ref(1);
const size = 20, wordHistoryOpen = ref(false), historyWord = ref<StatisticsWord>();
const summary = useResource<LearningSummary | SentenceStatistics>();
const trend = useResource<LearningTrend | SentenceStatistics>();
const calendar = useResource<LearningCalendar | SentenceStatisticsCalendar>();
const daily = useResource<DailyStatistics | SentenceStatisticsDate>();
const details = useResource<Page<StatisticsWord> | Page<SentenceStatisticsAttempt>>();
let selectionRevision = 0;
const noun = computed(() => sentence.value ? '句' : '词');
const validDate = (value: string) => /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const loadSummary = () => summary.load(() => sentence.value ? sentencesApi.statistics(range.value) : insightsApi.summary('DAILY'));
const loadTrend = () => trend.load(() => sentence.value ? sentencesApi.statistics(range.value) : insightsApi.trends('DAILY', range.value));
async function loadCalendar(value?: string) {
  await calendar.load(() => sentence.value ? sentencesApi.statisticsCalendar(value) : dailyApi.calendar(value));
  if (calendar.data.value) month.value = calendar.data.value.month;
}
async function selectDate(date?: string) {
  const revision = ++selectionRevision;
  if (date) selected.value = date;
  page.value = 1; details.data.value = undefined;
  if (date && detailsOpen.value) void loadDetails();
  await daily.load(() => sentence.value ? sentencesApi.statisticsDaily(date) : dailyApi.statistics(date));
  if (revision !== selectionRevision || !daily.data.value) return;
  selected.value = sentence.value ? (daily.data.value as SentenceStatisticsDate).date : (daily.data.value as DailyStatistics).learningDate;
  if (!date && detailsOpen.value) void loadDetails();
}
function loadDetails() {
  if (!selected.value) return;
  const query = { date: selected.value, page: page.value, size };
  return details.load(() => sentence.value ? sentencesApi.statisticsAttempts(query) : dailyApi.statisticsWords(query));
}
function openDetails() { detailsOpen.value = true; void loadDetails(); }
function changePage(value: number) { page.value = value; void loadDetails(); }
function changeMonth(offset: number) {
  const match = /^(\d{4})-(\d{2})$/.exec(month.value);
  if (!match) return;
  const absolute = Number(match[1]) * 12 + Number(match[2]) - 1 + offset;
  const year = Math.floor(absolute / 12);
  if (year < 1000 || year > 9999) return;
  void loadCalendar(`${year}-${String(absolute % 12 + 1).padStart(2, '0')}`);
}
function selectFromTrend(date: string) { void selectDate(date); if (date.slice(0, 7) !== month.value) void loadCalendar(date.slice(0, 7)); }
function refresh() { void loadSummary(); void loadTrend(); void selectDate(selected.value || undefined); void loadCalendar(month.value || undefined); }
watch(range, loadTrend);
onMounted(() => {
  const date = typeof route.query.date === 'string' && validDate(route.query.date) ? route.query.date : undefined;
  void loadSummary(); void loadTrend(); void selectDate(date); void loadCalendar(date?.slice(0, 7));
});
const streaks = computed(() => {
  if (!summary.data.value) return null;
  const data = summary.data.value;
  return { current: data.currentStreak, longest: data.longestStreak, total: 'totalStudyDays' in data ? data.totalStudyDays : data.learningDayCount };
});
const trendRows = computed(() => {
  const data = trend.data.value;
  if (!data) return [];
  return 'records' in data ? data.records.map(row => ({ date: row.learningDate, count: row.completedCount, active: row.hasLearningActivity })) : data.days.map(row => ({ date: row.learningDate, count: row.selfReviewCount, active: row.submissionCount > 0 || row.selfReviewCount > 0 }));
});
const calendarRows = computed(() => {
  const data = calendar.data.value;
  if (!data) return [];
  return data.days.map(row => 'date' in row ? { date: row.date, active: row.hasActivity, count: row.selfReviewCount, complete: true } : { date: row.learningDate, active: row.hasLearningActivity, count: row.completedCount, complete: row.statisticsComplete });
});
const leading = computed(() => month.value ? (new Date(`${month.value}-01T00:00:00Z`).getUTCDay() + 6) % 7 : 0);
const selectedCount = computed(() => daily.data.value ? ('date' in daily.data.value ? daily.data.value.selfReviewCount : daily.data.value.completedCount) : 0);
const active = computed(() => daily.data.value ? ('date' in daily.data.value ? daily.data.value.hasActivity : daily.data.value.hasLearningActivity) : false);
const dailyWord = computed(() => daily.data.value && 'learningDate' in daily.data.value ? daily.data.value : undefined);
const dateDisplay = (value: string) => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y: string, m: string, d: string) => `${y}年${Number(m)}月${Number(d)}日`);
const wordRows = computed(() => (details.data.value?.records ?? []) as StatisticsWord[]);
const sentenceRows = computed(() => (details.data.value?.records ?? []) as SentenceStatisticsAttempt[]);
</script>
<template>
  <div class="statistics-overview wordlist-page">
    <div class="overview-actions"><button class="muted-link" :disabled="summary.loading.value || trend.loading.value" @click="refresh"><RotateCcw :size="15" />刷新统计</button></div>
    <section class="overview-card overview-streaks" aria-label="学习天数">
      <StatePanel :loading="summary.loading.value" :error="summary.error.value" @retry="loadSummary" />
      <template v-if="streaks && !summary.loading.value && !summary.error.value"><div><span>当前连续</span><strong>{{ streaks.current }} <small>天</small></strong></div><div><span>最长连续</span><strong>{{ streaks.longest }} <small>天</small></strong></div><div><span>累计学习</span><strong>{{ streaks.total }} <small>天</small></strong></div></template>
    </section>
    <div class="overview-grid">
      <section class="overview-card overview-trend"><header class="overview-heading"><h2>学习趋势</h2><div class="overview-range" role="group" aria-label="趋势范围"><button v-for="value in ([7, 30] as const)" :key="value" :class="{ active: range === value }" :aria-pressed="range === value" @click="range = value">最近 {{ value }} 天</button></div></header><p class="overview-subtitle">完成{{ noun }}数</p><StatePanel :loading="trend.loading.value" :error="trend.error.value" @retry="loadTrend" /><StatisticsBarChart v-if="trend.data.value && !trend.loading.value && !trend.error.value" :records="trendRows" :selected="selected" :noun="noun" @select="selectFromTrend" /><LearningCoverageNotice v-if="!sentence && trend.data.value && 'coverage' in trend.data.value && !trend.data.value.coverage.statisticsComplete" :coverage="trend.data.value.coverage" /></section>
      <section class="overview-card overview-calendar"><header class="overview-heading"><h2>学习日历</h2><div class="overview-month"><button class="round-icon" aria-label="上个月" :disabled="calendar.loading.value || month === '1000-01'" @click="changeMonth(-1)"><ChevronLeft :size="18" /></button><label><span class="sr-only">选择月份</span><input :value="month" type="month" min="1000-01" max="9999-12" :disabled="calendar.loading.value" @change="loadCalendar(($event.target as HTMLInputElement).value)" /></label><button class="round-icon" aria-label="下个月" :disabled="calendar.loading.value || month === '9999-12'" @click="changeMonth(1)"><ChevronRight :size="18" /></button></div></header><StatePanel :loading="calendar.loading.value" :error="calendar.error.value" @retry="loadCalendar(month || undefined)" /><template v-if="calendar.data.value && !calendar.loading.value && !calendar.error.value"><p v-if="!sentence && 'statisticsComplete' in calendar.data.value && !calendar.data.value.statisticsComplete" class="overview-warning">部分历史记录不完整。</p><div class="overview-calendar-grid"><span v-for="day in ['一','二','三','四','五','六','日']" :key="day" class="overview-weekday">{{ day }}</span><span v-for="n in leading" :key="`blank-${n}`" aria-hidden="true" /><button v-for="day in calendarRows" :key="day.date" :class="{ selected: day.date === selected }" :aria-pressed="day.date === selected" :aria-label="`${day.date}，完成 ${day.count} ${noun}，${day.active ? '有学习活动' : '无学习活动'}${day.complete ? '' : '，统计不完整'}`" @click="selectDate(day.date)"><span>{{ Number(day.date.slice(-2)) }}</span><i v-if="day.active" aria-hidden="true" /><b v-if="!day.complete" class="sr-only">统计不完整</b></button></div></template></section>
    </div>
    <section class="overview-card overview-day" aria-label="选中日期统计"><StatePanel :loading="daily.loading.value" :error="daily.error.value" @retry="selectDate(selected || undefined)" /><template v-if="daily.data.value && !daily.loading.value && !daily.error.value"><div class="overview-day-number"><span>{{ dateDisplay(selected) }}</span><strong>完成 <b>{{ selectedCount }}</b> {{ noun }}</strong></div><p>{{ active ? '当天有学习活动' : '当天暂无学习活动' }}<span v-if="dailyWord && !dailyWord.statisticsComplete" class="overview-warning"> · 部分历史记录不完整</span></p><button class="btn btn-secondary" @click="openDetails">查看当日详情 <span aria-hidden="true">→</span></button></template></section>
    <details class="overview-card overview-more" @toggle="moreOpen = ($event.target as HTMLDetailsElement).open">
      <summary><span class="overview-more-title"><strong>{{ sentence ? '句子统计与更多数据' : '训练方式与更多数据' }}</strong><small>{{ sentence ? '查看句子学习详情' : '查看每日目标与分方式训练' }}</small></span><span class="overview-more-toggle"><span>{{ moreOpen ? '收起' : '展开' }}</span><ChevronDown :size="18" aria-hidden="true" /></span></summary>
      <div v-if="moreOpen" class="overview-more-content"><template v-if="!sentence"><LearningSummaryCards v-if="summary.data.value && 'coverage' in summary.data.value" :summary="summary.data.value" /><TrainingStatistics v-if="selected" :key="selected" :initial-date="selected" /></template><template v-else-if="summary.data.value && 'weakSentenceCount' in summary.data.value"><div class="sentence-more-facts"><span>提交 {{ summary.data.value.submissionCount }} 次</span><span>输入译文 {{ summary.data.value.answerCount }} 次</span><span>查看解析 {{ summary.data.value.revealCount }} 次</span><span>完成自评 {{ summary.data.value.selfReviewCount }} 次</span></div><div class="live-actions"><RouterLink to="/sentences/review" class="muted-link">待巩固 {{ summary.data.value.weakSentenceCount }} 句</RouterLink><RouterLink to="/sentences/due" class="muted-link">到期复习 {{ summary.data.value.dueSentenceCount }} 句</RouterLink></div></template></div>
    </details>
    <AppDialog v-model="detailsOpen" :title="`${dateDisplay(selected)} · 当日详情`" panel-class="statistics-overview-dialog">
      <template v-if="dailyWord && !sentence"><StatisticsCards :statistics="dailyWord" /></template>
      <dl v-if="sentence && daily.data.value && 'date' in daily.data.value" class="sentence-day-counts"><div><dt>提交</dt><dd>{{ daily.data.value.submissionCount }}</dd></div><div><dt>输入译文</dt><dd>{{ daily.data.value.answerCount }}</dd></div><div><dt>查看解析</dt><dd>{{ daily.data.value.revealCount }}</dd></div><div><dt>完成自评</dt><dd>{{ daily.data.value.selfReviewCount }}</dd></div></dl>
      <StatePanel :loading="details.loading.value" :error="details.error.value" :empty="!!details.data.value && !details.data.value.records.length" :message="sentence ? '当天暂无句子活动。' : '当天暂无已学习单词。'" @retry="loadDetails" />
      <div v-if="details.data.value && !details.loading.value && !details.error.value" class="overview-detail-list">
        <template v-if="!sentence"><article v-for="word in wordRows" :key="word.wordId" class="overview-detail-row"><div><strong lang="en">{{ word.word }}</strong><WordMeaning :translation="word.translation" :translation-groups="word.translationGroups" /><p class="subtle-copy">{{ word.itemType === 'NEW' ? '新词' : word.itemType === 'REVIEW' ? '复习' : '分类未提供' }} · {{ word.completed ? '已完成' : '未完成' }} · 作答 {{ word.answerCount }} 次<span v-if="!word.statisticsComplete"> · 记录不完整</span></p></div><button class="muted-link" @click="historyWord = word; wordHistoryOpen = true">学习历史</button></article></template>
        <template v-else><article v-for="entry in sentenceRows" :key="entry.attemptId" class="overview-detail-row sentence-attempt"><div><strong lang="en">{{ entry.englishText }}</strong><p class="subtle-copy">{{ entry.submittedOnDate ? '当天提交' : '' }}{{ entry.submittedOnDate && entry.reviewedOnDate ? ' · ' : '' }}{{ entry.reviewedOnDate ? '当天自评' : '' }} · {{ entry.activityAt.replace('T', ' ') }}</p><p>你的译文：{{ entry.action === 'REVEAL' ? '查看解析' : entry.translation }}</p><p>参考译文：{{ entry.referenceTranslation }}</p><p v-if="entry.explanation">解析：{{ entry.explanation }}</p><p>{{ sentenceAssessmentLabel(entry.selfAssessment) }}<span v-if="entry.reviewedAt"> · 自评时间 {{ entry.reviewedAt.replace('T', ' ') }}</span></p></div></article></template>
      </div><AppPagination v-if="details.data.value && !details.loading.value && !details.error.value" :page="page" :size="size" :total="details.data.value.total" numbered @change="changePage" />
    </AppDialog>
    <WordHistoryDialog v-model="wordHistoryOpen" :word-id="historyWord?.wordId ?? null" :word="historyWord?.word || ''" />
  </div>
</template>
