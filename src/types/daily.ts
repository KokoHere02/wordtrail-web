import type { Result, Status } from './api';
export type PlanStatus = 'ACTIVE' | 'PAUSED' | 'REMOVED';
export type PlanLearningStatus = 'ALL' | 'NEW' | 'LEARNED' | 'DUE';
export type PlanSortBy = 'joined_at' | 'next_review_at';
export interface PlanQuery {
  page: number; size: number; status: PlanStatus; learningStatus: PlanLearningStatus;
  keyword?: string; sortBy?: PlanSortBy; direction?: 'ASC' | 'DESC';
}
export interface BatchPlanStatusResult {
  requestedCount: number; changedCount: number; unchangedCount: number; status: PlanStatus;
}
export interface WordHistoryEvent {
  logId: number; batchId: number; itemId: number; learningDate: string; answeredAt: string;
  result: Result; taskType: 'DAILY' | 'PRACTICE'; eventType: 'ANSWER' | 'CORRECTION';
  correctsLogId: number | null; attemptNo: number; affectsSchedule: boolean;
  scheduleBefore: Record<string, unknown> | null; scheduleAfter: Record<string, unknown> | null;
  scheduleAvailable: boolean;
}
export interface LearningSettings { dailyTarget: number }
export interface JoinPlanResult {
  requestedCount: number; addedCount: number; reactivatedCount: number; unchangedCount: number;
}
export interface PlanWord {
  wordId: number; word: string; phonetic: string | null; translation: string | null;
  planStatus: PlanStatus; joinedAt: string;
  firstLearnedAt: string | null; lastLearnedAt: string | null; lastResult: Result | null;
  nextReviewAt: string | null; reviewLevel: number;
}
export interface TodayOverview {
  learningDate: string; dailyTarget: number; activeCount: number; dueCount: number; newCount: number;
  task: DailyTask | null;
}
export interface DailyTask {
  batchId: number; learningDate: string; dailyTarget: number; taskType: 'DAILY'; status: Status;
  totalCount: number; completedCount: number; skippedCount: number; answerCount: number; unfamiliarCount: number;
  newCount: number; reviewCount: number; nextItemId: number | null;
}
export interface DailyStudyItem {
  itemId: number; wordId: number; word: string; phonetic: string | null; translation?: string;
  itemType: 'NEW' | 'REVIEW'; learningStatus: 'PENDING' | 'RELEARNING' | 'DONE' | 'SKIPPED';
  result: Result | null; answerCount: number; nextAttemptNo: number | null;
  nextItemId: number | null; correctableLogId: number | null;
}
export interface DailyAnswerBody { result: Result; attemptNo: number; requestId: string }
export interface DailyCorrectionBody { result: Result; logId: number; requestId: string }
export interface DailyAnswerResult {
  logId: number; itemId: number; result: Result; translation: string | null;
  answeredAt: string; correction: boolean; progress: DailyTask;
}
export interface DailyStatistics {
  learningDate: string; completedCount: number; answerCount: number;
  newCompletedCount: number; reviewCompletedCount: number; unfamiliarCount: number;
  hasLearningActivity: boolean; statisticsComplete: boolean; incompleteWordCount: number;
}
export interface CalendarDay {
  learningDate: string; completedCount: number; answerCount: number;
  hasLearningActivity: boolean; statisticsComplete: boolean; incompleteWordCount: number;
}
export interface LearningCalendar { month: string; statisticsComplete: boolean; days: CalendarDay[] }
export interface StatisticsWord {
  wordId: number; word: string; translation: string | null; itemType: 'NEW' | 'REVIEW' | null;
  lastResult: Result | null; answerCount: number; completed: boolean; statisticsComplete: boolean;
}
