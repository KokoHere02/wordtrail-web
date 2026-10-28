import type { DailyTask } from '../types/daily';

export function dailyRecordStatus(task: Pick<DailyTask, 'status' | 'learningDate'>, today: string): string {
  if (task.status === 'ABANDONED') return '已放弃';
  if (task.status === 'COMPLETED') return '本轮已结束';
  return task.learningDate < today ? '已结束 · 未完成' : '进行中';
}
