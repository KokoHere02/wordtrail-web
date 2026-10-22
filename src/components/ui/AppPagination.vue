<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
const props = defineProps<{
  page: number;
  size: number;
  total: number;
  disabled?: boolean;
  numbered?: boolean;
  noun?: string;
}>();
defineEmits<{ change: [page: number] }>();
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.size)));
const visiblePages = computed(() => {
  const start = Math.max(1, Math.min(props.page - 1, pages.value - 2));
  return Array.from({ length: Math.min(3, pages.value) }, (_, index) => start + index);
});
</script>
<template>
  <nav class="pagination" aria-label="分页">
    <span
      >共 {{ total }} {{ noun || '条' }}<span v-if="!numbered" class="desktop-inline">
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
      ><template v-if="numbered"><button v-for="value in visiblePages" :key="value" :class="['page-button', { 'is-current': value === page }]" :aria-label="`第 ${value} 页`" :aria-current="value === page ? 'page' : undefined" :disabled="disabled || value === page" @click="$emit('change', value)">{{ value }}</button></template><span v-else class="page-label">{{ page }} / {{ pages }}</span><button
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
