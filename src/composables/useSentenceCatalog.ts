import { computed, onMounted, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { sentencesApi } from '../api/sentences';
import { ApiError, errorMessage } from '../api/http';
import { sentenceServiceError } from '../api/sentenceManagement';
import { useResource } from './useResource';
import { useSelection } from './useSelection';
import { useSentenceLaunch } from './useSentenceLaunch';
import type { Page } from '../types/api';
import type { SentenceSource, SentenceDifficulty, SentenceQuestion, SentenceReviewItem, SentenceDueItem } from '../types/sentences';
export function useSentenceCatalog(source: SentenceSource, initialWordId?: number) {
  const questions = useResource<Page<SentenceQuestion>>();
  const reviews = useResource<Page<SentenceReviewItem>>();
  const due = useResource<Page<SentenceDueItem>>();
  const selection = useSelection();
  const creation = useSentenceLaunch();
  const difficulty = ref<SentenceDifficulty | ''>('');
  const word = shallowRef<{ id: number; word: string } | undefined>(initialWordId ? { id: initialWordId, word: '' } : undefined);
  const appliedDifficulty = ref<SentenceDifficulty>();
  const appliedWordId = ref(initialWordId);
  const page = ref(1);
  const size = 10;
  const roundCount = ref(10);
  const validation = ref('');
  const notice = ref('');
  const favoriteError = ref('');
  const favoriteBusy = ref(new Set<number>());
  let active = true;
  onScopeDispose(() => { active = false; });
  const loading = computed(() => source === 'REVIEW' ? reviews.loading.value : source === 'DUE' ? due.loading.value : questions.loading.value);
  const error = computed(() => source === 'REVIEW' ? reviews.error.value : source === 'DUE' ? due.error.value : questions.error.value);
  const total = computed(() => source === 'REVIEW' ? reviews.data.value?.total : source === 'DUE' ? due.data.value?.total : questions.data.value?.total);
  const rows = computed(() => source === 'REVIEW'
    ? (reviews.data.value?.records || []).map(review => ({ sentenceId: review.sentenceId, englishText: review.englishText, difficulty: review.difficulty, available: review.available, review, question: undefined, due: undefined }))
    : source === 'DUE' ? (due.data.value?.records || []).map(due => ({ sentenceId: due.sentenceId, englishText: due.englishText, difficulty: due.difficulty, available: true, due, question: undefined, review: undefined }))
    : (questions.data.value?.records || []).map(question => ({ sentenceId: question.sentenceId, englishText: question.englishText, difficulty: question.difficulty, available: true, question, review: undefined, due: undefined })));
  const pageIds = computed(() => rows.value.filter(row => row.available).map(row => row.sentenceId));
  const pageSelected = computed(() => !!pageIds.value.length && pageIds.value.every(id => selection.selected.value.has(id)));
  const locked = computed(() => creation.busy.value || creation.uncertain.value || !!creation.created.value);
  const filters = () => ({ ...(appliedDifficulty.value ? { difficulty: appliedDifficulty.value } : {}), ...(appliedWordId.value ? { wordId: appliedWordId.value } : {}) });
  async function refresh() {
    if (source === 'REVIEW') await reviews.load(() => sentencesApi.reviewQueue({ page: page.value, size }));
    else if (source === 'DUE') await due.load(async () => { try { return await sentencesApi.due({ page: page.value, size, ...filters() }); } catch (value) { throw new Error(sentenceServiceError(value)); } });
    else await questions.load(() => (source === 'FAVORITES' ? sentencesApi.favorites : sentencesApi.questions)({ page: page.value, size, ...filters() }));
    if (active && total.value !== undefined && total.value > 0 && !rows.value.length && page.value > 1) page.value = Math.max(1, Math.ceil(total.value / size));
    else if (active && total.value === 0 && page.value !== 1) page.value = 1;
  }
  function applyFilters() {
    if (locked.value || favoriteBusy.value.size) return;
    if (selection.count.value) { notice.value = `筛选已更新，已清空之前所选 ${selection.count.value} 题。`; selection.clear(); }
    appliedDifficulty.value = difficulty.value || undefined;
    appliedWordId.value = word.value?.id;
    if (page.value !== 1) page.value = 1; else void refresh();
  }
  async function favorite(id: number, value: boolean) {
    if (locked.value || favoriteBusy.value.has(id)) return;
    favoriteBusy.value.add(id); favoriteError.value = '';
    try {
      const saved = await sentencesApi.favorite(id, value);
      if (!active) return;
      const previous = questions.data.value;
      if (previous) questions.data.value = { ...previous, records: previous.records.map(row => row.sentenceId === saved.sentenceId ? { ...row, favorite: saved.favorite } : row) };
      notice.value = saved.favorite ? '已收藏。' : '已取消收藏。';
      if (source === 'FAVORITES' && !saved.favorite) {
        if (selection.selected.value.has(id)) { selection.toggle(id, false); notice.value += '该题已移出所选题目。'; }
        await refresh();
      }
    } catch (value) {
      if (!active) return;
      favoriteError.value = errorMessage(value);
      if (value instanceof ApiError && value.code === 'SENTENCE_NOT_FOUND') await refresh();
    } finally { if (active) favoriteBusy.value.delete(id); }
  }
  async function start(manual: boolean) {
    if (locked.value || loading.value || error.value || favoriteBusy.value.size) return;
    validation.value = '';
    if (manual && (selection.count.value < 1 || selection.count.value > 50)) { validation.value = '请选择 1～50 个不同句子。'; return; }
    if (!manual && (!Number.isInteger(roundCount.value) || roundCount.value < 1 || roundCount.value > 50)) { validation.value = '本轮数量须为 1～50 的整数。'; return; }
    const scope = source === 'REVIEW' ? {} : filters();
    await creation.launch(manual ? { source, ...scope, sentenceIds: [...selection.selected.value] } : { source, ...scope, count: roundCount.value });
  }
  watch(page, refresh);
  onMounted(refresh);
  return { rows, loading, error, total, selection, creation, difficulty, word, page, size, roundCount, validation, notice, favoriteError, favoriteBusy, pageIds, pageSelected, locked, refresh, applyFilters, favorite, start };
}
