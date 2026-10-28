<script setup lang="ts">
import type { LearningSummary } from '../../types/insights';
import ProgressBar from '../ui/ProgressBar.vue';
import LearningCoverageNotice from './LearningCoverageNotice.vue';
defineProps<{ summary: LearningSummary }>();
const taskLabels = { IN_PROGRESS: '当前任务进行中', COMPLETED: '当前任务已结束', ABANDONED: '当前任务已放弃' };
</script>
<template>
  <div class="learning-summary">
    <div class="insights-summary-heading"><h2>学习概览</h2><span>{{ summary.learningDate }} · {{ summary.source === 'DAILY' ? '每日学习' : '历史认读专项' }}</span></div>
    <div class="insights-streak-grid" aria-label="本来源连续学习"><div><strong>{{ summary.currentStreak }}</strong><span>当前连续 · 天</span></div><div><strong>{{ summary.longestStreak }}</strong><span>最长连续 · 天</span></div><div><strong>{{ summary.totalStudyDays }}</strong><span>累计学习 · 天</span></div></div>
    <div class="insights-today"><span :class="['insights-today-status', { recorded: summary.hasStudiedToday }]">{{ summary.hasStudiedToday ? '今日已有学习记录' : '今日尚无学习活动' }}</span><div class="insights-today-counts"><span>训练次数 <strong>{{ summary.todayTrainingCount }}</strong></span><span>作答次数 <strong>{{ summary.todayAnswerCount }}</strong></span><span>学习词数 <strong>{{ summary.todayStudiedCount }}</strong></span><span>完成词数 <strong>{{ summary.todayCompletedCount }}</strong></span><span v-if="summary.source === 'DAILY'">回忆完成 <strong>{{ summary.todayRecalledCount }}</strong></span></div></div>
    <section v-if="summary.source === 'DAILY' && summary.goal" class="insights-goal" aria-label="每日目标进度"><div class="insights-goal-heading"><h3>每日目标</h3><span>{{ summary.goal.targetSource === 'TASK_SNAPSHOT' ? '使用当前任务目标快照' : '使用当前设置目标' }}</span></div><div class="insights-goal-progress"><strong>{{ summary.goal.completedCount }} <small>/ {{ summary.goal.dailyTarget }} 词</small></strong><span class="insights-goal-reached">{{ summary.goal.reached ? '已达到每日目标' : `剩余目标 ${summary.goal.remainingCount} 词` }}</span></div><ProgressBar :value="Math.min(summary.goal.completedCount, summary.goal.dailyTarget)" :max="summary.goal.dailyTarget" :aria-valuetext="`完成 ${summary.goal.completedCount} 词，目标 ${summary.goal.dailyTarget} 词`" label="每日目标进度" /><div class="insights-goal-status"><span>{{ summary.goal.taskStatus ? taskLabels[summary.goal.taskStatus] : '今日尚未创建任务' }}</span><RouterLink to="/today" class="violet-link">查看今日任务</RouterLink></div></section>
    <p v-else-if="summary.source === 'PRACTICE'" class="insights-practice-note">仅展示历史认读专项记录，不抵扣每日目标。</p><p v-else class="insights-practice-note">接口尚未提供每日目标信息。</p>
    <LearningCoverageNotice :coverage="summary.coverage" />
  </div>
</template>
