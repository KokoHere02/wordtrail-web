<script lang="ts">
const dialogStack: symbol[] = [];
let bodyOverflowBeforeDialogs = '';
</script>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { X } from "lucide-vue-next";
const props = defineProps<{
  modelValue: boolean;
  title: string;
  description?: string;
  panelClass?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const panel = ref<HTMLElement>();
const dialogId = Symbol('dialog');
let previousFocus: HTMLElement | null = null;
function release() {
  const index = dialogStack.indexOf(dialogId);
  if (index < 0) return;
  dialogStack.splice(index, 1);
  if (!dialogStack.length) document.body.style.overflow = bodyOverflowBeforeDialogs;
}
function close() {
  emit("update:modelValue", false);
}
function keyboard(event: KeyboardEvent) {
  if (!props.modelValue || dialogStack.at(-1) !== dialogId) return;
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
  if (event.key === "Tab") {
    const items = panel.value?.querySelectorAll<HTMLElement>(
      "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
    );
    if (!items?.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
watch(
  () => props.modelValue,
  async (open, previousOpen) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null;
      document.addEventListener("keydown", keyboard);
      if (!dialogStack.length) bodyOverflowBeforeDialogs = document.body.style.overflow;
      if (!dialogStack.includes(dialogId)) dialogStack.push(dialogId);
      document.body.style.overflow = "hidden";
      await nextTick();
      (
        panel.value?.querySelector<HTMLElement>("input:not(:disabled),textarea:not(:disabled)") ||
        panel.value?.querySelector<HTMLElement>("button")
      )?.focus();
    } else if (previousOpen) {
      document.removeEventListener("keydown", keyboard);
      const wasTop = dialogStack.at(-1) === dialogId;
      release();
      if (wasTop && previousFocus?.isConnected) previousFocus.focus();
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  document.removeEventListener("keydown", keyboard);
  const wasTop = dialogStack.at(-1) === dialogId;
  release();
  if (wasTop && previousFocus?.isConnected) previousFocus.focus();
});
</script>
<template>
  <Teleport to="body"
    ><Transition name="dialog"
      ><div v-if="modelValue" class="dialog-backdrop" @click.self="close">
        <section
          ref="panel"
          :class="['dialog-panel', panelClass]"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header>
            <div>
              <h2>{{ title }}</h2>
              <p v-if="description">{{ description }}</p>
            </div>
            <button class="round-icon" aria-label="关闭弹窗" @click="close">
              <X :size="20" />
            </button>
          </header>
          <slot />
        </section></div></Transition
  ></Teleport>
</template>
