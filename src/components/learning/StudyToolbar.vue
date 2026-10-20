<script setup lang="ts">
import { ChevronDown, Settings, Volume2 } from "lucide-vue-next";
import { ref, watch } from "vue";
import { usePreviewStore } from "../../stores/preview";
defineProps<{ mode: "memory" | "dictation"; speaking?: boolean }>();
const emit = defineEmits<{ speak: []; hint: [value: "none" | "first"] }>();
const store = usePreviewStore();
const hint = ref<"none" | "first">("none");
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
    <span class="toolbar-divider" /><label class="toolbar-select"
      ><span class="sr-only">发音口音</span
      ><select v-model="store.accent">
        <option value="en-US">美音</option>
        <option value="en-GB">英音</option></select
      ><ChevronDown :size="14" /></label
    ><template v-if="mode === 'dictation'"
      ><span class="toolbar-divider" /><label class="toolbar-select hint-select"
        ><span class="sr-only">默写提示</span
        ><select v-model="hint">
          <option value="none">隐藏全部</option>
          <option value="first">提示首字母</option></select
        ><ChevronDown :size="14" /></label></template
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
