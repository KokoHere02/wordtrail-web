<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onScopeDispose, ref, watch } from 'vue';
import { ArrowRight, BookOpen, RotateCcw } from 'lucide-vue-next';
import { request, errorMessage } from '../../../api/http';
import { useStudySurface } from '../../../composables/useStudySurface';

type Sentence = { id: number; englishText: string; available: boolean };
type Feedback = { referenceTranslation: string; explanation: string | null };
const surface = useStudySurface();
const queue = ref<Sentence[]>([]), index = ref(0), skipped = ref(0);
const answer = ref(''), feedback = ref<Feedback | null>(null), requestId = ref('');
const loading = ref(false), submitting = ref(false), loaded = ref(false), error = ref('');
const needsRefresh = ref(false);
const answerInput = ref<HTMLTextAreaElement | null>(null), nextButton = ref<HTMLButtonElement | null>(null);
const current = computed(() => queue.value[index.value]);
const completed = computed(() => loaded.value && queue.value.length > 0 && index.value >= queue.value.length);
let mounted = true;
onScopeDispose(() => { mounted = false; });
onDeactivated(() => { needsRefresh.value = true; });
onActivated(() => { if (needsRefresh.value && surface?.active.value) void load(); });

async function load() {
  if (loading.value || submitting.value) return;
  loading.value = true; error.value = ''; loaded.value = false;
  queue.value = []; index.value = 0; answer.value = ''; feedback.value = null;
  try {
    const list: Sentence[] = [], seen = new Set<number>();
    let offset = 0, page: Sentence[];
    do {
      page = await request<Sentence[]>('GET', '/sentence-practice/sentences', undefined, { scope: 'learning', offset, limit: 100 });
      if (!mounted) return;
      for (const sentence of page) if (sentence.available && !seen.has(sentence.id)) { seen.add(sentence.id); list.push(sentence); }
      offset += page.length;
    } while (page.length === 100);
    queue.value = list; index.value = 0; skipped.value = 0; answer.value = ''; feedback.value = null;
    requestId.value = crypto.randomUUID(); loaded.value = true; needsRefresh.value = false;
  } catch (value) {
    if (mounted) error.value = errorMessage(value);
  } finally {
    if (mounted) loading.value = false;
  }
}
function resizeAnswer(event: Event) {
  const textarea = event.target as HTMLTextAreaElement;
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}
function handleAnswerShortcut(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229 || event.repeat || event.altKey || !(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
  event.preventDefault();
  if (event.shiftKey) next(true);
  else void submit();
}
function next(wasSkipped = false) {
  if (submitting.value || !current.value) return;
  if (wasSkipped) skipped.value++;
  index.value++; answer.value = ''; feedback.value = null; error.value = ''; requestId.value = crypto.randomUUID();
  void nextTick(() => { if (mounted && surface?.active.value !== false) answerInput.value?.focus(); });
}
async function submit() {
  if (!current.value || !answer.value.trim() || submitting.value) return;
  submitting.value = true; error.value = '';
  try {
    const result = await request<Feedback>('POST', `/sentence-practice/sentences/${current.value.id}/translations`, { translation: answer.value, requestId: requestId.value });
    if (mounted) {
      feedback.value = result;
      void nextTick(() => { if (mounted && surface?.active.value !== false && feedback.value) nextButton.value?.focus(); });
    }
  } catch (value) {
    if (mounted) error.value = errorMessage(value);
  } finally {
    if (mounted) submitting.value = false;
  }
}
watch(() => surface?.active.value, active => {
  if (active && (!loaded.value || needsRefresh.value || completed.value || queue.value.length === 0) && !loading.value) void load();
}, { immediate: true });
watch([queue, index, loaded], () => {
  if (!surface) return;
  surface.state.source = '句子学习列表';
  surface.state.total = queue.value.length;
  surface.state.completed = Math.min(index.value, queue.value.length);
  surface.state.remaining = Math.max(0, queue.value.length - index.value);
}, { immediate: true });
</script>

<template>
  <div class="sentence-workspace">
    <p v-if="loading" role="status" class="sentence-workspace-state">正在读取学习列表…</p>
    <div v-else-if="error && !current" class="sentence-workspace-state" role="alert"><p>{{ error }}</p><button class="btn btn-secondary" @click="load"><RotateCcw :size="16" aria-hidden="true" />重试</button></div>
    <div v-else-if="completed" class="sentence-workspace-state"><h2>本轮已浏览完</h2><p v-if="skipped">跳过的 {{ skipped }} 句仍在学习列表中。</p><p v-else>本轮句子已完成翻译。</p><div class="sentence-workspace-actions"><button class="btn btn-primary" @click="load">继续练习</button><RouterLink to="/sentences" class="btn btn-secondary">管理学习列表</RouterLink></div></div>
    <div v-else-if="loaded && !current" class="sentence-workspace-state"><h2>学习列表暂时没有句子</h2><p>从句子库选择想学习的句子，加入后就能在这里练习。</p><RouterLink to="/sentences" class="btn btn-primary"><BookOpen :size="16" aria-hidden="true" />去句子库选句</RouterLink></div>
    <section v-else-if="current" class="sentence-workspace-card" aria-label="句子翻译练习">
      <div class="sentence-prompt">
        <span class="sentence-prompt-label">英译中</span>
        <h1 lang="en">{{ current.englishText }}</h1>
      </div>
      <form v-if="!feedback" class="sentence-answer-form" @submit.prevent="submit">
        <label for="workspace-sentence-answer">你的翻译</label>
        <textarea ref="answerInput" :key="current.id" id="workspace-sentence-answer" v-model="answer" maxlength="2000" rows="1" placeholder="写下你对这句话的理解…" aria-describedby="sentence-shortcuts" @input="resizeAnswer" @keydown="handleAnswerShortcut" />
        <p id="sentence-shortcuts" class="sentence-shortcuts">Ctrl / ⌘ + Enter 提交 <span aria-hidden="true">·</span> Ctrl / ⌘ + Shift + Enter 跳过</p>
        <p v-if="error" class="sentence-workspace-error" role="alert">{{ error }}</p>
        <div class="sentence-workspace-actions"><button type="submit" class="btn btn-primary" :disabled="submitting || !answer.trim()">{{ submitting ? '提交中…' : '提交翻译' }} <ArrowRight :size="16" aria-hidden="true" /></button><button type="button" class="sentence-skip" :disabled="submitting" @click="next(true)">跳过这句 <ArrowRight :size="16" aria-hidden="true" /></button></div>
      </form>
      <div v-else class="sentence-answer-feedback"><div><span>你的翻译</span><p>{{ answer }}</p></div><div class="sentence-reference-answer"><span>参考翻译</span><p>{{ feedback.referenceTranslation }}</p></div><p v-if="feedback.explanation" class="sentence-feedback-explanation">{{ feedback.explanation }}</p><button ref="nextButton" class="btn btn-primary" @click="next()">下一句 <ArrowRight :size="16" aria-hidden="true" /></button><p class="sentence-next-hint">按 Enter 继续</p></div>
    </section>
  </div>
</template>

<style scoped>
.sentence-workspace { width: min(100%, 820px); margin: 0 auto; }
.sentence-workspace-card { padding: 28px 0 64px; }
.sentence-prompt { padding-bottom: 38px; border-bottom: 1px solid var(--line); }
.sentence-prompt-label { color: var(--accent-strong); font-size: 14px; font-weight: 600; }
.sentence-workspace-card h1 { margin: 22px 0 0; color: var(--ink); font: 400 clamp(28px, 3.5vw, 44px)/1.4 var(--font-serif); overflow-wrap: anywhere; }
.sentence-answer-form { display: grid; gap: 0; padding-top: 38px; }
.sentence-answer-form label, .sentence-answer-feedback span { color: var(--ink); font-size: 14px; font-weight: 600; }
.sentence-answer-form textarea { display: block; width: 100%; min-height: 48px; margin-top: 16px; padding: 4px 0 10px; border: 0; border-bottom: 1px solid var(--muted); border-radius: 0; outline: none; color: var(--ink); background: transparent; font-family: "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif; font-weight: 400; font-size: 20px; line-height: 1.75; letter-spacing: .04em; resize: none; overflow-y: hidden; transition: border-color .2s; }
.sentence-answer-form textarea::placeholder { color: var(--muted); opacity: .75; font-family: var(--font-sans); font-size: 16px; letter-spacing: .02em; }
.sentence-shortcuts { margin: 10px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.sentence-shortcuts span { padding: 0 6px; }
.sentence-answer-form textarea:focus-visible { border-bottom: 2px solid var(--focus-ring); padding-bottom: 9px; }
.sentence-workspace-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
.sentence-answer-form .sentence-workspace-actions { justify-content: space-between; }
.sentence-workspace-actions .btn, .sentence-answer-feedback .btn, .sentence-workspace-state .btn { display: inline-flex; align-items: center; gap: 8px; }
.sentence-workspace-actions .btn { min-height: 44px; padding-inline: 20px; }
.sentence-skip { display: inline-flex; align-items: center; gap: 8px; padding: 10px 0; border: 0; background: transparent; color: var(--accent-strong); font: inherit; cursor: pointer; }
.sentence-skip:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 4px; }
.sentence-skip:disabled { opacity: .5; cursor: not-allowed; }
.sentence-workspace-error { margin: 12px 0 0; color: var(--error); font-size: 14px; }
.sentence-answer-feedback { display: grid; gap: 0; padding-top: 32px; }
.sentence-answer-feedback > div { padding: 0 0 24px; }
.sentence-answer-feedback > .sentence-reference-answer { padding-top: 24px; border-top: 1px solid var(--line); }
.sentence-answer-feedback p { margin: 10px 0 0; color: var(--ink); font-family: "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif; font-size: 20px; line-height: 1.75; letter-spacing: .04em; white-space: pre-wrap; overflow-wrap: anywhere; }
.sentence-answer-feedback .sentence-feedback-explanation { margin: 0 0 20px; color: var(--muted); font-size: 14px; }
.sentence-answer-feedback .btn { justify-self: start; margin-top: 8px; }
.sentence-answer-feedback .sentence-next-hint { margin: 8px 0 0; color: var(--muted); font: 400 12px/1.5 var(--font-sans); letter-spacing: 0; }
.sentence-workspace-state { margin: 60px 0; color: var(--muted); line-height: 1.7; }
.sentence-workspace-state h2 { margin: 0 0 12px; color: var(--ink); font-size: 21px; }
.sentence-workspace-state p { margin: 0 0 20px; }
@media (max-width: 600px) { .sentence-workspace-card { padding: 12px 0 40px; } .sentence-prompt { padding-bottom: 28px; } .sentence-workspace-card h1 { margin-top: 16px; } .sentence-answer-form { padding-top: 28px; } .sentence-answer-form textarea { font-size: 16px; } .sentence-workspace-state { margin: 32px 0; } }
</style>
