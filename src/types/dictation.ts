import type { Status } from './api';
import type { TranslationFields, TranslationGroup } from './translation';

export type DictationSource = 'PLAN' | 'MISTAKES';
export type DictationVerdict = 'CORRECT' | 'INCORRECT' | 'REVEALED';
export type DictationItemStatus = 'PENDING' | 'RELEARNING' | 'DONE';
export type DictationCompletion = 'RECALLED' | 'LIMIT_REACHED' | null;
export type CreateDictation = { source: DictationSource; bookId?: number } & (
  { count: number; wordIds?: never } | { wordIds: number[]; count?: never }
);
export interface DictationTask {
  batchId: number; bookId: number | null; taskType: 'PRACTICE'; practiceMode: 'DICTATION'; status: Status;
  totalCount: number; completedCount: number; passedCount: number | null; needsPracticeCount: number | null; attemptCount: number;
  singleAttempt: boolean; canContinue: boolean; accuracy: number | null;
  nextItemId: number | null; attemptLimit: number; createdAt: string; completedAt: string | null;
}
export interface DictationQuestion {
  itemId: number; prompt: string; promptGroups: TranslationGroup[];
  presentationId: string; nextAttemptNo: number; correctStreak: number; requiredCorrectStreak: number; attemptLimit: number;
  answerPattern?: string; audioUrl?: string;
}
export type DictationAnswerBody = { attemptNo: 1; presentationId: string; requestId: string } & (
  { action: 'ANSWER'; input: string } | { action: 'REVEAL'; input?: never }
);
export interface DictationAnswer extends TranslationFields {
  logId: number; itemId: number; action: 'ANSWER' | 'REVEAL'; submittedAnswer: string | null; expectedWord?: string;
  verdict?: DictationVerdict; attemptNo: number; correctStreak?: number; itemStatus: DictationItemStatus;
  completionReason?: DictationCompletion; answeredAt: string; affectsSchedule: false; progress: DictationTask;
}
export interface DictationWord extends TranslationFields {
  itemId: number; wordId: number; word: string; lastVerdict: DictationVerdict; lastInput: string | null;
  attemptCount: number; correctStreak: number; learningStatus: DictationItemStatus; completionReason: DictationCompletion;
  learningDate: string; answeredAt: string;
}
export interface DictationHistory {
  logId: number; batchId: number; itemId: number; learningDate: string; answeredAt: string;
  taskType: 'PRACTICE'; practiceMode: 'DICTATION'; action: 'ANSWER' | 'REVEAL'; input: string | null;
  expectedWord: string; verdict: DictationVerdict; attemptNo: number; correctStreakBefore: number; correctStreakAfter: number;
  itemStatusAfter: DictationItemStatus; completionReason: DictationCompletion; affectsSchedule: false;
}
