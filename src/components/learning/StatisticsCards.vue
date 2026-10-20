<script setup lang="ts">
import type { DailyStatistics } from '../../types/daily';
import StatisticsNotice from './StatisticsNotice.vue';
defineProps<{ statistics: DailyStatistics }>();
</script>
<template>
  <section class="statistics-summary" aria-label="每日学习统计">
    <div class="statistics-grid">
      <div><strong>{{ statistics.completedCount }}</strong><span>完成词数</span></div>
      <div><strong>{{ statistics.answerCount }}</strong><span>已记录作答次数</span></div>
      <div><strong>{{ statistics.newCompletedCount }}</strong><span>新词完成</span></div>
      <div><strong>{{ statistics.reviewCompletedCount }}</strong><span>复习完成</span></div>
      <div><strong>{{ statistics.unfamiliarCount }}</strong><span>已答仍不熟悉</span></div>
    </div>
    <p class="subtle-copy">仅统计每日学习；仍不熟悉词数包含强化中的词。更正与请求重试不增加作答次数。</p>
    <StatisticsNotice :complete="statistics.statisticsComplete" :incomplete-word-count="statistics.incompleteWordCount" />
    <p v-if="!statistics.hasLearningActivity && statistics.statisticsComplete" class="subtle-copy">该日没有记录到每日学习行为；专项练习单独查看。</p>
  </section>
</template>
