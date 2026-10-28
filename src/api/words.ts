import { request } from './http';
import type { LearningSource, WeakWordsPage, WordDetail } from '../types/words';

export const wordsApi = {
  detail: (wordId: number) => request<WordDetail>('GET', `/words/${wordId}`),
  weak: (query: { source: LearningSource; page: number; size: number }) =>
    request<WeakWordsPage>('GET', '/learning/weak-words', undefined, query),
};
