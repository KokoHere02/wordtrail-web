<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { Volume2 } from 'lucide-vue-next';
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
const confusables = ref<LookupWord[]>([]), confusablesLoading = ref(false), confusablesError = ref(false);
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
  forms.value = []; sentences.value = []; confusables.value = []; formsError.value = false; sentencesError.value = false; confusablesError.value = false;
  formsLoading.value = !!wordId; sentencesLoading.value = !!wordId;
  confusablesLoading.value = !!wordId;
  if (!wordId) return;
  void request<Form[]>('GET', `/words/${wordId}/forms`).then(data => { if (current) forms.value = data; }).catch(() => { if (current) formsError.value = true; }).finally(() => { if (current) formsLoading.value = false; });
  void request<Sentence[]>('GET', '/sentence-practice/sentences', undefined, { scope: 'bank', wordId, limit: 3 }).then(data => { if (current) sentences.value = data; }).catch(() => { if (current) sentencesError.value = true; }).finally(() => { if (current) sentencesLoading.value = false; });
  void request<LookupWord[]>('GET', `/words/${wordId}/confusables`).then(data => { if (current) confusables.value = data; }).catch(() => { if (current) confusablesError.value = true; }).finally(() => { if (current) confusablesLoading.value = false; });
}, { immediate: true });
</script>
<template>
  <div class="word-learning-details">
    <section class="word-learning-meanings" aria-label="释义与词形">
      <WordMeaning :translation="translation" :translation-groups="translationGroups" :word-key="wordKey" layout="study" full />
    <section class="word-learning-forms detail-row" aria-label="词形变化">
      <h2>词形变化</h2>
      <p v-if="formsLoading" class="detail-state">正在加载词形…</p><p v-else-if="formsError" class="detail-state">词形暂时无法加载</p><p v-else-if="!forms.length" class="detail-state">暂无词形变化</p>
      <ul v-else><li v-for="item in forms" :key="`${item.formType}:${item.form}`"><span>{{ labels[item.formType] || item.formType }}</span><strong lang="en">{{ item.form }}</strong></li></ul>
    </section>
    </section>
    <section v-if="confusablesLoading || confusablesError || confusables.length" class="confusable-words detail-row" aria-label="形近词">
      <h2>形近词</h2>
      <p v-if="confusablesLoading" class="detail-state">正在加载形近词…</p><p v-else-if="confusablesError" class="detail-state">形近词暂时无法加载</p>
      <div v-else class="confusable-content"><ul><li v-for="item in confusables" :key="item.id"><div class="confusable-heading"><strong lang="en">{{ item.word }}</strong><button type="button" class="example-lookup-audio" :aria-label="`朗读 ${item.word}`" :aria-pressed="audioWordId === item.id && speaking" :disabled="audioWordId === item.id && audioLoading" @click="pronounce(item.id)"><Volume2 :size="16" aria-hidden="true" /></button><span v-if="item.phonetic">{{ item.phonetic }}</span></div><WordMeaning :translation="item.translation" /></li></ul><p v-if="audioError && confusables.some(item => item.id === audioWordId)" class="example-audio-error" role="status">{{ audioError }}</p></div>
    </section>
    <section class="word-learning-examples detail-row" aria-label="双语例句">
      <h2>双语例句</h2>
      <p v-if="sentencesLoading" class="word-learning-empty">正在加载例句…</p><p v-else-if="sentencesError" class="word-learning-empty">例句暂时无法加载</p><p v-else-if="!sentences.length" class="word-learning-empty">暂无关联例句</p>
      <ol v-else><li v-for="(sentence, index) in sentences" :key="sentence.id"><span class="example-number">{{ index + 1 }}</span><div class="example-content"><p lang="en" class="example-english"><template v-for="(part, partIndex) in segments(sentence.englishText)" :key="partIndex"><button v-if="part.word" type="button" :class="['example-word', { 'is-match': part.match, 'is-selected': selected?.sentenceId === sentence.id && selected.index === partIndex }]" :aria-label="`查询 ${part.text}`" :aria-expanded="selected?.sentenceId === sentence.id && selected.index === partIndex" @click="lookup(sentence.id, partIndex, part.text, $event)" @keydown.esc.stop="closeLookup">{{ part.text }}</button><template v-else>{{ part.text }}</template></template></p><p class="example-chinese">{{ sentence.referenceTranslation }}</p></div></li></ol>
    </section>
  </div>
  <Teleport to="body">
    <div v-if="selected" ref="lookupPanel" class="example-lookup" :style="{ left: `${lookupPosition.left}px`, top: `${lookupPosition.top}px` }" role="region" :aria-label="`${selected.text} 的词典释义`" aria-live="polite" @keydown.esc.stop="closeLookup"><button type="button" class="example-lookup-close" aria-label="关闭释义" @click="closeLookup">×</button><p v-if="lookupLoading">正在查询 {{ selected.text }}…</p><p v-else-if="lookupError">查询失败，请再次点击单词重试。</p><p v-else-if="!lookupResults.length">词库中未找到 {{ selected.text }}。</p><div v-for="result in lookupResults" v-else :key="result.id" class="example-lookup-result"><div class="example-lookup-heading"><strong lang="en">{{ result.word }}</strong><span v-if="result.phonetic" class="example-lookup-phonetic">{{ result.phonetic }}</span><button type="button" class="example-lookup-audio" :aria-label="`朗读 ${result.word}`" :title="audioWordId === result.id && speaking ? '正在朗读' : '播放单词发音'" :aria-pressed="audioWordId === result.id && speaking" :disabled="audioWordId === result.id && audioLoading" @click="pronounce(result.id)"><Volume2 :size="18" aria-hidden="true" /></button></div><WordMeaning :translation="result.translation" /><p v-if="audioWordId === result.id && audioError" class="example-audio-error" role="status">{{ audioError }}</p></div></div>
  </Teleport>
