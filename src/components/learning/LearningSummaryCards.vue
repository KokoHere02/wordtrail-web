<script setup lang="ts">
import type { LearningSummary } from '../../types/insights';
import ProgressBar from '../ui/ProgressBar.vue';
import LearningCoverageNotice from './LearningCoverageNotice.vue';
defineProps<{ summary: LearningSummary }>();
const taskLabels = { IN_PROGRESS: '当前任务进行中', COMPLETED: '当前任务已结束', ABANDONED: '当前任务已放弃' };
</script>
<template>
  <div class="learning-summary">
    <section v-if="summary.source === 'DAILY' && summary.goal" class="insights-goal" aria-label="每日目标进度"><div class="insights-goal-heading"><h3>每日目标</h3><span>{{ summary.goal.targetSource === 'TASK_SNAPSHOT' ? '使用当前任务目标快照' : '使用当前设置目标' }}</span></div><div class="insights-goal-progress"><strong>{{ summary.goal.completedCount }} <small>/ {{ summary.goal.dailyTarget }} 词</small></strong><span class="insights-goal-reached">{{ summary.goal.reached ? '已达到每日目标' : `剩余目标 ${summary.goal.remainingCount} 词` }}</span></div><ProgressBar :value="Math.min(summary.goal.completedCount, summary.goal.dailyTarget)" :max="summary.goal.dailyTarget" :aria-valuetext="`完成 ${summary.goal.completedCount} 词，目标 ${summary.goal.dailyTarget} 词`" label="每日目标进度" /><div class="insights-goal-status"><span>{{ summary.goal.taskStatus ? taskLabels[summary.goal.taskStatus] : '今日尚未创建任务' }}</span><RouterLink to="/today" class="violet-link">查看今日任务</RouterLink></div></section>
    <p v-else-if="summary.source === 'PRACTICE'" class="insights-practice-note">仅展示历史认读专项记录，不抵扣每日目标。</p><p v-else class="insights-practice-note">接口尚未提供每日目标信息。</p>
    <LearningCoverageNotice :coverage="summary.coverage" />
  </div>
</template>
