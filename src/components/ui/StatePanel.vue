<script setup lang="ts">
import { BookOpen, LoaderCircle } from "lucide-vue-next";
import AppAlert from './AppAlert.vue';
defineProps<{
  loading?: boolean;
  error?: string;
  empty?: boolean;
  message?: string;
}>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <AppAlert v-if="!loading && error" :message="error"><template #actions><button class="text-button" @click="$emit('retry')">重新加载</button></template></AppAlert>
  <div
    v-else-if="loading || empty"
    class="state-panel"
    role="status"
    aria-live="polite"
  >
    <LoaderCircle v-if="loading" class="spin" :size="25" /><BookOpen v-else :size="28" />
    <p>
      {{ loading ? "正在整理词页…" : message || "这里还没有内容" }}
    </p>
  </div>
</template>
