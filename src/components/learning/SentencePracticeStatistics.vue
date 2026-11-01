<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-vue-next';
import { sentencePracticeApi, type SentencePracticeRecord, type SentencePracticeStatistics } from '../../api/sentencePractice';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import StatePanel from '../ui/StatePanel.vue';
import AppDialog from '../ui/AppDialog.vue';
import AppPagination from '../ui/AppPagination.vue';
import StatisticsBarChart from './StatisticsBarChart.vue';

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const requested = useRoute().query.date;
const initialDate = typeof requested === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requested) && !Number.isNaN(Date.parse(`${requested}T00:00:00Z`)) && new Date(`${requested}T00:00:00Z`).toISOString().slice(0,10) === requested ? requested : today;
const selected = ref(initialDate), month = ref(initialDate.slice(0,7)), range = ref<7 | 30>(7), page = ref(1), detailsOpen = ref(false);
const trend = useResource<SentencePracticeStatistics>(), calendar = useResource<SentencePracticeStatistics>();
const details = useResource<Page<SentencePracticeRecord>>();
const shiftDay = (date: string, amount: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate()+amount); return localDate(d); };
function loadTrend() { return trend.load(() => sentencePracticeApi.statistics(shiftDay(today, 1-range.value), today)); }
function loadCalendar() { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month.value)) return; const last = new Date(Number(month.value.slice(0,4)),Number(month.value.slice(5,7)),0).getDate(); return calendar.load(() => sentencePracticeApi.statistics(`${month.value}-01`, `${month.value}-${String(last).padStart(2,'0')}`)); }
function loadDetails() { return details.load(() => sentencePracticeApi.records(selected.value,page.value)); }
function choose(date: string) { selected.value=date; page.value=1; if (date.slice(0,7)!==month.value) month.value=date.slice(0,7); if(detailsOpen.value) void loadDetails(); }
function changeMonth(offset: number) { const date=new Date(Number(month.value.slice(0,4)), Number(month.value.slice(5,7))-1+offset, 1,12); if(date.getFullYear()>=1000 && date.getFullYear()<=9999) month.value=localDate(date).slice(0,7); }
function openDetails() { detailsOpen.value=true; page.value=1; void loadDetails(); }
function changePage(value: number) { page.value=value; void loadDetails(); }
function refresh() { void loadTrend(); void loadCalendar(); if(detailsOpen.value) void loadDetails(); }
watch(range,loadTrend);
watch(month, value => {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && !selected.value.startsWith(`${value}-`)) {
    selected.value = `${value}-01`; page.value = 1;
    if (detailsOpen.value) void loadDetails();
  }
  void loadCalendar();
});
onMounted(refresh);
const byDate = computed(() => new Map((calendar.data.value?.days ?? []).map(day => [day.date,day])));
const monthDays = computed(() => { const n=new Date(Number(month.value.slice(0,4)),Number(month.value.slice(5,7)),0).getDate(); return Array.from({length:n},(_,i)=>`${month.value}-${String(i+1).padStart(2,'0')}`); });
const leading = computed(() => (new Date(`${month.value}-01T12:00:00`).getDay()+6)%7);
const trendRows = computed(() => { const days=new Map((trend.data.value?.days ?? []).map(day=>[day.date,day])); return Array.from({length:range.value},(_,i)=>{const date=shiftDay(today,i+1-range.value), count=days.get(date)?.sentences ?? 0; return {date,count,active:count>0};}); });
const selectedDay = computed(() => byDate.value.get(selected.value));
</script>
<template>
  <div class="statistics-overview wordlist-page">
    <div class="overview-actions"><button class="muted-link" :disabled="trend.loading.value || calendar.loading.value" @click="refresh"><RotateCcw :size="15" />刷新统计</button></div>
    <section class="overview-card overview-streaks" aria-label="句子学习天数">
      <StatePanel :loading="trend.loading.value" :error="trend.error.value" @retry="loadTrend" />
      <template v-if="trend.data.value && !trend.loading.value && !trend.error.value"><div><span>当前连续</span><strong>{{ trend.data.value.currentStreak }} <small>天</small></strong></div><div><span>最长连续</span><strong>{{ trend.data.value.longestStreak }} <small>天</small></strong></div><div><span>累计学习</span><strong>{{ trend.data.value.learningDays }} <small>天</small></strong></div></template>
    </section>
    <div class="overview-grid">
      <section class="overview-card overview-trend"><header class="overview-heading"><h2>学习趋势</h2><div class="overview-range" role="group" aria-label="趋势范围"><button v-for="value in ([7,30] as const)" :key="value" :class="{active:range===value}" :aria-pressed="range===value" @click="range=value">最近 {{ value }} 天</button></div></header><p class="overview-subtitle">每日翻译句数（同一句当天重复翻译计为一句）</p><StatePanel :loading="trend.loading.value" :error="trend.error.value" @retry="loadTrend" /><StatisticsBarChart v-if="trend.data.value && !trend.loading.value && !trend.error.value" :records="trendRows" :selected="selected" noun="句" @select="choose" /></section>
      <section class="overview-card overview-calendar"><header class="overview-heading"><h2>学习日历</h2><div class="overview-month"><button class="round-icon" aria-label="上个月" @click="changeMonth(-1)"><ChevronLeft :size="18" /></button><label><span class="sr-only">选择月份</span><input v-model="month" type="month" min="1000-01" max="9999-12" /></label><button class="round-icon" aria-label="下个月" @click="changeMonth(1)"><ChevronRight :size="18" /></button></div></header><StatePanel :loading="calendar.loading.value" :error="calendar.error.value" @retry="loadCalendar" /><div v-if="calendar.data.value && !calendar.loading.value && !calendar.error.value" class="overview-calendar-grid"><span v-for="day in ['一','二','三','四','五','六','日']" :key="day" class="overview-weekday">{{ day }}</span><span v-for="n in leading" :key="`blank-${n}`" aria-hidden="true" /><button v-for="date in monthDays" :key="date" :class="{selected:date===selected}" :aria-pressed="date===selected" :aria-label="`${date}，翻译 ${byDate.get(date)?.sentences ?? 0} 句`" @click="choose(date)"><span>{{ Number(date.slice(-2)) }}</span><i v-if="byDate.has(date)" aria-hidden="true" /></button></div></section>
    </div>
    <section class="overview-card sentence-summary" aria-label="句子翻译统计">
      <div class="sentence-summary-section">
        <header class="sentence-summary-header"><div><h2>当日翻译</h2><p>{{ selected }}</p></div><button class="btn btn-secondary" @click="openDetails">查看当日详情 <span aria-hidden="true">→</span></button></header>
        <StatePanel :loading="calendar.loading.value" :error="calendar.error.value" @retry="loadCalendar" />
        <dl v-if="calendar.data.value && !calendar.loading.value && !calendar.error.value" class="sentence-summary-metrics">
          <div><dt>翻译句数</dt><dd>{{ selectedDay?.sentences ?? 0 }} <small>句</small></dd><p>当天翻译过的不同句子</p></div>
          <div><dt>提交次数</dt><dd>{{ selectedDay?.submissions ?? 0 }} <small>次</small></dd><p>当天每提交一次计一次</p></div>
        </dl>
      </div>
      <div class="sentence-summary-section sentence-summary-total">
        <header class="sentence-summary-header"><div><h2>累计翻译</h2><p>包含已保留的历史译文</p></div></header>
        <StatePanel :loading="trend.loading.value" :error="trend.error.value" @retry="loadTrend" />
        <dl v-if="trend.data.value && !trend.loading.value && !trend.error.value" class="sentence-summary-metrics">
          <div><dt>翻译句数</dt><dd>{{ trend.data.value.sentences }} <small>句</small></dd><p>翻译过的不同句子</p></div>
          <div><dt>提交次数</dt><dd>{{ trend.data.value.submissions }} <small>次</small></dd><p>所有翻译提交的总次数</p></div>
        </dl>
      </div>
    </section>
    <AppDialog v-model="detailsOpen" :title="`${selected} · 翻译记录`" panel-class="statistics-overview-dialog"><StatePanel :loading="details.loading.value" :error="details.error.value" :empty="!!details.data.value && !details.data.value.records.length" message="当天暂无翻译记录。" @retry="loadDetails" /><div v-if="details.data.value && !details.loading.value && !details.error.value" class="overview-detail-list"><article v-for="entry in details.data.value.records" :key="entry.id" class="overview-detail-row sentence-attempt"><div><strong lang="en">{{ entry.englishText }}</strong><p class="subtle-copy">{{ entry.createdAt.replace('T',' ') }}</p><p>你的翻译：{{ entry.translation }}</p><p>参考翻译：{{ entry.referenceTranslation }}</p><p v-if="entry.explanation">解析：{{ entry.explanation }}</p></div></article></div><AppPagination v-if="details.data.value && !details.loading.value && !details.error.value" :page="page" :size="20" :total="details.data.value.total" numbered @change="changePage" /></AppDialog>
  </div>
