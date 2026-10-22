import { request } from "./http";
import type {
  AnswerResult,
  BatchCreated,
  BatchListItem,
  BatchProgress,
  Book,
  BookMetadata,
  BookScope,
  BookWordsChange,
  DictionaryQuery,
  DictionaryWord,
  BookWord,
  CreateBatch,
  Credentials,
  LearningStatus,
  Page,
  PageQuery,
  Registration,
  Result,
  RoundResult,
  RoundWord,
  Status,
  StudyItem,
  TokenPair,
  User,
} from "../types/api";
export const api = {
  login: (body: Credentials) => request<TokenPair>("POST", "/auth/login", body),
  register: (body: Registration) =>
    request<User>("POST", "/auth/register", body),
  me: () => request<User>("GET", "/auth/me"),
  logout: (refreshToken: string) =>
    request<null>("POST", "/auth/logout", { refreshToken }),
  books: (query: PageQuery & { scope?: BookScope }) =>
    request<Page<Book>>("GET", "/word-books", undefined, query),
  book: (id: number) => request<Book>('GET', `/word-books/${id}`),
  createBook: (body: BookMetadata) => request<Book>('POST', '/word-books', body),
  updateBook: (id: number, body: BookMetadata) => request<Book>('PUT', `/word-books/${id}`, body),
  dictionary: (query: DictionaryQuery) => request<Page<DictionaryWord>>('GET', '/words', undefined, query),
  collectWords: (id: number, wordIds: number[]) => request<BookWordsChange>('POST', `/word-books/${id}/words`, { wordIds }),
  removeBookWords: (id: number, wordIds: number[]) => request<BookWordsChange>('DELETE', `/word-books/${id}/words`, { wordIds }),
  words: (id: number, query: PageQuery & { learningStatus: LearningStatus }) =>
    request<Page<BookWord>>("GET", `/word-books/${id}/words`, undefined, query),
  create: (body: CreateBatch) =>
    request<BatchCreated>("POST", "/learning-batches", body),
  batches: (query: { page: number; size: number; status: Status }) =>
    request<Page<BatchListItem>>("GET", "/learning-batches", undefined, query),
  progress: (id: number) =>
    request<BatchProgress>("GET", `/learning-batches/${id}`),
  item: (id: number, item: number) =>
    request<StudyItem>("GET", `/learning-batches/${id}/items/${item}`),
  answer: (id: number, item: number, result: Result, requestId?: string) =>
    request<AnswerResult>(
      "PUT",
      `/learning-batches/${id}/items/${item}/answer`,
      { result, ...(requestId ? { requestId } : {}) },
    ),
  result: (id: number) =>
    request<RoundResult>("GET", `/learning-batches/${id}/result`),
  resultWords: (
    id: number,
    query: { page: number; size: number; result?: Result },
  ) =>
    request<Page<RoundWord>>(
      "GET",
      `/learning-batches/${id}/result/words`,
      undefined,
      query,
    ),
  relearn: (id: number) =>
    request<BatchCreated>("POST", `/learning-batches/${id}/relearn`),
};
