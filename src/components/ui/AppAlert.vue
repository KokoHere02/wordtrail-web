<script setup lang="ts">
import { onBeforeUnmount, ref, useSlots, watch } from 'vue';
import { AlertCircle, X } from 'lucide-vue-next';

const props = withDefaults(defineProps<{ message: string; duration?: number }>(), { duration: 8000 });
const slots = useSlots();
const visible = ref(false);
const hovering = ref(false);
const focused = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

function clearTimer() { if (timer) clearTimeout(timer); timer = undefined; }
function schedule() {
  clearTimer();
  if (visible.value && !hovering.value && !focused.value && props.duration > 0)
    timer = setTimeout(() => { visible.value = false; }, props.duration);
}
function dismiss() { clearTimer(); visible.value = false; }
function onFocusOut(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) { focused.value = false; schedule(); }
}
watch(() => props.message, message => { visible.value = !!message; schedule(); }, { immediate: true });
onBeforeUnmount(clearTimer);
</script>

<template>
  <div v-if="visible || slots.actions" class="app-alert-container">
    <div v-if="visible" class="app-alert" role="alert" @mouseenter="hovering = true; clearTimer()" @mouseleave="hovering = false; schedule()" @focusin="focused = true; clearTimer()" @focusout="onFocusOut">
      <AlertCircle class="app-alert-icon" :size="20" aria-hidden="true" />
      <div class="app-alert-content"><p>{{ message }}</p><slot /></div>
      <button type="button" class="app-alert-close" aria-label="关闭提示" @click="dismiss"><X :size="18" aria-hidden="true" /></button>
    </div>
    <div v-if="slots.actions" class="app-alert-actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.app-alert-container { min-width: 0; margin: var(--s4) 0; }
.app-alert { display: flex; align-items: flex-start; gap: var(--s3); padding: var(--s4); border: 1px solid var(--error-border); border-radius: var(--radius); background: var(--error-bg); color: var(--ink); line-height: 1.6; overflow-wrap: anywhere; }
.app-alert-icon { flex: none; color: var(--error); margin-top: 2px; }
.app-alert-content { flex: 1; min-width: 0; }
.app-alert-content p { margin: 0; }
.app-alert-content :deep(p + p) { margin-top: var(--s2); color: var(--muted); }
.app-alert-close { display: grid; place-items: center; flex: none; width: 32px; height: 32px; margin: -4px -4px -4px 0; padding: 0; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--muted); cursor: pointer; }
.app-alert-close:hover { color: var(--ink); background: var(--hover); }
.app-alert-actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s2) var(--s4); margin-top: var(--s3); }
.app-alert-actions:empty { display: none; }
.app-alert-actions :deep(button), .app-alert-actions :deep(a) { display: inline-flex; align-items: center; min-height: 40px; margin: 0; }
</style>