</template>
<style scoped>
.sentence-summary { margin-top: var(--s4); padding: 0 var(--s6); }
.sentence-summary-section { padding: var(--s6) 0; }
.sentence-summary-total { border-top: 1px solid var(--line); }
.sentence-summary-header { display: flex; justify-content: space-between; align-items: center; gap: var(--s4); }
.sentence-summary-header h2 { margin: 0; color: var(--ink); font-size: 16px; font-weight: 600; }
.sentence-summary-header p { margin: 5px 0 0; color: var(--muted); font-size: 13px; }
.sentence-summary-header .btn { flex: none; }
.sentence-summary-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s5); margin: var(--s5) 0 0; }
.sentence-summary-metrics > div + div { border-left: 1px solid var(--line); padding-left: var(--s6); }
.sentence-summary-metrics dt { color: var(--muted); font-size: 13px; }
.sentence-summary-metrics dd { margin: 6px 0 0; color: var(--accent-strong); font-size: 30px; font-weight: 600; line-height: 1.25; font-variant-numeric: tabular-nums; }
.sentence-summary-metrics dd small { color: var(--muted); font-size: 13px; font-weight: 400; }
.sentence-summary-metrics p { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
@media (max-width: 600px) {
  .sentence-summary { padding: 0 var(--s4); }
  .sentence-summary-section { padding: var(--s5) 0; }
  .sentence-summary-header { align-items: flex-start; }
  .sentence-summary-header .btn { padding-inline: var(--s3); font-size: 13px; }
  .sentence-summary-metrics { gap: var(--s3); }
  .sentence-summary-metrics > div + div { padding-left: var(--s4); }
}
.sentence-attempt p { white-space:pre-wrap; overflow-wrap:anywhere; }
</style>
