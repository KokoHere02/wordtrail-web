<script setup lang="ts">
import type { DictationTask } from '../../types/dictation';
const props = defineProps<{ task: DictationTask }>();
const score = (value: number | null) => props.task.singleAttempt && props.task.status !== 'COMPLETED' || value == null ? '未公布' : value;
const accuracy = () => props.task.singleAttempt !== true ? '—' : props.task.status !== 'COMPLETED' || props.task.accuracy == null ? '未公布' : new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 }).format(props.task.accuracy);
</script>
<template>
  <dl class="dictation-stats" aria-label="默写本轮统计"><div><dt>题目数</dt><dd>{{ task.totalCount }}</dd></div><div><dt>已提交</dt><dd>{{ task.completedCount }}</dd></div><div><dt>{{ task.singleAttempt ? '正确题数' : '旧版通过词数' }}</dt><dd>{{ score(task.passedCount) }}</dd></div><div><dt>错误／未答</dt><dd>{{ score(task.needsPracticeCount) }}</dd></div><div><dt>提交次数</dt><dd>{{ task.attemptCount }}</dd></div><div><dt>正确率</dt><dd>{{ accuracy() }}</dd></div></dl>
</template>
