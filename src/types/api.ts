import type { TranslationFields } from './translation';
export type Result = 1 | 2 | 3;
export type Status = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
export type LearningStatus = "ALL" | "UNLEARNED" | "LEARNED";
export interface Envelope<T> {
  code: string;
  message: string;
  data: T;
}
export interface Page<T> {
  page: number;
  size: number;
  total: number;
  records: T[];
}
export interface User {
  id: number;
  username: string;
  nickname: string | null;
}
export interface Credentials {
  username: string;
  password: string;
  deviceName?: string;
}
export interface Registration extends Credentials {
  nickname?: string;
}
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: User;
}
export interface Book {
  id: number;
  name: string;
  description: string | null;
  wordCount: number;
  unlearnedCount: number;
  startedCount: number;
  dueCount: number;
  bookType: 'SYSTEM' | 'PERSONAL';
  editable: boolean;
}
export type BookScope = 'ALL' | 'SYSTEM' | 'PERSONAL';
export interface BookMetadata { name: string; description: string | null }
export interface DictionaryWord extends TranslationFields {
  id: number; word: string; phonetic: string | null; translation: string | null;
  inBook: boolean | null;
}
export interface DictionaryQuery extends PageQuery {
  keyword: string; matchType?: 'PREFIX' | 'EXACT'; bookId?: number;
}
export interface BookWordsChange {
  requestedCount: number; changedCount: number; unchangedCount: number;
}
export interface BookWord extends TranslationFields {
  id: number;
  word: string;
  phonetic: string | null;
  translation: string | null;
  learned: boolean;
  lastResult: Result | null;
}
export interface BatchCreated {
  batchId: number;
  bookId: number | null;
  selectionType: "BOOK" | "MANUAL";
  status: Status;
  wordCount: number;
}
export interface BatchListItem {
  batchId: number;
  bookId: number | null;
  bookName: string | null;
  selectionType: "BOOK" | "MANUAL";
  status: Status;
  totalCount: number;
  answeredCount: number;
  nextItemId: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface BatchProgress {
  batchId: number;
  bookId: number | null;
  selectionType: "BOOK" | "MANUAL";
  status: Status;
  wordCount: number;
  answeredCount: number;
  nextItemId: number | null;
}
export interface StudyItem extends TranslationFields {
  itemId: number;
  wordId: number;
  word: string;
  phonetic: string | null;
  sortOrder: number;
  result: Result | null;
  answered: boolean;
  translation?: string | null;
  answeredAt: string | null;
  nextItemId: number | null;
}
export interface AnswerResult extends TranslationFields {
  itemId: number;
  result: Result;
  translation: string | null;
  answeredAt: string;
  status: Status;
  wordCount: number;
  answeredCount: number;
  nextItemId: number | null;
}
export interface RoundResult {
  batchId: number;
  bookId: number | null;
  bookName: string | null;
  totalCount: number;
  knownCount: number;
  uncertainCount: number;
  unknownCount: number;
  relearnCount: number;
  completedAt: string | null;
  completedCount: number;
  answerCount: number;
  unfamiliarCount: number;
  statisticsComplete: boolean;
  incompleteWordCount: number;
  dataScope: 'RECORDED_EVENTS_AND_ITEMS';
}
export interface RoundWord extends TranslationFields {
  itemId: number;
  wordId: number;
  word: string;
  phonetic: string | null;
  translation: string | null;
  result: Result;
  answeredAt: string;
  answerCount: number;
  statisticsComplete: boolean;
}
export type CreateBatch = { bookId: number } & (
  | { selectionType: "BOOK"; count: number }
  | { selectionType: "MANUAL"; wordIds: number[] }
);
export interface PageQuery {
  page: number;
  size: number;
  keyword?: string;
}
