import { computed, watch } from 'vue';
import { sentenceLinksApi } from '../api/sentenceLinks';
import { sentenceServiceError } from '../api/sentenceManagement';
import { useResource } from './useResource';
import type { WordSentenceCount } from '../types/sentenceLinks';
export function useWordSentenceCounts(ids: () => number[]) {
  const resource = useResource<WordSentenceCount[]>();
  async function refresh() {
    const current = [...new Set(ids())];
    await resource.load(async () => {
      if (!current.length) return [];
      try { return await sentenceLinksApi.summary(current); }
      catch (value) { throw new Error(sentenceServiceError(value)); }
    });
  }
  watch(ids, refresh, { immediate: true });
  const counts = computed(() => new Map(resource.data.value?.map(row => [row.wordId, row.sentenceCount])));
  return { ...resource, counts, refresh };
}
