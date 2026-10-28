import { computed, onMounted, ref, watch } from 'vue';
import { wordsApi } from '../api/words';
import { useResource } from './useResource';
import { useSelection } from './useSelection';
import type { LearningSource, WeakWordsPage } from '../types/words';

export function useWeakWords() {
  const source = ref<LearningSource>('DAILY');
  const page = ref(1);
  const size = 10;
  const resource = useResource<WeakWordsPage>();
  const selection = useSelection();
  const pageIds = computed(() => resource.data.value?.records.map(word => word.wordId) || []);
  const pageSelected = computed(() => pageIds.value.length > 0 && pageIds.value.every(id => selection.selected.value.has(id)));
  async function refresh() {
    await resource.load(() => wordsApi.weak({ source: source.value, page: page.value, size }));
    if (resource.data.value && !resource.data.value.records.length && page.value > 1) page.value = Math.max(1, Math.ceil(resource.data.value.total / size));
  }
  watch(source, () => { selection.clear(); if (page.value !== 1) page.value = 1; else void refresh(); });
  watch(page, refresh);
  onMounted(refresh);
  return { ...resource, ...selection, source, page, size, pageIds, pageSelected, refresh };
}
