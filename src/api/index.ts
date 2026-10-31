import { request } from "./http";
import type {
  Book,
  BookMetadata,
  BookScope,
  BookWordsChange,
  DictionaryQuery,
  DictionaryWord,
  BookWord,
  Credentials,
  LearningStatus,
  Page,
  PageQuery,
  Registration,
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
  randomBookWords: (id: number, count: number) =>
    request<BookWord[]>('GET', `/word-books/${id}/words/random`, undefined, { count }),
};
