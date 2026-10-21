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
    <details class="copy-note"><summary>统计口径</summary><p>仅每日学习；不熟悉含强化中的词；更正不增加作答次数。</p></details>
    <StatisticsNotice :complete="statistics.statisticsComplete" :incomplete-word-count="statistics.incompleteWordCount" />
    <p v-if="!statistics.hasLearningActivity && statistics.statisticsComplete" class="subtle-copy">暂无每日学习记录。</p>
  </section>
</template>
