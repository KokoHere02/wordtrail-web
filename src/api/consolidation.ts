import { ApiError, request } from './http';
import { requireTrainingTask, requireTrainingQuestion } from './dailyTraining';
import type { Page, Status } from '../types/api';
import type { TranslationFields } from '../types/translation';
import type { DailyStudyMode, TrainingTask, TrainingQuestion, TrainingAnswer, TrainingAnswerBody, TrainingHistory, TrainingItem } from '../types/dailyTraining';

export const issueReasons = {
  SPELLING_ERROR: '拼写错误', ANSWER_REVEALED: '看过答案', UNRECOGNIZED: '自评不认识',
  ATTEMPT_LIMIT: '达到强化上限',
} as const;
export type IssueReason = keyof typeof issueReasons;
export type IssueCategory = 'ERROR' | 'ALL';
export function isIssueReason(value: unknown): value is IssueReason {
  return typeof value === 'string' && Object.hasOwn(issueReasons, value);
}
export function isIssueFilter(value: { category?: unknown; reason?: unknown }) {
  return (value.category === undefined || value.category === 'ERROR' || value.category === 'ALL') &&
    (value.reason === undefined || isIssueReason(value.reason));
}
function requireIssueFilter(value: { category?: unknown; reason?: unknown }) {
  if (!isIssueFilter(value)) throw new ApiError('此筛选已停用，请从当前错因清单重新选择。', 'UNSUPPORTED_ISSUE_FILTER');
}
export interface Issue extends TranslationFields {
  wordId: number; word: string; reason: IssueReason; category: IssueCategory; lastInput: string | null;
  mode: DailyStudyMode; trainingId: number; batchId: number; itemId: number; lastOccurredAt: string; occurrenceCount: number;
}
export type CreateConsolidation = { requestId: string; mode: DailyStudyMode; reason?: IssueReason; category: IssueCategory } &
  ({ count: number; wordIds?: never } | { wordIds: number[]; count?: never });
const root = '/learning/consolidation/batches';
export const consolidationApi = {
  issues: (query: { page: number; size: number; category?: IssueCategory; reason?: IssueReason }) => {
    requireIssueFilter(query);
    return request<Page<Issue>>('GET', '/learning/consolidation/issues', undefined, query);
  },
  summary: () => request<{ reason: IssueReason; category: IssueCategory; wordCount: number }[]>('GET', '/learning/consolidation/summary'),
  create: async (body: CreateConsolidation) => {
    requireIssueFilter(body);
    return requireTrainingTask(await request<TrainingTask>('POST', root, body));
  },
  batches: (query: { page: number; size: number; status: Status }) => request<Page<TrainingTask>>('GET', root, undefined, query),
  task: async (id: number) => requireTrainingTask(await request<TrainingTask>('GET', `${root}/${id}`)),
  mode: (id: number, mode: DailyStudyMode, expectedVersion: number) => request<TrainingTask>('PUT', `${root}/${id}/mode`, { mode, expectedVersion }),
  next: async (id: number, itemId?: number) => requireTrainingQuestion(await request<TrainingQuestion>('POST', `${root}/${id}/next`, itemId === undefined ? {} : { itemId })),
  answer: (id: number, itemId: number, body: TrainingAnswerBody) => request<TrainingAnswer>('PUT', `${root}/${id}/items/${itemId}/answer`, body),
  items: (id: number, page: number, size = 20) => request<Page<TrainingItem>>('GET', `${root}/${id}/items`, undefined, { page, size }),
  history: (id: number, page: number, size = 20) => request<TrainingHistory>('GET', `${root}/${id}/attempts`, undefined, { page, size }),
};
