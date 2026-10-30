import { request } from './http';
import type { Page } from '../types/api';
import type { SentenceQuestion, SentenceQuery, SentenceReviewItem, CreateSentenceSession, SentenceProgress, SentenceSessionStatus, SentenceCurrent, SentenceSubmission, SentenceSelfReview, SentenceFeedback, SentenceHistory } from '../types/sentences';
import type { SentenceDueItem, SentenceSchedule, SentenceStatistics, SentenceStatisticsCalendar, SentenceStatisticsDate, SentenceStatisticsAttempt } from '../types/sentences';
const base = '/sentence-translation';
const session = (id: number) => `${base}/sessions/${id}`;
export const sentencesApi = {
  questions: (query: SentenceQuery) => request<Page<SentenceQuestion>>('GET', `${base}/questions`, undefined, query),
  favorites: (query: SentenceQuery) => request<Page<SentenceQuestion>>('GET', `${base}/favorites`, undefined, query),
  favorite: (sentenceId: number, favorite: boolean) => request<{ sentenceId: number; favorite: boolean }>('PUT', `${base}/questions/${sentenceId}/favorite`, { favorite }),
  reviewQueue: (query: { page: number; size: number }) => request<Page<SentenceReviewItem>>('GET', `${base}/review-queue`, undefined, query),
  create: (body: CreateSentenceSession) => request<SentenceProgress>('POST', `${base}/sessions`, body),
  sessions: (query: { page: number; size: number; status: SentenceSessionStatus }) => request<Page<SentenceProgress>>('GET', `${base}/sessions`, undefined, query),
  progress: (id: number) => request<SentenceProgress>('GET', session(id)),
  current: (id: number) => request<SentenceCurrent | null>('GET', `${session(id)}/current`),
  submit: (id: number, itemId: number, body: SentenceSubmission) => request<SentenceFeedback>('PUT', `${session(id)}/items/${itemId}/submission`, body),
  selfReview: (id: number, itemId: number, body: SentenceSelfReview) => request<SentenceFeedback>('PUT', `${session(id)}/items/${itemId}/self-review`, body),
  result: (id: number, query: { page: number; size: number }) => request<Page<SentenceHistory>>('GET', `${session(id)}/result`, undefined, query),
  history: (sentenceId: number, query: { page: number; size: number }) => request<Page<SentenceHistory>>('GET', `${base}/questions/${sentenceId}/history`, undefined, query),
  due: (query: SentenceQuery) => request<Page<SentenceDueItem>>('GET', `${base}/reviews/due`, undefined, query),
  schedule: (sentenceId: number) => request<SentenceSchedule | null>('GET', `${base}/questions/${sentenceId}/schedule`),
  statistics: (days: 7 | 30) => request<SentenceStatistics>('GET', `${base}/statistics`, undefined, { days }),
  statisticsCalendar: (month?: string) => request<SentenceStatisticsCalendar>('GET', `${base}/statistics/calendar`, undefined, month ? { month } : undefined),
  statisticsDaily: (date?: string) => request<SentenceStatisticsDate>('GET', `${base}/statistics/daily`, undefined, date ? { date } : undefined),
  statisticsAttempts: (query: { date: string; page: number; size: number }) => request<Page<SentenceStatisticsAttempt>>('GET', `${base}/statistics/attempts`, undefined, query),
};
