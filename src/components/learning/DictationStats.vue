<script setup lang="ts">
import type { DictationTask } from '../../types/dictation';
defineProps<{ task: DictationTask }>();
</script>
<template>
  <dl class="dictation-stats" aria-label="默写本轮统计"><div><dt>不同词数</dt><dd>{{ task.totalCount }}</dd></div><div><dt>完成词数</dt><dd>{{ task.completedCount }}</dd></div><div><dt>通过词数</dt><dd>{{ task.passedCount }}</dd></div><div><dt>仍需巩固词数</dt><dd>{{ task.needsPracticeCount }}</dd></div><div><dt>尝试次数</dt><dd>{{ task.attemptCount }}</dd></div></dl>
</template>