</template>
<style scoped>
.word-learning-details { width: min(100%, 1000px); margin: 20px auto 32px; text-align: left; }
.word-learning-meanings :deep(.word-meaning--study) { width: auto; min-height: 0; margin: 0; padding: 8px 0 28px; border: 0; border-radius: 0; background: transparent; }
.word-learning-meanings :deep(.translation-heading) { display: none; }
.word-learning-meanings :deep(.word-meaning--study > div) { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 26px; }
.word-learning-meanings :deep(.translation-group), .word-learning-meanings :deep(.translation-group.has-part-of-speech) { display: flex; align-items: baseline; gap: 10px; min-width: 0; max-width: 100%; text-align: left; }
.word-learning-meanings :deep(.translation-group + .translation-group) { margin: 0; padding: 0; border: 0; }
.word-learning-meanings :deep(.translation-part-of-speech) { flex: none; padding: 3px 8px; border-radius: 6px; color: var(--accent-strong); background: var(--sage); }
.word-learning-meanings :deep(.translation-body) { min-width: 0; overflow-wrap: anywhere; }
.word-learning-meanings :deep(.translation-professional .translation-body) { padding-top: 0; }
.detail-row { display: grid; grid-template-columns: 156px minmax(0, 1fr); gap: 16px; align-items: start; min-width: 0; padding: 20px 0; border-top: 1px solid var(--line); }
.detail-row h2 { justify-self: start; margin: 0; padding: 5px 16px; border-radius: 20px; background: var(--sage); color: var(--accent-strong); font-size: 15px; line-height: 1.4; white-space: nowrap; }
.detail-state, .word-learning-empty { margin: 0; color: var(--muted); font-size: 14px; line-height: 30px; }
.word-learning-forms ul, .confusable-words ul { display: flex; flex-wrap: wrap; gap: 12px 0; min-width: 0; padding: 0; margin: 0; list-style: none; }
.word-learning-forms li { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 8px; padding: 3px 20px; border-left: 1px solid var(--line); }
.word-learning-forms li:first-child, .confusable-words li:first-child { padding-left: 0; border-left: 0; }
.word-learning-forms li span { color: var(--muted); font-size: 13px; }
.word-learning-forms li strong { color: var(--ink); font: 500 20px/1.4 var(--font-serif); overflow-wrap: anywhere; }
.confusable-content { min-width: 0; }
.confusable-words li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; min-width: 0; max-width: 400px; padding: 0 20px; border-left: 1px solid var(--line); overflow-wrap: anywhere; }
.confusable-heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.confusable-heading strong { color: var(--ink); font: 500 20px/1.4 var(--font-serif); }
.confusable-heading span { color: var(--muted); font-size: 13px; }
.confusable-words li > .word-meaning { margin: 0; font-size: 15px; }
.word-learning-examples ol { margin: 0; padding: 0; list-style: none; }
.word-learning-examples li { display: flex; gap: 14px; padding: 3px 0 14px; }
.word-learning-examples li:last-child { padding-bottom: 0; }
.example-number { flex: none; width: 10px; color: var(--accent-strong); font-size: 0; line-height: 1.6; }
.example-number::before { content: '•'; font-size: 18px; }
.example-english, .example-chinese { margin: 0; overflow-wrap: anywhere; }
.example-english { color: var(--ink); font: 400 19px/1.6 var(--font-serif); }
.example-content { min-width: 0; flex: 1; }
.example-word { display: inline; padding: 0; border: 0; border-radius: 3px; color: inherit; background: transparent; font: inherit; cursor: pointer; }
.example-word:hover, .example-word:focus-visible, .example-word.is-selected { color: var(--accent-strong); text-decoration: underline; text-underline-offset: 3px; }
.example-word:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.example-word.is-match { color: inherit; font-weight: 700; }
.example-lookup { position: fixed; z-index: 1000; box-sizing: border-box; width: min(300px, calc(100vw - 16px)); max-height: min(320px, calc(100vh - 16px)); overflow: auto; padding: 16px 38px 16px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); box-shadow: 0 10px 30px rgb(0 0 0 / 18%); text-align: left; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.example-lookup p { margin: 0; color: var(--muted); }
.example-lookup-close { position: absolute; right: 9px; top: 6px; padding: 3px 6px; border: 0; background: transparent; color: var(--muted); font-size: 20px; cursor: pointer; }
.example-lookup-result + .example-lookup-result { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
.example-lookup-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.example-lookup-phonetic { color: var(--muted); }
.example-lookup-audio { display: inline-grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%; color: var(--accent-strong); background: var(--sage); cursor: pointer; }
.example-lookup-audio:hover { filter: brightness(.95); }
.example-lookup-audio:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.example-lookup-audio:disabled { opacity: .55; cursor: wait; }
.example-lookup .example-audio-error { margin-top: 6px; color: var(--error); }
.example-chinese { margin-top: 5px; color: var(--muted); font-size: 15px; line-height: 1.6; }
@media (max-width: 600px) { .detail-row { grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 16px 0; } .word-learning-forms ul, .confusable-words ul { gap: 12px 18px; } .word-learning-forms li, .confusable-words li { padding: 2px 0; border-left: 0; } }
</style>
