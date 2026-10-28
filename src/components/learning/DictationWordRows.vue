<script setup lang="ts">
import { ref } from 'vue';
import type { DictationWord } from '../../types/dictation';
import WordMeaning from '../word/WordMeaning.vue';
import WordHistoryDialog from './WordHistoryDialog.vue';
defineProps<{ records: DictationWord[]; selectable?: boolean; selected?: ReadonlySet<number>; disabled?: boolean }>();
defineEmits<{ toggle: [wordId: number, checked: boolean] }>();
const historyWord = ref<DictationWord>();
const historyOpen = ref(false);
const labels = { CORRECT: '正确', INCORRECT: '错误', REVEALED: '未答' };
</script>
<template>
  <div class="dictation-word-rows"><article v-for="word in records" :key="word.itemId" :class="['dictation-word-row', { selectable }]">
    <input v-if="selectable" type="checkbox" :checked="selected?.has(word.wordId)" :disabled="disabled" :aria-label="`选择默写错词 ${word.word}`" @change="$emit('toggle', word.wordId, ($event.target as HTMLInputElement).checked)" />
    <div class="dictation-word-copy"><strong lang="en">{{ word.word }}</strong><WordMeaning :translation="word.translation" :translation-groups="word.translationGroups" /></div>
    <div class="dictation-word-feedback"><p>{{ labels[word.lastVerdict] }} · 提交记录 {{ word.attemptCount }} 次</p><p class="dictation-last-input">{{ word.lastInput === null ? '未作答' : `原输入：${word.lastInput}` }}</p><small>{{ word.answeredAt.replace('T', ' ') }}</small></div>
    <button class="muted-link" @click="historyWord = word; historyOpen = true">默写历史</button>
  </article><WordHistoryDialog v-model="historyOpen" :word-id="historyWord?.wordId ?? null" :word="historyWord?.word || ''" initial-mode="DICTATION" /></div>
</template>
