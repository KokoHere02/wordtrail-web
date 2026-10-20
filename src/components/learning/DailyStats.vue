<script setup lang="ts">
import type { DailyTask } from '../../types/daily';
import ProgressBar from '../ui/ProgressBar.vue';
defineProps<{ task: DailyTask }>();
</script>
<template>
  <div class="session-stats live-daily-stats"><div class="session-stat-grid"><div><strong>{{ task.completedCount }} / {{ task.totalCount }}</strong><span>已完成单词</span></div><div><strong>{{ task.answerCount }}</strong><span>作答次数</span></div><div><strong>{{ task.skippedCount }}</strong><span>跳过词数</span></div><div><strong>{{ task.unfamiliarCount }}</strong><span>完成后仍不熟悉</span></div></div><ProgressBar :value="task.completedCount" :max="task.totalCount" label="今日完成进度" /><p class="subtle-copy">本任务目标 {{ task.dailyTarget }} 词 · 跳过不计为完成，任务结束不代表已掌握</p></div>
</template>
