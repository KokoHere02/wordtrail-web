import { computed, ref } from 'vue';
import { api } from '../api';
import { ApiError, errorMessage } from '../api/http';
import { useResource } from './useResource';
import { useSelection } from './useSelection';
import type { BookWordsChange, DictionaryWord, Page } from '../types/api';

export function useDictionaryCollection(bookId: number) {
  const keyword = ref('');
  const matchType = ref<'PREFIX' | 'EXACT'>('PREFIX');
  const applied = ref<{ keyword: string; matchType: 'PREFIX' | 'EXACT' }>();
  const page = ref(1);
  const size = 10;
  const resource = useResource<Page<DictionaryWord>>();
  const selection = useSelection();
  const busy = ref(false);
  const validation = ref('');
  const saveError = ref('');
  const blocked = ref(false);
  const pageIds = computed(() => resource.data.value?.records.filter(word => word.inBook === false).map(word => word.id) || []);
  const pageSelected = computed(() => pageIds.value.length > 0 && pageIds.value.every(id => selection.selected.value.has(id)));
  async function refresh() {
    if (!applied.value || blocked.value) return;
    await resource.load(async () => {
      try { return await api.dictionary({ ...applied.value!, bookId, page: page.value, size }); }
      catch (e) { if (e instanceof ApiError && e.code === 'BOOK_NOT_FOUND') blocked.value = true; throw e; }
    });
  }
  async function search() {
    if (busy.value || blocked.value) return;
    const text = keyword.value.trim();
    validation.value = '';
    if (!text || Array.from(text).length > 255) { validation.value = '请输入 1～255 个字符的单词。'; return; }
    applied.value = { keyword: text, matchType: matchType.value };
    page.value = 1;
    await refresh();
  }
  async function changePage(value: number) { page.value = value; await refresh(); }
  async function collect(): Promise<BookWordsChange | undefined> {
    if (busy.value || blocked.value || resource.loading.value || !selection.count.value || selection.count.value > 100) return;
    busy.value = true; saveError.value = '';
    try {
      const result = await api.collectWords(bookId, [...selection.selected.value]);
      selection.clear();
      return result;
    } catch (e) {
      saveError.value = errorMessage(e);
      if (e instanceof ApiError && e.code === 'BOOK_READ_ONLY') saveError.value += '；请创建个人词本。';
      if (e instanceof ApiError && ['BOOK_NOT_FOUND', 'BOOK_READ_ONLY'].includes(e.code)) blocked.value = true;
    } finally { busy.value = false; }
  }
  return { ...resource, selection, keyword, matchType, applied, page, size, pageIds, pageSelected, busy, validation, saveError, blocked, search, refresh, changePage, collect };
}
