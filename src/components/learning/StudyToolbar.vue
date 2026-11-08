<script setup lang="ts">
import { Settings, Volume2 } from "lucide-vue-next";
import { ref, watch } from "vue";
import { usePreviewStore } from "../../stores/preview";
import AppSelect from '../ui/AppSelect.vue';
defineProps<{ mode: "memory" | "dictation"; speaking?: boolean }>();
const emit = defineEmits<{ speak: []; hint: [value: "none" | "first"] }>();
const store = usePreviewStore();
const hint = ref<"none" | "first">("none");
const accents: { value: 'en-US' | 'en-GB'; label: string }[] = [{ value: 'en-US', label: '美音' }, { value: 'en-GB', label: '英音' }];
const hints: { value: 'none' | 'first'; label: string }[] = [{ value: 'none', label: '隐藏全部' }, { value: 'first', label: '提示首字母' }];
watch(hint, (value) => emit("hint", value));
</script>
<template>
  <div class="study-toolbar">
    <div class="mode-switch">
      <span
        class="mode-slider"
        :class="{ right: mode === 'dictation' }"
      /><RouterLink to="/learn" :class="{ active: mode === 'memory' }"
        >记忆</RouterLink
      ><RouterLink to="/dictation" :class="{ active: mode === 'dictation' }"
        >默写</RouterLink
      >
    </div>
    <span class="toolbar-divider" /><AppSelect v-model="store.accent" class="preview-toolbar-select" label="发音口音" :options="accents" hide-label animated
    /><template v-if="mode === 'dictation'"
      ><span class="toolbar-divider" /><AppSelect v-model="hint" class="preview-toolbar-select preview-hint-select" label="默写提示" :options="hints" hide-label animated /></template
    ><span class="toolbar-divider" v-if="mode === 'dictation'" /><button
      :class="['round-icon', { 'is-speaking': speaking }]"
      aria-label="播放发音"
      @click="$emit('speak')"
    >
      <Volume2 :size="21" /></button
    ><button
      v-if="mode === 'memory'"
      class="round-icon"
      aria-label="学习设置"
      @click="store.settingsOpen = true"
    >
      <Settings :size="20" />
    </button>
  </div>
</template>

<style scoped>
.preview-toolbar-select { flex: none; width: 74px; }
.preview-hint-select { width: 108px; }
.preview-toolbar-select :deep(.app-select-trigger) { min-height: 34px; padding: 5px 7px; border-color: transparent; background: transparent; font-size: 14px; }
.preview-toolbar-select :deep(.app-select-trigger:hover) { background: var(--hover); }
.preview-toolbar-select :deep(.app-select-options) { left: auto; width: max-content; min-width: 100%; }
@media (max-width: 600px) { .preview-toolbar-select { width: 62px; } .preview-hint-select { width: 90px; } .preview-toolbar-select :deep(.app-select-trigger) { min-height: 30px; padding: 4px; font-size: 12px; } }
</style>
