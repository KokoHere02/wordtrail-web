<script setup lang="ts">
import { AlertCircle, BookOpen, LoaderCircle } from "lucide-vue-next";
defineProps<{
  loading?: boolean;
  error?: string;
  empty?: boolean;
  message?: string;
}>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div
    v-if="loading || error || empty"
    class="state-panel"
    :role="error ? 'alert' : 'status'"
    :aria-live="error ? 'assertive' : 'polite'"
  >
    <LoaderCircle v-if="loading" class="spin" :size="25" /><AlertCircle
      v-else-if="error"
      :size="25"
    /><BookOpen v-else :size="28" />
    <p>
      {{ loading ? "正在整理词页…" : error || message || "这里还没有内容" }}
    </p>
    <button v-if="error" class="text-button" @click="$emit('retry')">
      重新加载
    </button>
  </div>
</template>
