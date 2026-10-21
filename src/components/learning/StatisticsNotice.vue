<script setup lang="ts">
defineProps<{ complete: boolean; incompleteWordCount?: number }>();
</script>
<template>
  <p v-if="!complete" class="live-notice statistics-warning" role="status">
    统计不完整<span v-if="incompleteWordCount !== undefined">（{{ incompleteWordCount }} 个词）</span>。作答次数仅包含已记录的正常作答。
  </p>
</template>
