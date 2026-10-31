<script setup lang="ts">
import PronunciationSettings from './PronunciationSettings.vue';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { AudioLines, Eye, Languages, Settings2, Volume2, X } from 'lucide-vue-next';
import { useStudyPreferences } from '../../stores/studyPreferences';
import type { StudyMode } from '../../composables/useStudySurface';
import { usePronunciation } from '../../stores/pronunciation';
import { errorMessage } from '../../api/http';

defineProps<{ mode: StudyMode; blocked: boolean; meaningVisible?: boolean; canToggleMeaning?: boolean; canPronounce?: boolean; speaking?: boolean; allowFollow?: boolean; independentFollow?: boolean; wordVisible?: boolean; canToggleWord?: boolean }>();
const emit = defineEmits<{ mode: [value: Exclude<StudyMode, 'sentences'>]; meaning: []; word: []; pronounce: [] }>();
const preferences = useStudyPreferences();
const pronunciation = usePronunciation(), accentBusy = ref(false), accentError = ref('');
async function selectAccent(accent: 'US' | 'UK') {
  if (!pronunciation.loaded || accentBusy.value || pronunciation.value.accent === accent) return;
  accentBusy.value = true; accentError.value = '';
  try { await pronunciation.save({ ...pronunciation.value, accent }); }
  catch (e) { accentError.value = errorMessage(e); }
  finally { accentBusy.value = false; }
}
const open = ref(false), root = ref<HTMLElement>(), settingsButton = ref<HTMLButtonElement>();
const modes = [
  { id: 'recognition' as const, label: '单词拼读', description: '看单词，回想中文含义' },
  { id: 'dictation' as const, label: '单词默写', description: '看中文，独立输入英文' },
  { id: 'listen' as const, label: '听音默写', description: '只听发音，独立输入英文' },
  { id: 'spelling' as const, label: '跟拼', description: '对照单词，练习键盘拼写' },
];
function outside(event: PointerEvent) { if (event.target instanceof Node && !root.value?.contains(event.target)) open.value = false; }
function escape(event: KeyboardEvent) { if (event.key === 'Escape' && open.value) { event.stopPropagation(); open.value = false; settingsButton.value?.focus(); } }
function closeSettings() { open.value = false; }
defineExpose({ closeSettings });
onMounted(() => { document.addEventListener('pointerdown', outside); void pronunciation.load().catch(e => { accentError.value = errorMessage(e); }); });
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
</script>
<template>
  <div ref="root" class="word-practice-toolbar" @keydown="escape">
    <div class="word-practice-tools" role="group" aria-label="单词练习工具">
      <button v-if="wordVisible !== undefined" type="button" class="workspace-icon-button" aria-label="显示英文拼写" :aria-pressed="wordVisible" :disabled="!canToggleWord" :title="wordVisible ? '隐藏英文拼写' : '显示英文拼写'" @click="emit('word')"><Eye :size="20" :stroke-width="1.7" /></button>
      <button type="button" class="workspace-icon-button" aria-label="显示中文释义" :aria-pressed="!!meaningVisible" :disabled="!canToggleMeaning" :title="meaningVisible ? '隐藏中文释义' : '显示中文释义'" @click="emit('meaning')"><Languages :size="20" :stroke-width="1.7" /></button>
      <button type="button" class="workspace-icon-button" aria-label="显示音标" :aria-pressed="preferences.showPhonetic" :disabled="wordVisible === false" :title="preferences.showPhonetic ? '隐藏音标' : '显示音标'" @click="preferences.showPhonetic = !preferences.showPhonetic"><AudioLines :size="20" :stroke-width="1.7" /></button>
      <button type="button" class="workspace-icon-button" aria-label="朗读单词" aria-keyshortcuts="P Alt+P" :aria-pressed="!!speaking" :disabled="!canPronounce" :title="canPronounce ? '朗读单词（P 或 Alt + P）' : '当前题目未提供英文，查看答案后可朗读'" @click="emit('pronounce')"><Volume2 :size="20" :stroke-width="1.7" /></button>
      <button type="button" class="workspace-icon-button" aria-label="美式发音" title="美式发音" :aria-pressed="pronunciation.loaded && pronunciation.value.accent === 'US'" :disabled="!pronunciation.loaded || accentBusy" @click="selectAccent('US')">美</button>
      <button type="button" class="workspace-icon-button" aria-label="英式发音" title="英式发音" :aria-pressed="pronunciation.loaded && pronunciation.value.accent === 'UK'" :disabled="!pronunciation.loaded || accentBusy" @click="selectAccent('UK')">英</button>
      <span class="word-practice-tool-divider" aria-hidden="true" />
      <button ref="settingsButton" type="button" class="workspace-icon-button" aria-label="练习设置" :aria-expanded="open" aria-controls="word-practice-settings" title="练习设置" @click="open = !open"><Settings2 :size="20" :stroke-width="1.7" /></button>
    </div>
    <p v-if="accentError" class="inline-error" role="alert">{{ accentError }}</p>
    <section v-if="open" id="word-practice-settings" class="word-practice-settings" aria-label="练习设置面板">
      <header><h2>练习设置</h2><button type="button" class="workspace-icon-button" aria-label="关闭练习设置" @click="open = false; settingsButton?.focus()"><X :size="18" /></button></header>
      <fieldset class="word-practice-modes" :disabled="blocked"><legend>练习方式</legend><label v-for="entry in modes.filter(entry => allowFollow || entry.id !== 'spelling')" :key="entry.id" :class="{ 'is-selected': mode === entry.id }"><input :id="`word-mode-${entry.id}`" type="radio" name="word-practice-mode" :value="entry.id" :checked="mode === entry.id" @change="emit('mode', entry.id)" /><span><strong>{{ entry.label }}</strong><small>{{ independentFollow && entry.id === 'spelling' ? '练习拼写，不计入每日学习进度' : entry.description }}</small></span></label></fieldset>
      <p class="word-practice-settings-note">{{ independentFollow ? '跟拼只记录练习，不计入每日学习进度。' : '切换方式共用进度，保留未提交的输入。' }}</p>
      <slot name="practice-settings" />
      <PronunciationSettings hide-accent />
    </section>
  </div>
</template>
