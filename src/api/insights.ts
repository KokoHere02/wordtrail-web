import { request } from './http';
import type { LearningSource } from '../types/words';
import type { LearningSummary, LearningTrend, TrendDays } from '../types/insights';
export const insightsApi = {
  trends: (source: LearningSource, days: TrendDays) => request<LearningTrend>('GET', '/learning/statistics/trends', undefined, { source, days }),
  summary: (source: LearningSource) => request<LearningSummary>('GET', '/learning/statistics/summary', undefined, { source }),
};
