<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { useStatistics } from '../../composables/useStatistics';
import type { StatisticsWord } from '../../types/daily';
import StatisticsCards from '../../components/learning/StatisticsCards.vue';
import StatisticsNotice from '../../components/learning/StatisticsNotice.vue';
import WordHistoryDialog from '../../components/learning/WordHistoryDialog.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
const route = useRoute();
const statistics = useStatistics(typeof route.query.date === 'string' ? route.query.date : undefined);
const { daily, calendar, words, selectedDate, dateInput, monthInput, inputError, page, size } = statistics;
const labels = { 1: '认识', 2: '模糊', 3: '不认识' };
const historyWord = ref<StatisticsWord>();
const historyOpen = ref(false);
const leadingDays = computed(() => {
  if (!calendar.data.value) return 0;
  const date = new Date(`${calendar.data.value.month}-01T00:00:00Z`);
  return (date.getUTCDay() + 6) % 7;
});
function showHistory(word: StatisticsWord) { historyWord.value = word; historyOpen.value = true; }
</script>
<template>
  <div class="wordlist-page statistics-page">
    <header class="library-heading"><div><p class="overline">LITTLE STEPS, LASTING CHANGE</p><h1>每一天，都留下积累。</h1><p class="hero-subtitle">每日学习统计与日历 · 日期按北京时间</p></div><div class="live-actions"><RouterLink to="/records" class="muted-link">每日任务记录</RouterLink><RouterLink to="/learning" class="muted-link">专项练习记录</RouterLink></div></header>
    <p v-if="inputError" class="inline-error" role="alert">{{ inputError }}</p>
    <section class="wordlist-sheet calendar-sheet">
      <div class="calendar-heading"><h2>学习日历</h2><form class="live-actions" @submit.prevent="statistics.applyMonth"><button class="round-icon" type="button" aria-label="上个月" :disabled="calendar.loading.value || !calendar.data.value || calendar.data.value.month === '1000-01'" @click="statistics.changeMonth(-1)"><ChevronLeft :size="20" /></button><label class="sr-only" for="statistics-month">日历月份</label><input id="statistics-month" v-model="monthInput" type="month" min="1000-01" max="9999-12" :disabled="calendar.loading.value" /><button class="violet-link" type="submit" :disabled="calendar.loading.value">查看月份</button><button class="round-icon" type="button" aria-label="下个月" :disabled="calendar.loading.value || !calendar.data.value || calendar.data.value.month === '9999-12'" @click="statistics.changeMonth(1)"><ChevronRight :size="20" /></button></form></div>
      <StatePanel :loading="calendar.loading.value" :error="calendar.error.value" @retry="statistics.loadMonth(monthInput || undefined)" />
      <template v-if="calendar.data.value && !calendar.loading.value && !calendar.error.value"><StatisticsNotice :complete="calendar.data.value.statisticsComplete" /><p class="subtle-copy">圆点表示有每日学习行为；零次作答可能伴随历史事件缺失，请结合完整性提示阅读。专项不点亮日历。</p><div class="learning-calendar" :aria-label="`${calendar.data.value.month} 每日学习日历`"><span v-for="day in ['一', '二', '三', '四', '五', '六', '日']" :key="day" class="calendar-weekday">{{ day }}</span><span v-for="index in leadingDays" :key="`blank-${index}`" aria-hidden="true" /><button v-for="day in calendar.data.value.days" :key="day.learningDate" :class="['calendar-day', { selected: day.learningDate === selectedDate, 'has-activity': day.hasLearningActivity, incomplete: !day.statisticsComplete }]" :aria-pressed="day.learningDate === selectedDate" :aria-label="`${day.learningDate}，完成 ${day.completedCount} 词，作答 ${day.answerCount} 次，${day.statisticsComplete ? '统计完整' : '统计不完整'}`" @click="statistics.selectDate(day.learningDate)"><strong>{{ Number(day.learningDate.slice(-2)) }}</strong><span>{{ day.completedCount }} 词</span><small v-if="!day.statisticsComplete">记录不全</small><i v-if="day.hasLearningActivity" aria-hidden="true" /></button></div></template>
    </section>
    <section class="wordlist-sheet statistics-detail">
      <div class="calendar-heading"><h2>{{ selectedDate || '当天' }} · 每日学习</h2><form class="live-actions" @submit.prevent="statistics.applyDate"><label class="sr-only" for="statistics-date">统计日期</label><input id="statistics-date" v-model="dateInput" type="date" min="1000-01-01" max="9999-12-31" /><button class="violet-link" type="submit">查看日期</button></form></div>
      <StatePanel :loading="daily.loading.value" :error="daily.error.value" @retry="statistics.selectDate(selectedDate || undefined)" />
      <StatisticsCards v-if="daily.data.value && !daily.loading.value && !daily.error.value" :statistics="daily.data.value" />
      <h3 class="statistics-words-heading">当日已学习单词</h3><p class="subtle-copy">每个词汇总一行。未计为完成可能包括强化中或已跳过，不由最近反馈推断完成状态。</p>
      <StatePanel :loading="words.loading.value || daily.loading.value" :error="words.error.value" :empty="!!words.data.value && !words.data.value.records.length" message="该日没有可展示的已学习单词。仅安排尚未作答的词不会显示在这里。" @retry="statistics.loadWords" />
      <template v-if="!daily.loading.value && !words.loading.value && !daily.error.value && !words.error.value"><article v-for="word in words.data.value?.records" :key="word.wordId" class="statistics-word-row"><div><strong lang="en">{{ word.word }}</strong><p>{{ word.translation || '暂无释义' }}</p></div><div><span>{{ word.itemType === 'NEW' ? '新词' : word.itemType === 'REVIEW' ? '复习' : '分类未提供' }} · {{ word.lastResult ? labels[word.lastResult] : '反馈未提供' }}</span><p>正常作答 {{ word.answerCount }} 次 · {{ word.completed ? '已完成当天流程' : '未计为完成' }}</p><p v-if="!word.statisticsComplete" class="statistics-word-warning">统计不完整：次数仅含已记录事件</p></div><button class="violet-link" @click="showHistory(word)">学习历史</button></article></template>
      <AppPagination v-if="words.data.value && !daily.loading.value" :page="page" :size="size" :total="words.data.value.total" :disabled="words.loading.value" @change="statistics.changePage" />
    </section>
    <WordHistoryDialog v-model="historyOpen" :word-id="historyWord?.wordId ?? null" :word="historyWord?.word || ''" />
  </div>
</template>
