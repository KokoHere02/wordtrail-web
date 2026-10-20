<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ value: number; max: number; label?: string }>();
const percent = computed(() =>
  Math.min(100, Math.max(0, props.max ? (props.value / props.max) * 100 : 0)),
);
</script>
<template>
  <div
    class="violet-progress"
    role="progressbar"
    :aria-label="label || '学习进度'"
    :aria-valuenow="value"
    :aria-valuemin="0"
    :aria-valuemax="max"
  >
    <span :style="{ width: `${percent}%` }" />
  </div>
</template>
