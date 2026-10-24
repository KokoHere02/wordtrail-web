<script setup lang="ts">
import { ref, useId, watch } from 'vue';
import { Eye } from 'lucide-vue-next';
import type { Result } from '../../types/api';
import type { TranslationFields } from '../../types/translation';
import WordMeaning from '../word/WordMeaning.vue';
import WordPronunciation from '../word/WordPronunciation.vue';
const props = defineProps<{
  word: string; phonetic?: string | null; wordKey: string; variant: 'daily' | 'practice';
  visible: boolean; definition?: TranslationFields; revealLoading: boolean; revealError: string;
  busy: boolean; rateDisabled: boolean; result?: Result | null; past: boolean; canCorrect: boolean;
}>();
const emit = defineEmits<{ reveal: []; rate: [result: Result]; correct: [result: 2 | 3] }>();
const pronunciation = ref<InstanceType<typeof WordPronunciation>>();
const meaningId = useId();
const correctionId = useId();
const correctionOpen = ref(false);
watch(() => [props.wordKey, props.result, props.canCorrect], () => { correctionOpen.value = false; });
const choices = [
  { value: 3 as Result, label: '不认识', key: '1', name: 'forgot' },
  { value: 2 as Result, label: '模糊', key: '2', name: 'uncertain' },
  { value: 1 as Result, label: '认识', key: '3', name: 'known' },
];
function openCorrection() { if (props.canCorrect && !props.busy) correctionOpen.value = true; }
function cancelCorrection() { correctionOpen.value = false; }
function rate(result: Result) {
  if (props.busy) return;
  if (correctionOpen.value) {
    if (props.canCorrect && (result === 2 || result === 3)) {
      correctionOpen.value = false;
      emit('correct', result);
    }
  } else if (!props.rateDisabled) emit('rate', result);
}
defineExpose({ pronounce: () => pronunciation.value?.pronounce(), openCorrection, cancelCorrection, rate });
</script>
<template>
  <section class="learning-card" aria-label="当前单词" :aria-busy="busy" :data-word-key="wordKey">
    <p v-if="past" class="learning-past-label" role="status">回看已答单词</p>
    <div class="learning-word-area memory-word-content">
      <div class="memory-title"><h1 :class="[variant === 'practice' ? 'study-word' : 'learning-word', { 'long-word': word.length > 14, 'long-memory-word': word.length > 14 }]" lang="en">{{ word }}</h1></div>
      <WordPronunciation ref="pronunciation" :word="word" :phonetic="phonetic" :word-key="wordKey" />
    </div>
    <div class="learning-reveal-area">
      <button v-if="!visible" type="button" class="reveal-button" aria-keyshortcuts="Space" :aria-controls="meaningId" :disabled="busy" @click="$emit('reveal')"><Eye :size="19" />点击或按 Space 查看释义</button>
      <div v-if="visible" :id="meaningId" class="learning-definition" aria-live="polite">
        <p v-if="revealLoading" class="learning-state">正在加载释义…</p>
        <p v-else-if="revealError" class="learning-state" role="alert">{{ revealError }}<button type="button" class="violet-link" @click="$emit('reveal')">重新加载释义</button></p>
        <WordMeaning v-else-if="definition" :class="variant === 'daily' ? 'memory-meaning' : 'study-meaning'" layout="study" :word-key="wordKey" :translation="definition.translation" :translation-groups="definition.translationGroups" />
        <p v-else class="meaning-placeholder">释义暂未返回</p>
      </div>
    </div>
    <div :class="['learning-rating', 'review-options', variant === 'daily' ? 'recall-options' : 'answer-choices']" role="group" aria-label="你认识这个单词吗">
      <button v-for="choice in choices" :key="choice.value" type="button" :class="['review-answer', variant === 'daily' ? 'recall-card' : 'answer-button', `recall-${choice.name}`, { chosen: result === choice.value, picked: result === choice.value }]" :data-key="choice.key" :aria-keyshortcuts="choice.key" :aria-pressed="result === choice.value" :disabled="rateDisabled" @click="$emit('rate', choice.value)"><span>{{ choice.label }}</span></button>
    </div>
    <div v-if="canCorrect" class="learning-correction">
      <div class="learning-correction-trigger"><button type="button" class="correction-button" aria-keyshortcuts="R" :aria-controls="correctionId" :aria-expanded="correctionOpen" @click="openCorrection">记错了</button><kbd>R</kbd></div>
      <div v-if="correctionOpen" :id="correctionId" class="learning-correction-choices" role="group" aria-label="更正本次反馈">
        <span class="learning-correction-label" role="status">更正为</span>
        <button type="button" class="learning-correction-choice" data-key="1" aria-keyshortcuts="1" @click="rate(3)">改为不认识</button>
        <button type="button" class="learning-correction-choice" data-key="2" aria-keyshortcuts="2" @click="rate(2)">改为模糊</button>
        <button type="button" class="learning-correction-cancel" aria-keyshortcuts="Escape" @click="cancelCorrection">取消 <kbd>Esc</kbd></button>
      </div>
    </div>
  </section>
</template>
