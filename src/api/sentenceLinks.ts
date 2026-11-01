import { request } from './http';
import type { Page } from '../types/api';
import type { SentenceNote, SentenceNoteWrite, SentenceNoteRow, SentenceNotesQuery } from '../types/sentenceLinks';
const base = '/sentence-translation';
export const sentenceLinksApi = {
  note: (id: number) => request<SentenceNote>('GET', `${base}/questions/${id}/note`),
  saveNote: (id: number, body: SentenceNoteWrite) => request<SentenceNote>('PUT', `${base}/questions/${id}/note`, body),
  notes: (query: SentenceNotesQuery) => request<Page<SentenceNoteRow>>('GET', `${base}/notes`, undefined, query),
};
