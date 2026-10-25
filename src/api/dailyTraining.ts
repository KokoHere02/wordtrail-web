import { ApiError, request } from './http';
import type { DailyTask } from '../types/daily';
import type { Page } from '../types/api';
import type { DailyStudyMode, TrainingTask, TrainingQuestion, TrainingAnswerBody, TrainingAnswer, TrainingStatistics, TrainingHistory, TrainingItem } from '../types/dailyTraining';

export function requireTrainingTask(task: DailyTask): TrainingTask {
  if (!['RECOGNITION', 'DICTATION', 'FOLLOW_TYPING'].includes(task.studyMode ?? '') ||
      !Number.isInteger(task.modeVersion) || !Number.isInteger(task.trainingCount)) {
    throw new ApiError('当前后端尚未提供统一每日训练。请先完成 011 迁移并启动新版后端，再重新同步。', 'TRAINING_DEPLOYMENT_REQUIRED');
  }
  return task as TrainingTask;
}
const root = (batchId: number) => `/learning-batches/${batchId}/daily`;
export function requireTrainingQuestion(question: TrainingQuestion): TrainingQuestion {
  if (!['QUESTION', 'AWAITING_SELF_ASSESSMENT', 'AWAITING_INPUT'].includes(question.phase) || typeof question.answerRevealed !== 'boolean' ||
      !['PENDING', 'RELEARNING', 'DONE'].includes(question.itemStatus)) {
    throw new ApiError('当前后端未提供第 30 节的训练阶段和词项状态，请重启新版后端后重新同步；无需新增 SQL 迁移。', 'TRAINING_DEPLOYMENT_REQUIRED');
  }
  return question;
}
export const dailyTrainingApi = {
  mode: (batchId: number, mode: DailyStudyMode, expectedVersion: number) =>
    request<TrainingTask>('PUT', `${root(batchId)}/mode`, { mode, expectedVersion }),
  next: async (batchId: number, itemId?: number) =>
    requireTrainingQuestion(await request<TrainingQuestion>('POST', `${root(batchId)}/training/next`, itemId === undefined ? {} : { itemId })),
  answer: (batchId: number, itemId: number, body: TrainingAnswerBody) =>
    request<TrainingAnswer>('PUT', `${root(batchId)}/items/${itemId}/training-answer`, body),
  statistics: (date?: string) => request<TrainingStatistics>('GET', '/learning/statistics/training', undefined, date ? { date } : undefined),
  history: (batchId: number, page: number, size = 20) => request<TrainingHistory>('GET', `${root(batchId)}/training/attempts`, undefined, { page, size }),
  items: (batchId: number, page: number, size = 20) => request<Page<TrainingItem>>('GET', `${root(batchId)}/training/items`, undefined, { page, size }),
};
