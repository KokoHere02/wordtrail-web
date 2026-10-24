import { computed, onMounted, ref, watch } from 'vue';
import { wordsApi } from '../api/words';
import { ApiError } from '../api/http';
import { useResource } from './useResource';
import { useSelection } from './useSelection';
import { usePracticeLaunch } from './usePracticeLaunch';
import type { LearningSource, WeakWordsPage } from '../types/words';

export function useWeakWords() {
  const source = ref<LearningSource>('DAILY');
  const page = ref(1);
  const size = 10;
  const resource = useResource<WeakWordsPage>();
  const selection = useSelection();
  const notice = ref('');
  const creation = usePracticeLaunch(async error => {
    if (error instanceof ApiError && ['WEAK_WORD_SELECTION_CHANGED', 'WORD_NOT_FOUND'].includes(error.code)) {
      selection.clear();
      notice.value = '选择已失效，列表已刷新，请重新选择。';
      await refresh();
    }
  });
  const pageIds = computed(() => resource.data.value?.records.map(word => word.wordId) || []);
  const pageSelected = computed(() => pageIds.value.length > 0 && pageIds.value.every(id => selection.selected.value.has(id)));
  async function refresh() {
    await resource.load(() => wordsApi.weak({ source: source.value, page: page.value, size }));
    if (resource.data.value && !resource.data.value.records.length && page.value > 1) page.value = Math.max(1, Math.ceil(resource.data.value.total / size));
  }
  watch(source, () => { selection.clear(); notice.value = ''; if (page.value !== 1) page.value = 1; else void refresh(); });
  watch(page, refresh);
  onMounted(refresh);
  async function practice() {
    if (resource.loading.value || resource.error.value || !selection.count.value || selection.count.value > 100) return;
    const selectedSource = source.value;
    const ids = [...selection.selected.value];
    await creation.launch(() => wordsApi.practice(selectedSource, ids));
  }
  return { ...resource, ...selection, source, page, size, notice, pageIds, pageSelected, creation, refresh, practice };
}
