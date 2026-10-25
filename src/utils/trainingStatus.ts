import type { TrainingItemState } from '../types/dailyTraining';

const reasons = { RECALLED: '回忆完成', FOLLOW_TYPED: '跟拼完成', ASSISTED: '辅助完成', LIMIT_REACHED: '达到当天强化上限' };
const statuses = { PENDING: '待学习', RELEARNING: '待强化', SKIPPED: '已跳过' };
export function trainingStatusLabel(state: TrainingItemState): string {
  if (state.itemStatus === 'DONE') return state.completionReason ? reasons[state.completionReason] ?? '已完成' : '已完成';
  return statuses[state.itemStatus] ?? '状态未提供';
}
