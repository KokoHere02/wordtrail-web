import { request } from './http';
import type { Page, Status } from '../types/api';
import type { CreateDictation, DictationTask, DictationQuestion, DictationAnswerBody, DictationAnswer, DictationWord, DictationHistory } from '../types/dictation';
const taskPath = (id: number) => `/dictation/batches/${id}`;
export const dictationApi = {
  create: (body: CreateDictation) => request<DictationTask>('POST', '/dictation/batches', body),
  tasks: (query: { page: number; size: number; status: Status }) => request<Page<DictationTask>>('GET', '/dictation/batches', undefined, query),
  task: (id: number) => request<DictationTask>('GET', taskPath(id)),
  next: (id: number) => request<DictationQuestion>('POST', `${taskPath(id)}/next`),
  answer: (id: number, itemId: number, body: DictationAnswerBody) => request<DictationAnswer>('PUT', `${taskPath(id)}/items/${itemId}/answer`, body),
  resultWords: (id: number, query: { page: number; size: number }) => request<Page<DictationWord>>('GET', `${taskPath(id)}/result/words`, undefined, query),
  mistakes: (query: { page: number; size: number }) => request<Page<DictationWord>>('GET', '/dictation/mistakes', undefined, query),
  history: (wordId: number, query: { page: number; size: number }) => request<Page<DictationHistory>>('GET', `/dictation/words/${wordId}/history`, undefined, query),
};
