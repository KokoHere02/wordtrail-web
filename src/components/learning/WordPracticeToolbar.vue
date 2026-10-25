<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { AudioLines, Languages, Settings2, Volume2, X } from 'lucide-vue-next';
import { useStudyPreferences } from '../../stores/studyPreferences';
import type { StudyMode } from '../../composables/useStudySurface';

defineProps<{ mode: StudyMode; blocked: boolean; meaningVisible?: boolean; canToggleMeaning?: boolean; canPronounce?: boolean; speaking?: boolean; settingsExpanded: boolean }>();
const emit = defineEmits<{ mode: [value: Exclude<StudyMode, 'sentences'>]; meaning: []; pronounce: []; settings: [] }>();
const preferences = useStudyPreferences();
const open = ref(false), root = ref<HTMLElement>(), settingsButton = ref<HTMLButtonElement>();
const modes = [
  { id: 'recognition' as const, label: '单词拼读', description: '看单词，回想中文含义' },
  { id: 'dictation' as const, label: '单词默写', description: '看中文，独立输入英文' },
  { id: 'spelling' as const, label: '跟拼', description: '对照单词，练习键盘拼写' },
];
function outside(event: PointerEvent) { if (event.target instanceof Node && !root.value?.contains(event.target)) open.value = false; }
function escape(event: KeyboardEvent) { if (event.key === 'Escape' && open.value) { event.stopPropagation(); open.value = false; settingsButton.value?.focus(); } }
onMounted(() => document.addEventListener('pointerdown', outside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
</script>
<template>
  <div ref="root" class="word-practice-toolbar" @keydown="escape">
    <div class="word-practice-tools" role="group" aria-label="单词练习工具">
      <button type="button" class="workspace-icon-button" aria-label="显示中文释义" :aria-pressed="!!meaningVisible" :disabled="!canToggleMeaning" :title="meaningVisible ? '隐藏中文释义' : '显示中文释义'" @click="emit('meaning')"><Languages :size="20" :stroke-width="1.7" /></button>
      <button type="button" class="workspace-icon-button" aria-label="显示音标" :aria-pressed="preferences.showPhonetic" :title="preferences.showPhonetic ? '隐藏音标' : '显示音标'" @click="preferences.showPhonetic = !preferences.showPhonetic"><AudioLines :size="20" :stroke-width="1.7" /></button>
      <button type="button" class="workspace-icon-button" aria-label="朗读单词" :aria-pressed="!!speaking" :disabled="!canPronounce" :title="canPronounce ? '朗读单词（P）' : '当前题目未提供英文，查看答案后可朗读'" @click="emit('pronounce')"><Volume2 :size="20" :stroke-width="1.7" /></button>
      <span class="word-practice-tool-divider" aria-hidden="true" />
      <button ref="settingsButton" type="button" class="workspace-icon-button" aria-label="练习设置" :aria-expanded="open" aria-controls="word-practice-settings" title="练习设置" @click="open = !open"><Settings2 :size="20" :stroke-width="1.7" /></button>
    </div>
    <section v-if="open" id="word-practice-settings" class="word-practice-settings" aria-label="练习设置面板">
      <header><h2>练习设置</h2><button type="button" class="workspace-icon-button" aria-label="关闭练习设置" @click="open = false; settingsButton?.focus()"><X :size="18" /></button></header>
      <fieldset class="word-practice-modes" :disabled="blocked"><legend>练习方式</legend><label v-for="entry in modes" :key="entry.id" :class="{ 'is-selected': mode === entry.id }"><input :id="`word-mode-${entry.id}`" type="radio" name="word-practice-mode" :value="entry.id" :checked="mode === entry.id" @change="emit('mode', entry.id)" /><span><strong>{{ entry.label }}</strong><small>{{ entry.description }}</small></span></label></fieldset>
      <p class="word-practice-settings-note">切换方式共用进度，保留未提交的输入。</p>
      <div class="word-practice-preferences"><label><span>自动朗读单词</span><input v-model="preferences.autoPronounce" type="checkbox" role="switch" /></label><label><span>发音口音</span><select v-model="preferences.accent" aria-label="发音口音"><option value="en-US">美式发音</option><option value="en-GB">英式发音</option></select></label></div>
      <button type="button" class="word-practice-more" :aria-expanded="settingsExpanded" @click="emit('settings'); open = false">学习计划与任务设置 <span aria-hidden="true">→</span></button>
    </section>
  </div>
</template>
