<script setup lang="ts">
import type { DailyTask } from '../../types/daily';
import ProgressBar from '../ui/ProgressBar.vue';
defineProps<{ task: DailyTask }>();
</script>
<template>
  <section class="daily-record-stats" aria-label="学习概况">
    <div class="daily-record-progress">
      <span>完成单词</span>
      <strong>{{ task.completedCount }} <small>/ {{ task.totalCount }}</small></strong>
      <ProgressBar :value="task.completedCount" :max="task.totalCount" label="本次学习完成进度" />
      <span v-if="task.skippedCount" class="daily-record-skipped">跳过 {{ task.skippedCount }} 词</span>
    </div>
    <dl class="daily-record-counts">
      <div><dt>新词</dt><dd>{{ task.newCount }}<small>词</small></dd></div>
      <div><dt>复习</dt><dd>{{ task.reviewCount }}<small>词</small></dd></div>
      <div v-if="task.trainingCount != null"><dt>练习次数</dt><dd>{{ task.trainingCount }}<small>次</small></dd></div>
    </dl>
  </section>
</template>
<style scoped>
.daily-record-stats { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--s10); padding: var(--s8); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); }
.daily-record-progress { display: flex; flex-direction: column; gap: var(--s3); color: var(--muted); font-size: var(--text-sm); }
.daily-record-progress > strong { color: var(--accent); font-size: 42px; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; }
.daily-record-progress strong small { color: var(--muted); font-size: var(--text-xl); font-weight: 400; }
.daily-record-counts { display: flex; align-items: center; justify-content: space-around; gap: var(--s4); border-left: 1px solid var(--line); padding-left: var(--s6); margin: 0; }
.daily-record-counts dt { color: var(--muted); font-size: var(--text-sm); margin-bottom: var(--s3); }
.daily-record-counts dd { margin: 0; font-size: 28px; font-variant-numeric: tabular-nums; }
.daily-record-counts small { font-size: var(--text-sm); color: var(--muted); margin-left: var(--s1); }
@media (max-width: 640px) {
  .daily-record-stats { grid-template-columns: 1fr; gap: var(--s6); padding: var(--s5); }
  .daily-record-counts { border-left: 0; border-top: 1px solid var(--line); padding: var(--s5) 0 0; justify-content: space-between; }
  .daily-record-progress > strong { font-size: 36px; }
}
</style>
