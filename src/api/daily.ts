import { request } from './http';
import type { Page, Status } from '../types/api';
import type { DailyTask, TodayOverview, DailyStudyItem, DailyAnswerBody, DailyCorrectionBody, DailyAnswerResult, PlanWord, PlanStatus, PlanQuery, JoinPlanResult, BatchPlanStatusResult, WordHistoryEvent, LearningSettings, DailyStatistics, LearningCalendar, StatisticsWord } from '../types/daily';
const itemPath = (batch: number, item: number) => `/learning-batches/${batch}/daily/items/${item}`;
export const dailyApi = {
  today: () => request<TodayOverview>('GET', '/learning/today'),
  start: () => request<DailyTask>('POST', '/learning/today/start'),
  task: (id: number) => request<DailyTask>('GET', `/learning-batches/${id}/daily`),
  item: (batch: number, item: number) => request<DailyStudyItem>('GET', itemPath(batch, item)),
  answer: (batch: number, item: number, body: DailyAnswerBody) => request<DailyAnswerResult>('PUT', `${itemPath(batch, item)}/answer`, body),
  correct: (batch: number, item: number, body: DailyCorrectionBody) => request<DailyAnswerResult>('PUT', `${itemPath(batch, item)}/correction`, body),
  tasks: (query: { page: number; size: number; status: Status }) => request<Page<DailyTask>>('GET', '/learning/daily-tasks', undefined, query),
  join: (bookId: number, wordIds: number[]) => request<JoinPlanResult>('POST', '/learning-plan/words', { bookId, wordIds }),
  plan: (query: PlanQuery) => request<Page<PlanWord>>('GET', '/learning-plan/words', undefined, query),
  updatePlan: (wordId: number, status: PlanStatus) => request<null>('PATCH', `/learning-plan/words/${wordId}`, { status }),
  updatePlanStatus: (wordIds: number[], status: PlanStatus) => request<BatchPlanStatusResult>('PATCH', '/learning-plan/words/status', { wordIds, status }),
  history: (wordId: number, query: { page: number; size: number }) => request<Page<WordHistoryEvent>>('GET', `/learning-plan/words/${wordId}/history`, undefined, query),
  settings: () => request<LearningSettings>('GET', '/learning/settings'),
  saveSettings: (dailyTarget: number) => request<LearningSettings>('PUT', '/learning/settings', { dailyTarget }),
  statistics: (date?: string) => request<DailyStatistics>('GET', '/learning/statistics/daily', undefined, date ? { date } : undefined),
  calendar: (month?: string) => request<LearningCalendar>('GET', '/learning/statistics/calendar', undefined, month ? { month } : undefined),
  statisticsWords: (query: { date?: string; page: number; size: number }) => request<Page<StatisticsWord>>('GET', '/learning/statistics/words', undefined, query),
};
