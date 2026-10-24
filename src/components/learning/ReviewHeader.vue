<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useStudySurface } from '../../composables/useStudySurface';
import { ArrowLeft, LogOut } from 'lucide-vue-next';
const props = withDefaults(defineProps<{ completed: number; total: number; skipped?: number; backTo: string; label?: string; description?: string; noun?: string }>(), { noun: '词' });
const remaining = computed(() => Math.max(0, props.total - props.completed - (props.skipped || 0)));
const percent = computed(() => props.total > 0 ? Math.min(100, Math.max(0, props.completed / props.total * 100)) : 0);
const surface = useStudySurface();
watchEffect(() => { if (surface) Object.assign(surface.state, { completed: props.completed, total: props.total, remaining: remaining.value, noun: props.noun }); });
</script>
<template>
  <header v-if="!surface" class="learning-header">
    <div class="learning-toolbar"><RouterLink :to="backTo" class="learning-back"><ArrowLeft :size="18" />返回</RouterLink><RouterLink :to="backTo" class="learning-exit" aria-label="退出本轮学习"><LogOut :size="18" />退出学习</RouterLink></div>
    <div class="learning-progress study-progress" :aria-label="label || '学习进度'">
      <div class="progress-track" role="progressbar" :aria-label="`${label || '学习'}已完成${noun}数`" :aria-valuenow="completed" :aria-valuemax="total || 1" :aria-valuetext="`完成 ${completed} / ${total} ${noun}，剩余 ${remaining} ${noun}`"><span :style="{ width: `${percent}%` }" /></div>
      <span class="review-progress-count">{{ completed }} / {{ total || '—' }} <span class="learning-remaining" :title="skipped ? '剩余词数不含已跳过单词' : undefined">· 剩余 {{ remaining }} {{ noun }}</span></span>
    </div>
    <p v-if="description" class="sr-only">{{ description }}</p>
  </header>
</template>
