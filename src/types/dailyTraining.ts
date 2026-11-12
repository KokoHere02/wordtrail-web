import type { Page, Result } from './api';
import type { DailyTask } from './daily';
import type { TranslationFields } from './translation';

export type DailyStudyMode = 'RECOGNITION' | 'DICTATION' | 'FOLLOW_TYPING' | 'LISTEN_DICTATION';
export type TrainingScope = 'DAILY' | 'CONSOLIDATION' | 'FOLLOW_TYPING';
export interface Pronunciation { autoPlay: boolean; accent: 'US' | 'UK'; playbackRate: number; repeatCount: number }
export type TrainingPhase = 'QUESTION' | 'AWAITING_SELF_ASSESSMENT' | 'AWAITING_INPUT';
export type TrainingItemStatus = 'PENDING' | 'RELEARNING' | 'DONE' | 'SKIPPED';
export type CompletionReason = 'RECALLED' | 'FOLLOW_TYPED' | 'ASSISTED' | 'LIMIT_REACHED';
export interface TrainingItemState { itemStatus: TrainingItemStatus; completionReason?: CompletionReason | null }
export const dailyModeLabels: Record<DailyStudyMode, string> = {
  RECOGNITION: '看英文认中文', DICTATION: '单词默写', FOLLOW_TYPING: '跟拼', LISTEN_DICTATION: '听音默写',
};
export interface TrainingTask extends Omit<DailyTask, 'taskType' | 'learningDate'> {
  followTypingTarget?: number | null;
  taskType: 'DAILY' | 'PRACTICE'; learningDate: string | null;
  studyMode: DailyStudyMode; modeVersion: number; trainingCount: number;
}
export interface TrainingQuestion extends TranslationFields, TrainingItemState {
  itemId: number; mode: DailyStudyMode; modeVersion: number; presentationId: string; attemptNo: number;
  wordId?: number; word?: string; phonetic?: string | null; answerPattern?: string;
  audioUrl?: string | null; pronunciation?: Pronunciation;
  phase: TrainingPhase; answerRevealed: boolean;
  hintUsed: boolean; extraTraining: boolean; progress: TrainingTask;
}
interface TrainingIdentity {
  requestId: string; presentationId: string; modeVersion: number; attemptNo: number;
}
export type TrainingAnswerBody = TrainingIdentity & (
  { action: 'REVEAL'; input?: never; result?: never } |
  { action: 'ANSWER'; result: Result; input?: never } |
  { action: 'ANSWER'; input: string; result?: never }
);
export interface TrainingAnswer extends TranslationFields, TrainingItemState {
  trainingId: number; itemId: number; wordId: number; mode: DailyStudyMode; action: 'ANSWER' | 'REVEAL';
  verdict: 'SELF_ASSESSED' | 'CORRECT' | 'INCORRECT' | 'REVEALED';
  input: string | null; selfAssessment: Result | null; word: string;
  hintUsed: boolean; extraTraining: boolean; attemptNo: number; reviewLogId: number | null;
  affectsSchedule: boolean; answeredAt: string; progress: TrainingTask;
}
export interface TrainingModeStatistics {
  mode: DailyStudyMode; trainingCount: number; answerCount: number; revealCount: number; correctCount: number;
  inputAccuracy: number | null; hintedAnswerCount: number;
  recognizedCount: number; uncertainCount: number; unknownCount: number;
}
export interface TrainingStatistics {
  learningDate: string; completedWordCount: number; modes: TrainingModeStatistics[];
}
export type TrainingHistory = Page<TrainingAnswer>;
export interface TrainingItem extends TranslationFields, TrainingItemState {
  itemId: number; wordId?: number; word?: string; phonetic?: string | null;
  sortOrder: number; itemType: 'NEW' | 'REVIEW'; answerCount: number; trainingCount: number;
  completedAt: string | null; current: boolean; canExtraTrain: boolean;
}
