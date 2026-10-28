import { computed } from 'vue';
import { insightsApi } from '../api/insights';
import { useResource } from './useResource';
import type { LearningSummary } from '../types/insights';

// Queue completion and daily achievement are different server states.
export function useDailyGoal(date: () => string | undefined, batchId: () => number | undefined = () => undefined) {
  const resource = useResource<LearningSummary>();
  const goal = computed(() => {
    const summary = resource.data.value;
    if (resource.loading.value || summary?.learningDate !== date()) return undefined;
    if (batchId() !== undefined && summary?.goal?.batchId !== batchId()) return undefined;
    return summary?.goal ?? undefined;
  });
  const refresh = () => resource.load(() => insightsApi.summary('DAILY'));
  return { goal, error: resource.error, refresh };
}
