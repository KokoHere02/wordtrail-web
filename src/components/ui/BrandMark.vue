<script setup lang="ts">
defineProps<{ compact?: boolean }>();
</script>
<template>
  <RouterLink to="/today" class="wordory-brand" aria-label="拾词今日首页"
    ><span class="brand-cube" aria-hidden="true"><span>W</span></span
    ><span v-if="!compact" class="brand-wordmark"
      ><strong>拾词</strong><small>WORDORY</small></span
    ></RouterLink
  >
</template>
