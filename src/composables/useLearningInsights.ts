import { onMounted, ref, watch } from 'vue';
import { insightsApi } from '../api/insights';
import { useResource } from './useResource';
import type { LearningSource } from '../types/words';
import type { LearningSummary, LearningTrend, TrendDays } from '../types/insights';

export function useLearningInsights() {
  const source = ref<LearningSource>('DAILY');
  const days = ref<TrendDays>(7);
  const summary = useResource<LearningSummary>();
  const trends = useResource<LearningTrend>();
  const loadSummary = () => {
    const selectedSource = source.value;
    return summary.load(() => insightsApi.summary(selectedSource));
  };
  const loadTrends = () => {
    const selectedSource = source.value, selectedDays = days.value;
    return trends.load(() => insightsApi.trends(selectedSource, selectedDays));
  };
  const refresh = () => Promise.all([loadSummary(), loadTrends()]);
  watch(source, refresh);
  // Continuous-day records are independent of the selected chart window.
  watch(days, loadTrends);
  onMounted(refresh);
  return { source, days, summary, trends, loadSummary, loadTrends, refresh };
}
