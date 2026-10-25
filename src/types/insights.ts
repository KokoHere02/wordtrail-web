import type { Status } from './api';
import type { LearningSource } from './words';

export type TrendDays = 7 | 30;
export interface LearningCoverage {
  dataScope: 'RECORDED_ANSWERS_AND_DAILY_ITEMS' | 'RECORDED_ANSWERS';
  coverageScope: 'ALL_RETAINED_SOURCE_ITEMS';
  statisticsComplete: boolean;
  incompleteWordCount: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
}
export interface LearningTrendDay {
  learningDate: string;
  completedCount: number;
  answerCount: number;
  studiedCount: number;
  trainingCount: number;
  recalledCount: number;
  hasLearningActivity: boolean;
  hasRecordedAnswers: boolean;
}
export interface LearningTrend {
  source: LearningSource;
  days: TrendDays;
  from: string | null;
  to: string | null;
  totalCompletedCount: number;
  totalAnswerCount: number;
  totalTrainingCount: number;
  totalRecalledCount: number;
  coverage: LearningCoverage;
  records: LearningTrendDay[];
}
export interface LearningGoal {
  dailyTarget: number;
  completedCount: number;
  remainingCount: number;
  reached: boolean;
  targetSource: 'TASK_SNAPSHOT' | 'SETTING';
  batchId: number | null;
  taskStatus: Status | null;
}
export interface LearningSummary {
  learningDate: string;
  source: LearningSource;
  currentStreak: number;
  longestStreak: number;
  totalStudyDays: number;
  hasStudiedToday: boolean;
  todayStudiedCount: number;
  todayCompletedCount: number;
  todayAnswerCount: number;
  todayTrainingCount: number;
  todayRecalledCount: number;
  goal: LearningGoal | null;
  coverage: LearningCoverage;
}
