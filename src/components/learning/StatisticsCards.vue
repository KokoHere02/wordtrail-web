<script setup lang="ts">
import type { DailyStatistics } from '../../types/daily';
import StatisticsNotice from './StatisticsNotice.vue';
defineProps<{ statistics: DailyStatistics }>();
</script>
<template>
  <section class="statistics-summary" aria-label="每日学习统计">
    <div class="statistics-grid">
      <div><strong>{{ statistics.completedCount }}</strong><span>完成词数</span></div>
      <div><strong>{{ statistics.trainingCount }}</strong><span>训练次数</span></div>
      <div><strong>{{ statistics.answerCount }}</strong><span>已记录作答次数</span></div>
      <div><strong>{{ statistics.studiedCount }}</strong><span>学习词数（去重）</span></div>
      <div><strong>{{ statistics.recalledCount }}</strong><span>回忆完成词数</span></div>
      <div><strong>{{ statistics.newCompletedCount }}</strong><span>新词完成</span></div>
      <div><strong>{{ statistics.reviewCompletedCount }}</strong><span>复习完成</span></div>
      <div><strong>{{ statistics.unfamiliarCount }}</strong><span>已答仍不熟悉</span></div>
    </div>
    <details class="copy-note"><summary>统计口径</summary><p>仅每日学习。训练包含作答、查看答案、输错和追加练习；作答不含查看答案。学习词数与完成词数各自去重，辅助完成可计入完成；旧每日跟拼记录保留，新的跟拼练习不计入每日进度。不熟悉词数采用服务端测评统计，不从跟拼反馈推断。回忆完成只表示本轮记录，不是永久掌握；更正不增加训练或作答次数。</p></details>
    <StatisticsNotice :complete="statistics.statisticsComplete" :incomplete-word-count="statistics.incompleteWordCount" />
    <p v-if="!statistics.hasLearningActivity && statistics.statisticsComplete" class="subtle-copy">暂无每日学习记录。</p>
  </section>
</template>
