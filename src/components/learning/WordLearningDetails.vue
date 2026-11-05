<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { BookOpen, Layers3, Volume2 } from 'lucide-vue-next';
import { errorMessage, request } from '../../api/http';
import { ordinaryAudioUrl } from '../../api/learningMedia';
import { useAudioPlayer } from '../../composables/useAudioPlayer';
import { usePronunciation } from '../../stores/pronunciation';
import WordMeaning from '../word/WordMeaning.vue';
import type { TranslationFields } from '../../types/translation';

const props = defineProps<TranslationFields & { wordId?: number; word?: string; wordKey: number | string }>();
type Form = { form: string; formType: string };
type Sentence = { id: number; englishText: string; referenceTranslation: string };
const forms = ref<Form[]>([]), sentences = ref<Sentence[]>([]);
const formsLoading = ref(false), sentencesLoading = ref(false), formsError = ref(false), sentencesError = ref(false);
type LookupWord = { id: number; word: string; phonetic: string | null; translation: string | null };
const selected = ref<{ sentenceId: number; index: number; text: string } | null>(null);
const lookupResults = ref<LookupWord[]>([]), lookupLoading = ref(false), lookupError = ref(false);
const pronunciation = usePronunciation();
const { play, stop, speaking, loading: audioLoading, error: audioError } = useAudioPlayer();
const audioWordId = ref<number | null>(null);
let audioRequest = 0;
let lookupVersion = 0;
const lookupPanel = ref<HTMLElement | null>(null);
const lookupPosition = ref({ left: 0, top: 0 });
let lookupAnchor: HTMLElement | null = null;
const labels: Record<string, string> = { THIRD_PERSON_SINGULAR: '第三人称单数', PAST: '过去式', PAST_PARTICIPLE: '过去分词', PRESENT_PARTICIPLE: '现在分词', PLURAL: '复数', COMPARATIVE: '比较级', SUPERLATIVE: '最高级' };
const terms = computed(() => [...new Set([props.word, ...forms.value.map(item => item.form)].filter((value): value is string => !!value))].sort((a,b) => b.length-a.length));
function segments(text: string) {
  return text.split(/([a-zA-Z]+(?:['’][a-zA-Z]+)*)/g).filter(Boolean).map(part => ({
    text: part, word: /^[a-zA-Z]/.test(part), match: terms.value.some(term => term.toLowerCase() === part.toLowerCase()),
  }));
}
function stopAudio() { audioRequest++; stop(); audioWordId.value = null; audioError.value = ''; }
function closeLookup() { lookupVersion++; selected.value = null; lookupLoading.value = false; lookupAnchor = null; stopAudio(); }
async function pronounce(wordId: number) {
  stopAudio();
  const version = lookupVersion;
  const requestId = audioRequest;
  audioWordId.value = wordId;
  try {
    await pronunciation.load();
    if (version === lookupVersion && requestId === audioRequest) await play(ordinaryAudioUrl(wordId), pronunciation.value);
  } catch (error) { if (version === lookupVersion && requestId === audioRequest) audioError.value = errorMessage(error); }
}
watch(() => pronunciation.value, () => { if (audioLoading.value || speaking.value) stopAudio(); }, { deep: true });
function positionLookup() {
  if (!lookupAnchor || !lookupPanel.value) return;
  const anchor = lookupAnchor.getBoundingClientRect(), panel = lookupPanel.value.getBoundingClientRect();
  const margin = 8, gap = 8;
  const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - panel.width - margin));
  const below = anchor.bottom + gap;
  const top = below + panel.height <= window.innerHeight - margin ? below : Math.max(margin, anchor.top - panel.height - gap);
  lookupPosition.value = { left, top };
}
function dismissOutside(event: PointerEvent) {
  if (selected.value && event.target instanceof Node && !lookupPanel.value?.contains(event.target) && !lookupAnchor?.contains(event.target)) closeLookup();
}
function dismissEscape(event: KeyboardEvent) { if (event.key === 'Escape' && selected.value) { event.stopPropagation(); closeLookup(); } }
onMounted(() => { document.addEventListener('pointerdown', dismissOutside); document.addEventListener('keydown', dismissEscape, true); window.addEventListener('resize', positionLookup); window.addEventListener('scroll', positionLookup, true); });
onUnmounted(() => { closeLookup(); document.removeEventListener('pointerdown', dismissOutside); document.removeEventListener('keydown', dismissEscape, true); window.removeEventListener('resize', positionLookup); window.removeEventListener('scroll', positionLookup, true); });
async function lookup(sentenceId: number, index: number, text: string, event: MouseEvent) {
  if (selected.value?.sentenceId === sentenceId && selected.value.index === index) { closeLookup(); return; }
  const version = ++lookupVersion;
  stopAudio();
  lookupAnchor = event.currentTarget as HTMLElement;
  selected.value = { sentenceId, index, text }; lookupResults.value = []; lookupError.value = false; lookupLoading.value = true;
  await nextTick(); positionLookup();
  try {
    const results = await request<LookupWord[]>('GET', '/words/lookup', undefined, { term: text });
    if (version === lookupVersion) lookupResults.value = results;
  } catch { if (version === lookupVersion) lookupError.value = true; }
  finally { if (version === lookupVersion) { lookupLoading.value = false; await nextTick(); positionLookup(); } }
}
watch(() => props.wordId, (wordId, _, onCleanup) => {
  closeLookup();
  let current = true; onCleanup(() => { current = false; });
  forms.value = []; sentences.value = []; formsError.value = false; sentencesError.value = false;
  formsLoading.value = !!wordId; sentencesLoading.value = !!wordId;
  if (!wordId) return;
  void request<Form[]>('GET', `/words/${wordId}/forms`).then(data => { if (current) forms.value = data; }).catch(() => { if (current) formsError.value = true; }).finally(() => { if (current) formsLoading.value = false; });
  void request<Sentence[]>('GET', '/sentence-practice/sentences', undefined, { scope: 'bank', wordId, limit: 3 }).then(data => { if (current) sentences.value = data; }).catch(() => { if (current) sentencesError.value = true; }).finally(() => { if (current) sentencesLoading.value = false; });
}, { immediate: true });
</script>
<template>
  <div class="word-learning-details">
    <section class="word-learning-meanings" aria-label="释义与词形">
      <h2><BookOpen :size="18" aria-hidden="true" />词义详解</h2>
      <WordMeaning :translation="translation" :translation-groups="translationGroups" :word-key="wordKey" layout="study" full />
      <div class="word-learning-forms"><h3><Layers3 :size="17" aria-hidden="true" />词形变化</h3>
        <p v-if="formsLoading">正在加载词形…</p><p v-else-if="formsError">词形暂时无法加载</p><p v-else-if="!forms.length">暂无词形变化</p>
        <ul v-else><li v-for="item in forms" :key="`${item.formType}:${item.form}`"><span>{{ labels[item.formType] || item.formType }}</span><strong lang="en">{{ item.form }}</strong></li></ul>
      </div>
    </section>
    <section class="word-learning-examples" aria-label="双语例句">
      <h2><BookOpen :size="18" aria-hidden="true" />双语例句</h2>
      <p v-if="sentencesLoading" class="word-learning-empty">正在加载例句…</p><p v-else-if="sentencesError" class="word-learning-empty">例句暂时无法加载</p><p v-else-if="!sentences.length" class="word-learning-empty">暂无关联例句</p>
      <ol v-else><li v-for="(sentence, index) in sentences" :key="sentence.id"><span class="example-number">{{ index + 1 }}</span><div class="example-content"><p lang="en" class="example-english"><template v-for="(part, partIndex) in segments(sentence.englishText)" :key="partIndex"><button v-if="part.word" type="button" :class="['example-word', { 'is-match': part.match, 'is-selected': selected?.sentenceId === sentence.id && selected.index === partIndex }]" :aria-label="`查询 ${part.text}`" :aria-expanded="selected?.sentenceId === sentence.id && selected.index === partIndex" @click="lookup(sentence.id, partIndex, part.text, $event)" @keydown.esc.stop="closeLookup">{{ part.text }}</button><template v-else>{{ part.text }}</template></template></p><p class="example-chinese">{{ sentence.referenceTranslation }}</p></div></li></ol>
    </section>
  </div>
  <Teleport to="body">
    <div v-if="selected" ref="lookupPanel" class="example-lookup" :style="{ left: `${lookupPosition.left}px`, top: `${lookupPosition.top}px` }" role="region" :aria-label="`${selected.text} 的词典释义`" aria-live="polite" @keydown.esc.stop="closeLookup"><button type="button" class="example-lookup-close" aria-label="关闭释义" @click="closeLookup">×</button><p v-if="lookupLoading">正在查询 {{ selected.text }}…</p><p v-else-if="lookupError">查询失败，请再次点击单词重试。</p><p v-else-if="!lookupResults.length">词库中未找到 {{ selected.text }}。</p><div v-for="result in lookupResults" v-else :key="result.id" class="example-lookup-result"><div class="example-lookup-heading"><strong lang="en">{{ result.word }}</strong><span v-if="result.phonetic" class="example-lookup-phonetic">{{ result.phonetic }}</span><button type="button" class="example-lookup-audio" :aria-label="`朗读 ${result.word}`" :title="audioWordId === result.id && speaking ? '正在朗读' : '播放单词发音'" :aria-pressed="audioWordId === result.id && speaking" :disabled="audioWordId === result.id && audioLoading" @click="pronounce(result.id)"><Volume2 :size="18" aria-hidden="true" /></button></div><WordMeaning :translation="result.translation" /><p v-if="audioWordId === result.id && audioError" class="example-audio-error" role="status">{{ audioError }}</p></div></div>
  </Teleport>
