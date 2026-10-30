import { request } from './http';
import type { Page } from '../types/api';
import type { LearningRecord, LearningRecordsQuery } from '../types/learningRecords';

export const learningRecordsApi = {
  list: (query: LearningRecordsQuery) => request<Page<LearningRecord>>('GET', '/learning/records', undefined, query),
};
