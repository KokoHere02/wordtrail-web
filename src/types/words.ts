import type { Page, Result } from './api';
import type { PlanStatus } from './daily';
import type { TranslationFields } from './translation';

export type LearningSource = 'DAILY' | 'PRACTICE';
export interface WordDetailPlan {
  planStatus: PlanStatus;
  joinedAt: string;
  firstLearnedAt: string | null;
  lastLearnedAt: string | null;
  lastResult: Result | null;
  nextReviewAt: string | null;
  reviewLevel: number;
  started: boolean;
  due: boolean;
}
export interface WordDetail extends TranslationFields {
  id: number;
  word: string;
  phonetic: string | null;
  translation: string | null;
  personalBooks: { id: number; name: string }[];
  plan: WordDetailPlan | null;
}
export interface WeakWord extends TranslationFields {
  wordId: number;
  word: string;
  phonetic: string | null;
  translation: string | null;
  source: LearningSource;
  lastResult: 2 | 3;
  lastAnswerLogId: number;
  learningDate: string;
  lastAnsweredAt: string;
  answerCount: number;
  statisticsComplete: boolean;
}
export interface WeakWordsPage extends Page<WeakWord> {
  source: LearningSource;
  dataScope: 'RECORDED_EVENTS';
  statisticsComplete: boolean;
  incompleteWordCount: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
}