</template>
<style scoped>
.word-learning-details { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); margin: 6px 0 14px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface); text-align: left; }
.word-learning-meanings, .word-learning-examples { min-width: 0; }
.word-learning-details h2, .word-learning-details h3 { display: flex; align-items: center; gap: 9px; margin: 0; color: var(--accent-strong); font-size: 16px; }
.word-learning-details h2 { min-height: 48px; padding: 12px 20px; border-bottom: 1px solid var(--line); }
.word-learning-meanings :deep(.word-meaning--study) { width: auto; margin: 0; padding: 16px 20px; border: 0; border-radius: 0; background: transparent; }
.word-learning-meanings :deep(.translation-heading) { display: none; }
.word-learning-meanings :deep(.translation-professional) { display: grid; grid-template-columns: var(--s12) minmax(0, 1fr); }
.word-learning-forms { margin: 0 20px; padding: 15px 0 20px; border-top: 1px solid var(--line); }
.word-learning-forms h3 { font-size: 14px; }
.word-learning-forms ul { display: flex; flex-wrap: wrap; gap: 10px 16px; padding: 0; margin: 12px 0 0; list-style: none; }
.word-learning-forms li { display: inline-flex; align-items: baseline; gap: 7px; font-size: 13px; }
.word-learning-forms li span { padding: 3px 7px; border-radius: 6px; background: var(--sage); color: var(--accent-strong); }
.word-learning-forms li strong { color: var(--ink); font-size: 16px; font-weight: 700; overflow-wrap: anywhere; }
.word-learning-forms p, .word-learning-empty { color: var(--muted); font-size: 14px; }
.word-learning-examples { border-left: 1px solid var(--line); }
.word-learning-examples h2 { color: var(--on-accent); background: var(--accent-strong); border: 0; }
.word-learning-examples ol { margin: 0; padding: 0 20px; list-style: none; }
.word-learning-examples li { display: flex; gap: 14px; padding: 17px 0; border-bottom: 1px solid var(--line); }
.word-learning-examples li:last-child { border: 0; }
.example-number { display: grid; flex: none; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--sage); color: var(--accent-strong); font-size: 13px; }
.example-english, .example-chinese { margin: 0; overflow-wrap: anywhere; }
.example-english { color: var(--ink); font-size: 16px; line-height: 1.6; }
.example-content { min-width: 0; flex: 1; }
.example-word { display: inline; padding: 0; border: 0; border-radius: 3px; color: inherit; background: transparent; font: inherit; cursor: pointer; }
.example-word:hover, .example-word:focus-visible, .example-word.is-selected { color: var(--accent-strong); text-decoration: underline; text-underline-offset: 3px; }
.example-word:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.example-word.is-match { color: var(--accent-strong); background: var(--sage); }
.example-lookup { position: fixed; z-index: 1000; box-sizing: border-box; width: min(300px, calc(100vw - 16px)); max-height: min(320px, calc(100vh - 16px)); overflow: auto; padding: 16px 38px 16px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); box-shadow: 0 10px 30px rgb(0 0 0 / 18%); text-align: left; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.example-lookup p { margin: 0; color: var(--muted); }
.example-lookup-close { position: absolute; right: 9px; top: 6px; padding: 3px 6px; border: 0; background: transparent; color: var(--muted); font-size: 20px; cursor: pointer; }
.example-lookup-result + .example-lookup-result { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
.example-lookup-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.example-lookup-phonetic { color: var(--muted); }
.example-lookup-audio { display: inline-grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 6px; color: var(--accent-strong); background: var(--sage); cursor: pointer; }
.example-lookup-audio:hover { filter: brightness(.95); }
.example-lookup-audio:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.example-lookup-audio:disabled { opacity: .55; cursor: wait; }
.example-lookup .example-audio-error { margin-top: 6px; color: var(--error); }
.example-chinese { margin-top: 5px; color: var(--muted); font-size: 14px; line-height: 1.6; }
.word-learning-empty { padding: 8px 20px; }
@media (max-width: 700px) { .word-learning-details { grid-template-columns: minmax(0,1fr); } .word-learning-examples { border-left: 0; border-top: 1px solid var(--line); } }
</style>
