import { request } from './http';
import type { Page } from '../types/api';
import type { SentenceQuestion, SentenceProgress, SentenceDifficulty } from '../types/sentences';
import type { WordSentenceCount, WordSentencePractice, SentenceCollection, SentenceNote, SentenceNoteWrite, SentenceNoteRow, SentenceNotesQuery } from '../types/sentenceLinks';
const base = '/sentence-translation';
export const sentenceLinksApi = {
  wordSentences: (id: number, query: { page: number; size: number; difficulty?: SentenceDifficulty }) => request<Page<SentenceQuestion>>('GET', `/words/${id}/sentences`, undefined, query),
  summary: (wordIds: number[]) => request<WordSentenceCount[]>('POST', `${base}/word-links/summary`, { wordIds }),
  practice: (body: WordSentencePractice) => request<SentenceProgress>('POST', `${base}/word-practice`, body),
  collect: (sessionId: number, itemId: number, wordId: number, bookId: number, joinPlan: boolean) => request<SentenceCollection>('POST', `${base}/sessions/${sessionId}/items/${itemId}/words/${wordId}/collect`, { bookId, joinPlan }),
  note: (id: number) => request<SentenceNote>('GET', `${base}/questions/${id}/note`),
  saveNote: (id: number, body: SentenceNoteWrite) => request<SentenceNote>('PUT', `${base}/questions/${id}/note`, body),
  notes: (query: SentenceNotesQuery) => request<Page<SentenceNoteRow>>('GET', `${base}/notes`, undefined, query),
};
