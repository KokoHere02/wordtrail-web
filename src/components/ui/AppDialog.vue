<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { X } from "lucide-vue-next";
const props = defineProps<{
  modelValue: boolean;
  title: string;
  description?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const panel = ref<HTMLElement>();
let previousFocus: HTMLElement | null = null;
function close() {
  emit("update:modelValue", false);
}
function keyboard(event: KeyboardEvent) {
  if (!props.modelValue) return;
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
  if (event.key === "Tab") {
    const items = panel.value?.querySelectorAll<HTMLElement>(
      "button:not(:disabled),input,select,textarea,a[href]",
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
      document.body.style.overflow = "hidden";
      await nextTick();
      (
        panel.value?.querySelector<HTMLElement>("input") ||
        panel.value?.querySelector<HTMLElement>("button")
      )?.focus();
    } else if (previousOpen) {
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = "";
      previousFocus?.focus();
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  document.removeEventListener("keydown", keyboard);
  document.body.style.overflow = "";
});
</script>
<template>
  <Teleport to="body"
    ><Transition name="dialog"
      ><div v-if="modelValue" class="dialog-backdrop" @click.self="close">
        <section
          ref="panel"
          class="dialog-panel"
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
