import { request } from './http';
import type { BatchCreated } from '../types/api';
import type { LearningSource, WeakWordsPage, WordDetail } from '../types/words';

export const wordsApi = {
  detail: (wordId: number) => request<WordDetail>('GET', `/words/${wordId}`),
  weak: (query: { source: LearningSource; page: number; size: number }) =>
    request<WeakWordsPage>('GET', '/learning/weak-words', undefined, query),
  practice: (source: LearningSource, wordIds: number[]) =>
    request<BatchCreated>('POST', '/learning/weak-words/practice', { source, wordIds }),
};
