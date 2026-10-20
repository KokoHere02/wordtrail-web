<script setup lang="ts">
defineProps<{ complete: boolean; incompleteWordCount?: number }>();
</script>
<template>
  <p v-if="!complete" class="live-notice statistics-warning" role="status">
    部分学习事件缺失或记录不一致，统计不完整<span v-if="incompleteWordCount !== undefined">（{{ incompleteWordCount }} 个词）</span>。作答次数仅包含已记录的正常作答，不能据此推断没有学习。
  </p>
</template>
