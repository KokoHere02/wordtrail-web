import type { BookWordsChange } from './api';
import type { JoinPlanResult } from './daily';
import type { SentenceDifficulty } from './sentences';
export const sentenceErrorTags = [
  { value: 'VOCABULARY', label: '词义' }, { value: 'TENSE', label: '时态' },
  { value: 'NEGATION', label: '否定' }, { value: 'STRUCTURE', label: '句子结构' }, { value: 'OTHER', label: '其他' },
] as const;
export type SentenceErrorTag = typeof sentenceErrorTags[number]['value'];
export interface SentenceNote {
  content: string; errorTags: SentenceErrorTag[]; attemptId: number | null; version: number; updatedAt: string | null;
}
export type SentenceNoteWrite = Pick<SentenceNote, 'content' | 'errorTags' | 'attemptId' | 'version'>;
export interface SentenceNoteRow { sentenceId: number; englishText: string; available: boolean; note: SentenceNote }
export interface SentenceNotesQuery { page: number; size: number; errorTag?: SentenceErrorTag; wordId?: number; difficulty?: SentenceDifficulty }
export interface WordSentenceCount { wordId: number; sentenceCount: number }
export interface WordSentencePractice { wordIds: number[]; count?: number; difficulty?: SentenceDifficulty }
export interface SentenceCollection { bookId: number; wordId: number; collection: BookWordsChange; plan: JoinPlanResult | null }
