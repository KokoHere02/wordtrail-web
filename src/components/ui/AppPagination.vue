<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
const props = defineProps<{
  page: number;
  size: number;
  total: number;
  disabled?: boolean;
}>();
defineEmits<{ change: [page: number] }>();
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.size)));
</script>
<template>
  <nav class="pagination" aria-label="分页">
    <span
      >共 {{ total }} 条<span class="desktop-inline">
        · 每页 {{ size }} 条</span
      ></span
    >
    <div class="flex items-center gap-2">
      <button
        class="page-button"
        aria-label="上一页"
        :disabled="page <= 1 || disabled"
        @click="$emit('change', page - 1)"
      >
        <ChevronLeft :size="16" /></button
      ><span class="page-label">{{ page }} / {{ pages }}</span
      ><button
        class="page-button"
        aria-label="下一页"
        :disabled="page >= pages || disabled"
        @click="$emit('change', page + 1)"
      >
        <ChevronRight :size="16" />
      </button>
    </div>
  </nav>
</template>
