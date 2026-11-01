import { request } from './http';
import type { Page } from '../types/api';

export interface SentencePracticeRecord { id: number; sentenceId: number; englishText: string; translation: string; referenceTranslation: string; explanation: string | null; createdAt: string }
export interface SentencePracticeDay { date: string; submissions: number; sentences: number }
export interface SentencePracticeStatistics { submissions: number; sentences: number; learningDays: number; currentStreak: number; longestStreak: number; days: SentencePracticeDay[] }
export const sentencePracticeApi = {
  records: (date: string | undefined, page: number, size = 20) => request<Page<SentencePracticeRecord>>('GET', '/sentence-practice/records', undefined, { date, page, size }),
  statistics: (from: string, to: string) => request<SentencePracticeStatistics>('GET', '/sentence-practice/statistics', undefined, { from, to }),
};
