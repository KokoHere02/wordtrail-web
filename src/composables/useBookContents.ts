import { computed, ref, watch } from 'vue';
import { api } from '../api';
import { dailyApi } from '../api/daily';
import { ApiError, errorMessage } from '../api/http';
import { useBooksStore } from '../stores/books';
import { useResource } from './useResource';
import { useSelection } from './useSelection';
import type { Book, BookWord, LearningStatus, Page } from '../types/api';
import type { TodayOverview } from '../types/daily';

export function useBookContents(id: number) {
  const metadata = useResource<Book>();
  const words = useResource<Page<BookWord>>();
  const selection = useSelection();
  const today = useResource<TodayOverview>();
  const keyword = ref('');
  const appliedKeyword = ref('');
  const filter = ref<LearningStatus>('ALL');
  const page = ref(1);
  const size = 10;
  const busy = ref(false);
  const blocked = ref(false);
  const saveError = ref('');
  const notice = ref('');
  const available = computed(() => !!metadata.data.value && !metadata.error.value && !blocked.value && !metadata.loading.value);
  const editable = computed(() => (available.value || (busy.value && !blocked.value && !metadata.error.value)) && metadata.data.value?.editable === true);
  const pageIds = computed(() => words.data.value?.records.map(word => word.id) || []);
  const pageSelected = computed(() => pageIds.value.length > 0 && pageIds.value.every(wordId => selection.selected.value.has(wordId)));
  function handleError(e: unknown) {
    saveError.value = errorMessage(e);
    if (e instanceof ApiError && e.code === 'BOOK_NOT_FOUND') blocked.value = true;
    if (e instanceof ApiError && e.code === 'BOOK_READ_ONLY' && metadata.data.value) {
      metadata.data.value = { ...metadata.data.value, editable: false };
      saveError.value += '；请创建个人词本。';
    }
  }
  async function loadBook() {
    await metadata.load(() => useBooksStore().find(id));
    if (metadata.data.value) blocked.value = false;
  }
  async function refresh() {
    await words.load(() => api.words(id, { page: page.value, size, keyword: appliedKeyword.value || undefined, learningStatus: filter.value }));
    if (words.data.value && !words.data.value.records.length && words.data.value.total > 0 && page.value > 1) {
      page.value = Math.max(1, Math.ceil(words.data.value.total / size));
    } else if (words.data.value?.total === 0 && page.value !== 1) page.value = 1;
  }
  async function reload() { await Promise.all([loadBook(), refresh()]); }
  function search() { appliedKeyword.value = keyword.value.trim(); if (page.value !== 1) page.value = 1; else void refresh(); }
  watch(filter, () => { if (page.value !== 1) page.value = 1; else void refresh(); });
  watch(page, refresh);
  async function remove() {
    if (busy.value || !editable.value || !selection.count.value || selection.count.value > 100) return false;
    busy.value = true; saveError.value = ''; notice.value = '';
    try {
      const result = await api.removeBookWords(id, [...selection.selected.value]);
      notice.value = `移出 ${result.changedCount} 词 · 未变 ${result.unchangedCount} 词。`;
      selection.clear(); await reload();
      return true;
    } catch (e) { handleError(e); return false; }
    finally { busy.value = false; }
  }
  async function join() {
    if (busy.value || !available.value || !selection.count.value || selection.count.value > 100) return;
    busy.value = true; saveError.value = ''; notice.value = '';
    try {
      const result = await dailyApi.join(id, [...selection.selected.value]);
      notice.value = `新增 ${result.addedCount} 词 · 恢复 ${result.reactivatedCount} 词 · 已有 ${result.unchangedCount} 词。`;
      selection.clear(); await Promise.all([reload(), today.load(dailyApi.today)]);
    } catch (e) { handleError(e); }
    finally { busy.value = false; }
  }
  return { book: metadata.data, bookLoading: metadata.loading, bookError: metadata.error, ...words, selection, keyword, filter, page, size, busy, blocked, available, editable, saveError, notice, today: today.data, pageIds, pageSelected, loadBook, refresh, reload, search, remove, join };
}
