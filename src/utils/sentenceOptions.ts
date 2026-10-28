import type { SentenceDifficulty } from '../types/sentences';
import type { SentenceQuestionStatus } from '../types/sentenceManagement';

export const sentenceLevelOptions: { value: SentenceDifficulty; label: string }[] = [
  { value: 1, label: '基础' }, { value: 2, label: '进阶' }, { value: 3, label: '挑战' },
];
export const sentenceDifficultyOptions: { value: SentenceDifficulty | ''; label: string }[] = [
  { value: '', label: '全部难度' }, ...sentenceLevelOptions,
];
export const sentenceStatusOptions: { value: SentenceQuestionStatus; label: string }[] = [
  { value: 'ACTIVE', label: '启用' }, { value: 'INACTIVE', label: '停用' },
];
export const sentenceStatusFilterOptions: { value: SentenceQuestionStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' }, ...sentenceStatusOptions,
];
export const sentenceDifficultyLabel = (value: SentenceDifficulty) => sentenceLevelOptions.find(option => option.value === value)?.label || '未分级';
