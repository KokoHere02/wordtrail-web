import { computed, onScopeDispose } from 'vue';
import { useRouter } from 'vue-router';
import { useDailySession } from './useDailySession';
import { useLearningHistory } from './useLearningHistory';
import { useWordReveal } from './useWordReveal';
import type { Result } from '../types/api';
import type { DailyAnswerResult, DailyStudyItem } from '../types/daily';

interface Encounter { item: DailyStudyItem; answer: DailyAnswerResult; details?: DailyStudyItem }
export function useDailyLearning(userId: number) {
  const router = useRouter();
  const session = useDailySession(userId);
  let active = true;
  onScopeDispose(() => { active = false; });
  const keyFor = (item: DailyStudyItem) => `${item.itemId}:${item.nextAttemptNo}`;
  const liveKey = computed(() => session.item.value ? keyFor(session.item.value) : 'empty');
  const history = useLearningHistory<Encounter>(liveKey);
  const current = computed(() => history.selected.value?.value.item ?? session.item.value);
  const answer = computed(() => history.selected.value?.value.answer ?? session.receipt.value);
  const isPast = computed(() => !!history.selected.value);
  const busy = computed(() => session.loading.value || session.saving.value);
  const feedback = computed(() => answer.value && (isPast.value ? history.selected.value?.value.details : session.answerDetails.value)?.completionReason === 'LIMIT_REACHED'
    ? '本词当天暂时结束，仍需巩固。' : '');
  const reveal = useWordReveal(() => history.selected.value ? `past:${history.selected.value.key}` : `live:${liveKey.value}`, () => current.value?.wordId, answer);
  const completed = computed(() => session.progress.value?.status === 'COMPLETED');
  const canRate = computed(() => !isPast.value && !busy.value && !reveal.loading.value && !session.pending.value && !session.receipt.value && !session.expired.value && !session.historical.value && session.progress.value?.status === 'IN_PROGRESS' && session.progress.value.nextItemId === session.item.value?.itemId);
  const canPrevious = computed(() => !busy.value && !session.pending.value && history.canPrevious.value);
  const canNext = computed(() => !busy.value && !session.pending.value && (isPast.value || !!session.receipt.value));
  const canCorrect = computed(() => !busy.value && !session.pending.value && answer.value?.result === 1 && (isPast.value
    ? history.selected.value?.key === history.entries.value.at(-1)?.key
    : !!session.correctableLogId.value));
  async function next() {
    if (!active || !canNext.value) return;
    if (isPast.value) {
      history.forward();
      const saved = answer.value;
      if (saved) reveal.showSaved(saved);
      return;
    }
    if (completed.value && session.progress.value) { await router.push(`/records/${session.progress.value.batchId}`); return; }
    await session.next();
    if (active && !session.error.value && !session.item.value && session.progress.value?.status === 'COMPLETED') await router.push(`/records/${session.progress.value.batchId}`);
  }
  async function saved(original: DailyStudyItem, beforeLog?: number) {
    const receipt = session.receipt.value;
    if (!active || !receipt || receipt.logId === beforeLog || session.pending.value) return;
    history.remember(keyFor(original), { item: original, answer: receipt, details: session.answerDetails.value });
    history.live();
    reveal.showSaved(receipt);
  }
  async function rate(result: Result) {
    if (!canRate.value || !session.item.value) return;
    const original = { ...session.item.value };
    const before = session.receipt.value?.logId;
    await session.answer(result);
    await saved(original, before);
  }
  async function retry() {
    const action = session.pending.value;
    if (!action || busy.value) return;
    const before = session.receipt.value?.logId;
    await session.retry();
    await saved(action.item, before);
  }
  async function correct(result: 2 | 3) {
    if (!canCorrect.value || !current.value || !answer.value || !session.progress.value) return;
    const original = { ...current.value };
    const before = session.receipt.value?.logId;
    if (isPast.value) await session.correctPrevious(session.progress.value.batchId, original, answer.value.logId, result);
    else await session.correct(result);
    await saved(original, before);
  }
  function previous() {
    if (!canPrevious.value) return;
    history.previous();
    const savedAnswer = answer.value;
    if (savedAnswer) reveal.showSaved(savedAnswer);
  }
  return { session, history, current, answer, isPast, busy, feedback, reveal, canRate, canPrevious, canNext, canCorrect, rate, retry, correct, previous, next };
}
