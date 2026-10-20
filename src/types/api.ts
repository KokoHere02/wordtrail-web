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
}
export interface BookWord {
  id: number;
  word: string;
  phonetic: string | null;
  translation: string | null;
  learned: boolean;
  lastResult: Result | null;
}
export interface BatchCreated {
  batchId: number;
  bookId: number;
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
export interface StudyItem {
  itemId: number;
  wordId: number;
  word: string;
  phonetic: string | null;
  sortOrder: number;
  result: Result | null;
  answered: boolean;
  translation?: string;
  answeredAt: string | null;
  nextItemId: number | null;
}
export interface AnswerResult {
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
}
export interface RoundWord {
  itemId: number;
  wordId: number;
  word: string;
  phonetic: string | null;
  translation: string | null;
  result: Result;
  answeredAt: string;
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
