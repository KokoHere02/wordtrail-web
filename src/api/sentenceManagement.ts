import { request, ApiError, errorMessage } from './http';
import type { Page } from '../types/api';
import type { ManagedSentence, SentenceQuestionWrite, SentenceManagementQuery, SentenceImportPreview, SentenceImportBody, SentenceImported } from '../types/sentenceManagement';
const base = '/sentence-translation/management';
export const sentenceManagementApi = {
  access: () => request<{ canManage: boolean }>('GET', `${base}/access`),
  questions: (query: SentenceManagementQuery) => request<Page<ManagedSentence>>('GET', `${base}/questions`, undefined, query),
  question: (id: number) => request<ManagedSentence>('GET', `${base}/questions/${id}`),
  create: (body: SentenceQuestionWrite) => request<ManagedSentence>('POST', `${base}/questions`, body),
  update: (id: number, body: SentenceQuestionWrite) => request<ManagedSentence>('PUT', `${base}/questions/${id}`, body),
  previewText: (text: string) => request<SentenceImportPreview>('POST', `${base}/import/preview`, { text }),
  previewFile: (file: File) => { const form = new FormData(); form.append('file', file); return request<SentenceImportPreview>('POST', `${base}/import/preview`, form); },
  import: (body: SentenceImportBody) => request<SentenceImported>('POST', `${base}/import`, body),
};
export function sentenceServiceError(value: unknown) {
  if (value instanceof ApiError && value.status === 403) return '当前账号没有题库维护权限，请确认服务端维护账号配置。';
  const message = errorMessage(value);
  if (value instanceof ApiError && (value.status === 404 && !['SENTENCE_NOT_FOUND', 'SENTENCE_SESSION_NOT_FOUND', 'SENTENCE_ATTEMPT_NOT_FOUND', 'WORD_NOT_FOUND', 'BOOK_NOT_FOUND'].includes(value.code) || value.status === 405)) return `${message}；新接口暂不可用，请确认后端版本及重启状态。`;
  return message;
}
