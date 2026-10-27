import { ApiError, request } from './http';
import { requireTrainingQuestion, requireTrainingTask } from './dailyTraining';
import type { Page, Status } from '../types/api';
import type { TrainingTask, TrainingQuestion, TrainingAnswer, TrainingAnswerBody, TrainingItem, TrainingHistory } from '../types/dailyTraining';
export interface FollowTypingStatistics {
  learningDate: string; answerCount: number; correctCount: number; inputAccuracy: number | null;
  practicedWordCount: number; completedWordCount: number; lastPracticedAt: string | null;
}
export interface FollowTypingCreate { requestId: string; count: number }
const root = '/learning/follow-typing/batches';
function task(value: TrainingTask) {
  requireTrainingTask(value);
  if (value.taskType !== 'PRACTICE' || value.studyMode !== 'FOLLOW_TYPING' || value.learningDate !== null || value.dailyTarget !== 0 || value.modeVersion !== 0 || !Number.isInteger(value.followTypingTarget))
    throw new ApiError('独立跟拼服务尚未就绪，请确认已部署第 36 节新版后端。', 'FOLLOW_TYPING_DEPLOYMENT_REQUIRED');
  return value;
}
export const followTypingApi = {
  batches: (query: { status: Status; page: number; size: number }) => request<Page<TrainingTask>>('GET', root, undefined, query),
  create: async (body: FollowTypingCreate) => task(await request<TrainingTask>('POST', root, body)),
  task: async (id: number) => task(await request<TrainingTask>('GET', `${root}/${id}`)),
  next: async (id: number, itemId?: number) => {
    const q = await request<TrainingQuestion | null>('POST', `${root}/${id}/next`, itemId === undefined ? {} : { itemId });
    if (q === null) return null;
    requireTrainingQuestion(q); task(q.progress);
    if (q.mode !== 'FOLLOW_TYPING' || q.modeVersion !== 0 || !q.word) throw new ApiError('跟拼展示不完整，请重新同步。', 'STALE_TRAINING_ANSWER');
    return q;
  },
  answer: (id: number, itemId: number, body: TrainingAnswerBody) => {
    if (body.action !== 'ANSWER' || !('input' in body) || typeof body.input !== 'string' || 'result' in body)
      throw new ApiError('跟拼练习只接受英文输入。', 'INVALID_FOLLOW_TYPING_ANSWER');
    return request<TrainingAnswer>('PUT', `${root}/${id}/items/${itemId}/answer`, body);
  },
  // Shared session adapter never calls mode for this fixed-mode task.
  mode: async (): Promise<TrainingTask> => { throw new ApiError('跟拼方式固定，请通过学习入口进入其他练习。', 'FIXED_STUDY_MODE'); },
  abandon: async (id: number) => task(await request<TrainingTask>('POST', `${root}/${id}/abandon`)),
  items: (id: number, page: number, size = 20) => request<Page<TrainingItem>>('GET', `${root}/${id}/items`, undefined, { page, size }),
  history: (id: number, page: number, size = 20) => request<TrainingHistory>('GET', `${root}/${id}/attempts`, undefined, { page, size }),
  statistics: (date?: string) => request<FollowTypingStatistics>('GET', '/learning/follow-typing/statistics', undefined, date ? { date } : undefined),
};
