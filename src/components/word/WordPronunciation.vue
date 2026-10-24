<script setup lang="ts">
import { watch } from 'vue';
import { Volume2 } from 'lucide-vue-next';
import { useWordSpeech } from '../../composables/useWordSpeech';
const props = defineProps<{ word: string; phonetic?: string | null; wordKey?: string | number }>();
const { speak, stop, speaking, error } = useWordSpeech();
function pronounce() { speak(props.word); }
watch(() => [props.word, props.wordKey], () => { stop(); error.value = ''; });
defineExpose({ pronounce });
</script>
<template>
  <div class="review-pronunciation">
    <div class="review-phonetic-row"><span v-if="phonetic" class="review-phonetic">{{ phonetic }}</span><button type="button" class="review-audio" :aria-label="`朗读 ${word}`" aria-keyshortcuts="P" :aria-pressed="speaking" :title="speaking ? '正在朗读' : '朗读单词（P）'" @click="pronounce"><Volume2 :size="23" :stroke-width="1.7" /></button></div>
    <p v-if="error" class="speech-error" role="status">{{ error }}</p>
  </div>
</template>
