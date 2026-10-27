<script setup lang="ts">
import { onMounted, onActivated, onDeactivated, ref, watch } from 'vue';
import { Volume2 } from 'lucide-vue-next';
import { useAudioPlayer } from '../../composables/useAudioPlayer';
import { ordinaryAudioUrl } from '../../api/learningMedia';
import { usePronunciation } from '../../stores/pronunciation';
import { useStudySurface } from '../../composables/useStudySurface';
import { errorMessage } from '../../api/http';
const props = defineProps<{ word: string; wordId?: number; phonetic?: string | null; wordKey?: string | number }>();
const { play, stop, speaking, error, loading } = useAudioPlayer();
const active = ref(true);
onActivated(() => { active.value = true; }); onDeactivated(() => { active.value = false; });
const settings = usePronunciation(), surface = useStudySurface();
function pronounce() { if (active.value && props.wordId && !loading.value && surface?.active.value !== false) void play(ordinaryAudioUrl(props.wordId), settings.value); }
onMounted(() => { void settings.load().catch(e => { error.value = errorMessage(e); }); });
watch(() => surface?.active.value, active => { if (active === false) stop(); });
watch(() => settings.value, stop, { deep: true });
watch(() => [props.word, props.wordId, props.wordKey], () => { stop(); error.value = ''; });
defineExpose({ pronounce });
</script>
<template>
  <div class="review-pronunciation">
    <div class="review-phonetic-row"><span v-if="phonetic" class="review-phonetic">{{ phonetic }}</span><button type="button" class="review-audio" :aria-label="`朗读 ${word}`" aria-keyshortcuts="P" :aria-pressed="speaking" :disabled="!wordId || loading" :title="speaking ? '正在朗读' : '朗读单词（P）'" @click="pronounce"><Volume2 :size="23" :stroke-width="1.7" /></button></div>
    <p v-if="error" class="speech-error" role="status">{{ error }}</p>
  </div>
</template>
