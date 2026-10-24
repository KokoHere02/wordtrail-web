import type { SentenceDifficulty } from './sentences';
export type SentenceQuestionStatus = 'ACTIVE' | 'INACTIVE';
export interface SentenceQuestionWrite {
  englishText: string; referenceTranslation: string; explanation: string;
  difficulty: SentenceDifficulty; source: string; sourceReference: string | null;
  status: SentenceQuestionStatus; version: number; wordIds: number[];
}
export interface ManagedSentence extends SentenceQuestionWrite {
  sentenceId: number; linkedWords: { wordId: number; word: string }[];
}
export interface SentenceManagementQuery {
  page: number; size: number; status?: SentenceQuestionStatus; difficulty?: SentenceDifficulty; wordId?: number; keyword?: string;
}
export type SentenceImportStatus = 'READY' | 'ALREADY_EXISTS' | 'DUPLICATE_IN_FILE' | 'INVALID';
export interface SentenceImportRow extends Partial<Omit<SentenceQuestionWrite, 'status' | 'version'>> {
  rowNumber: number; status: SentenceImportStatus; message: string; existingSentenceId: number | null;
}
export interface SentenceImportPreview {
  totalCount: number; readyCount: number; duplicateCount: number; invalidCount: number; rows: SentenceImportRow[];
}
export interface SentenceImported { importId: number; importedCount: number; sentenceIds: number[] }
export interface SentenceImportBody { text: string; requestId: string }
