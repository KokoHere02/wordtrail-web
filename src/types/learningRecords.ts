import type { Status } from './api';

export type LearningRecordType = 'DAILY' | 'DICTATION' | 'SENTENCE';
export type LearningRecordFilter = 'ALL' | LearningRecordType;
export type LearningRecordStatus = Status | 'INCOMPLETE';
export interface LearningRecord {
  type: LearningRecordType; businessId: number; recordDate: string; createdAt: string;
  rawStatus: Status; displayStatus: LearningRecordStatus; canContinue: boolean;
  completedCount: number; totalCount: number; skippedCount: number | null;
  newCount: number | null; reviewCount: number | null; dailyTarget: number | null;
  goalReached: boolean | null; source: string | null; bookId: number | null; singleAttempt: boolean | null;
}
export interface LearningRecordsQuery {
  type: LearningRecordFilter; status: 'ALL' | LearningRecordStatus; page: number; size: number;
}
