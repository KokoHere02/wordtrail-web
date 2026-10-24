import type { SentenceNote } from './sentenceLinks';
export type SentenceSource = 'BANK' | 'FAVORITES' | 'REVIEW' | 'DUE';
export type SentenceAssessment = 'UNDERSTOOD' | 'PARTIAL' | 'NOT_UNDERSTOOD';
export type SentenceDifficulty = 1 | 2 | 3;
export type SentenceSessionStatus = 'IN_PROGRESS' | 'COMPLETED';
export interface SentenceQuestion {
  sentenceId: number; englishText: string; difficulty: SentenceDifficulty;
  source: string; sourceReference: string | null; favorite: boolean;
}
export interface SentenceQuery { page: number; size: number; difficulty?: SentenceDifficulty; wordId?: number }
export type CreateSentenceSession = { source: SentenceSource; difficulty?: SentenceDifficulty; wordId?: number } & (
  { count: number; sentenceIds?: never } | { sentenceIds: number[]; count?: never }
);
export interface SentenceProgress {
  sessionId: number; selectionSource: SentenceSource; status: SentenceSessionStatus;
  totalCount: number; submissionCount: number; answerCount: number; revealCount: number; selfReviewCount: number;
  completedCount: number; understoodCount: number; partialCount: number; notUnderstoodCount: number;
  nextItemId: number | null; createdAt: string; completedAt: string | null;
}
export interface SentenceCurrent {
  personalNote?: SentenceNote;
  itemId: number; sentenceId: number; status: 'PENDING' | 'AWAITING_REVIEW' | 'DONE'; englishText: string;
  difficulty: SentenceDifficulty; source: string; sourceReference: string | null;
  linkedWords: { wordId: number; word: string }[];
  attemptId: number | null; action: 'ANSWER' | 'REVEAL' | null; translation: string | null;
  referenceTranslation: string | null; explanation: string | null;
  selfAssessment: SentenceAssessment | null; submittedAt: string | null;
}
export type SentenceSubmission = { requestId: string } & (
  { action: 'ANSWER'; translation: string } | { action: 'REVEAL'; translation?: never }
);
export interface SentenceSelfReview { assessment: SentenceAssessment; requestId: string }
export interface SentenceFeedback {
  attemptId: number; itemId: number; sentenceId: number; action: 'ANSWER' | 'REVEAL'; translation: string | null;
  referenceTranslation: string; explanation: string; selfAssessment: SentenceAssessment | null;
  learningDate: string; submittedAt: string; reviewDate: string | null; reviewedAt: string | null;
  progress: SentenceProgress;
  reviewSchedule?: SentenceSchedule | null;
}
export interface SentenceReviewItem {
  sentenceId: number; englishText: string; difficulty: SentenceDifficulty; available: boolean;
  attemptId: number; selfAssessment: 'PARTIAL' | 'NOT_UNDERSTOOD'; reviewedAt: string;
}
export interface SentenceHistory {
  attemptId: number; sessionId: number; itemId: number; sentenceId: number; englishText: string;
  action: 'ANSWER' | 'REVEAL'; translation: string | null; referenceTranslation: string; explanation: string;
  selfAssessment: SentenceAssessment | null; learningDate: string; submittedAt: string;
  reviewDate: string | null; reviewedAt: string | null;
}
export const sentenceAssessments: { value: SentenceAssessment; label: string }[] = [
  { value: 'UNDERSTOOD', label: '意思基本一致' }, { value: 'PARTIAL', label: '部分理解' }, { value: 'NOT_UNDERSTOOD', label: '未理解' },
];
export function sentenceAssessmentLabel(value: SentenceAssessment | null) { return sentenceAssessments.find(entry => entry.value === value)?.label || '尚未自评'; }

export interface SentenceSchedule {
  sentenceId: number; lastAttemptId: number; reviewLevel: number; lastAssessment: SentenceAssessment;
  reviewedAt: string; nextReviewDate: string;
}
export interface SentenceDueItem {
  sentenceId: number; englishText: string; difficulty: SentenceDifficulty; source: string; sourceReference: string | null;
  reviewLevel: number; lastAssessment: SentenceAssessment; nextReviewDate: string;
}
export interface SentenceStatisticsDay {
  learningDate: string; submissionCount: number; answerCount: number; revealCount: number; selfReviewCount: number;
}
export interface SentenceStatistics {
  submissionCount: number; answerCount: number; revealCount: number; selfReviewCount: number;
  weakSentenceCount: number; dueSentenceCount: number; learningDayCount: number;
  from: string; to: string; days: SentenceStatisticsDay[];
}
