import type { DictionaryWord } from './api';

export type BookImportFormat = 'TXT' | 'CSV';
export type BookImportStatus = 'MATCHED' | 'ALREADY_IN_BOOK' | 'DUPLICATE' | 'NOT_FOUND' | 'AMBIGUOUS' | 'INVALID';
export interface BookImportRow {
  rowNumber: number;
  input: string;
  word: string | null;
  status: BookImportStatus;
  duplicateOfRow: number | null;
  message: string;
  candidateCount: number;
  hasMoreCandidates: boolean;
  candidates: DictionaryWord[];
}
export interface BookImportPreview {
  bookId: number;
  format: BookImportFormat;
  totalCount: number;
  matchedCount: number;
  alreadyInBookCount: number;
  duplicateCount: number;
  notFoundCount: number;
  ambiguousCount: number;
  invalidCount: number;
  ignoredBlankCount: number;
  ignoredColumns: string[];
  readyWordIds: number[];
  records: BookImportRow[];
}
