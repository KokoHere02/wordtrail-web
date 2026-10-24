import { computed, onMounted, onScopeDispose, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { ApiError, errorMessage } from '../api/http';
import { useBooksStore } from '../stores/books';
import type { AnswerResult, BatchProgress, Result, StudyItem } from '../types/api';
import { useLearningHistory } from './useLearningHistory';
import { useWordReveal } from './useWordReveal';
import { useStudySurface } from './useStudySurface';

interface Encounter { item: StudyItem; answer: AnswerResult }
interface Pending { item: StudyItem; result: Result; requestId: string }
export function usePracticeSession(id: number) {
  const router = useRouter();
  const surface = useStudySurface();
  let active = true;
  onScopeDispose(() => { active = false; });
  const progress = ref<BatchProgress>();
  const item = ref<StudyItem>();
  const receipt = ref<AnswerResult>();
  const bookName = ref('专项巩固');
  const loading = ref(true);
  const advancing = ref(false);
  const saving = ref(false);
  const loadError = ref('');
  const error = ref('');
  const pending = ref<Pending>();
  const syncAvailable = ref(false);
  const history = useLearningHistory<Encounter>(() => String(item.value?.itemId ?? 'empty'));
  const current = computed(() => history.selected.value?.value.item ?? item.value);
  const answer = computed(() => history.selected.value?.value.answer ?? receipt.value);
  const isPast = computed(() => !!history.selected.value);
  const busy = computed(() => loading.value || saving.value || advancing.value);
  const reveal = useWordReveal(() => history.selected.value ? `past:${history.selected.value.key}` : `live:${item.value?.itemId}`, () => current.value?.wordId, answer);
  const canRate = computed(() => !busy.value && !reveal.loading.value && !isPast.value && !syncAvailable.value && !pending.value && !!item.value && !item.value.answered && progress.value?.status === 'IN_PROGRESS');
  const canPrevious = computed(() => !busy.value && !pending.value && history.canPrevious.value);
  const canNext = computed(() => !busy.value && !pending.value && !syncAvailable.value && (isPast.value || !!item.value?.answered));
  const canCorrect = computed(() => !busy.value && !pending.value && !syncAvailable.value && answer.value?.result === 1 && (!isPast.value || history.selected.value?.key === history.entries.value.at(-1)?.key));
  async function load() {
    if (saving.value || advancing.value) return;
    loading.value = true; loadError.value = ''; error.value = '';
    try {
      const value = await api.progress(id);
      if (!active) return;
      progress.value = value;
      if (value.status === 'COMPLETED') { if (!surface || surface.active.value) await router.replace(`/learning/${id}/result`); return; }
      if (value.status === 'ABANDONED') throw new Error('本轮已放弃，请返回专项练习记录。');
      if (value.nextItemId === null) throw new Error('当前批次没有待答单词，请刷新学习进度。');
      const detail = await api.item(id, value.nextItemId);
      if (!active) return;
      if (value.bookId) {
        try { bookName.value = (await useBooksStore().find(value.bookId)).name; }
        catch { bookName.value = '词书专项'; }
      }
      item.value = detail;
      receipt.value = undefined; pending.value = undefined; syncAvailable.value = false;
      history.live();
    } catch (value) { loadError.value = errorMessage(value); }
    finally { loading.value = false; }
  }
  async function next() {
    if (!active || !canNext.value) return;
    if (isPast.value) {
      history.forward();
      if (answer.value) reveal.showSaved(answer.value);
      return;
    }
    if (progress.value?.status === 'COMPLETED') { await router.push(`/learning/${id}/result`); return; }
    const nextItemId = progress.value?.nextItemId;
    if (nextItemId == null) { error.value = '服务端未提供下一词，请刷新学习进度。'; return; }
    advancing.value = true; error.value = '';
    try {
      const nextItem = await api.item(id, nextItemId);
      item.value = nextItem; receipt.value = undefined;
    } catch (value) { error.value = errorMessage(value); }
    finally { advancing.value = false; }
  }
  async function send() {
    const action = pending.value;
    if (!action || busy.value) return;
    saving.value = true; error.value = '';
    let saved: AnswerResult | undefined;
    try {
      saved = await api.answer(id, action.item.itemId, action.result, action.requestId);
      pending.value = undefined;
      const answeredItem: StudyItem = { ...action.item, answered: true, result: saved.result, translation: saved.translation, translationGroups: saved.translationGroups, answeredAt: saved.answeredAt, nextItemId: saved.nextItemId };
      history.remember(String(action.item.itemId), { item: answeredItem, answer: saved });
      history.live();
      item.value = answeredItem; receipt.value = saved;
      if (progress.value) progress.value = { ...progress.value, status: saved.status, answeredCount: saved.answeredCount, wordCount: saved.wordCount, nextItemId: saved.nextItemId };
    } catch (value) {
      error.value = errorMessage(value);
      if (value instanceof ApiError && value.status === 409 && value.code !== 'REQUEST_ID_REUSED') {
        syncAvailable.value = true;
        try { progress.value = await api.progress(id); } catch { /* Retain the actionable save error. */ }
      }
    } finally { saving.value = false; }
    if (saved && active) reveal.showSaved(saved);
  }
  async function rate(result: Result) {
    if (!canRate.value || !item.value) return;
    pending.value = { item: { ...item.value }, result, requestId: crypto.randomUUID() };
    await send();
  }
  async function correct(result: 2 | 3) {
    if (!canCorrect.value || !current.value) return;
    pending.value = { item: { ...current.value }, result, requestId: crypto.randomUUID() };
    await send();
  }
  function previous() {
    if (!canPrevious.value) return;
    history.previous();
    if (answer.value) reveal.showSaved(answer.value);
  }
  onMounted(load);
  return { progress, item, receipt, bookName, loading, saving, advancing, busy, loadError, error, pending, syncAvailable, history, current, answer, isPast, reveal, canRate, canPrevious, canNext, canCorrect, load, rate, correct, retry: send, previous, next };
}
