// Explicit fixture adapter. All counts below use recorded fixture events, never fabricate old logs.
import type { BatchCreated, BookWord, Result } from '../types/api';
import type { WordHistoryEvent } from '../types/daily';
import type { LearningSource, WeakWord, WeakWordsPage, WordDetail } from '../types/words';
import { mockDailyEvidence, mockLearned } from './mockDaily';
import { personalBooksForWord } from './mockBooks';
export type StudyLog = WordHistoryEvent & { wordId: number };
export interface EvidenceItem { batchId: number; itemId: number; wordId: number; result: Result | null; answerCount: number | null }
export function effectiveResult(answer: StudyLog, events: StudyLog[]) {
  return events.filter(event => event.eventType === 'CORRECTION' && event.correctsLogId === answer.logId).sort((a, b) => b.answeredAt.localeCompare(a.answeredAt) || b.logId - a.logId)[0]?.result ?? answer.result;
}
export function incompleteEvidence(items: EvidenceItem[], events: StudyLog[]) {
  const incomplete = new Set<number>();
  for (const item of items) {
    const answers = events.filter(event => event.eventType === 'ANSWER' && event.batchId === item.batchId && event.itemId === item.itemId).sort((a, b) => b.answeredAt.localeCompare(a.answeredAt) || b.logId - a.logId);
    if (item.answerCount === null || item.answerCount !== answers.length || item.result !== (answers[0] ? effectiveResult(answers[0], events) : null)) incomplete.add(item.wordId);
  }
  return incomplete;
}
export function weakEvidence(source: LearningSource, dictionary: BookWord[], items: EvidenceItem[], allEvents: StudyLog[]) {
  const events = allEvents.filter(event => event.taskType === source);
  const answers = events.filter(event => event.eventType === 'ANSWER').sort((a, b) => b.answeredAt.localeCompare(a.answeredAt) || b.logId - a.logId);
  const incomplete = incompleteEvidence(items, events);
  const seen = new Set<number>();
  const records: WeakWord[] = [];
  for (const answer of answers) {
    if (seen.has(answer.wordId)) continue;
    seen.add(answer.wordId);
    const result = effectiveResult(answer, events);
    if (result === 1) continue;
    const word = dictionary.find(entry => entry.id === answer.wordId);
    if (!word) continue;
    records.push({ wordId: word.id, word: word.word, phonetic: word.phonetic, translation: word.translation, translationGroups: word.translationGroups, source, lastResult: result, lastAnswerLogId: answer.logId, learningDate: answer.learningDate, lastAnsweredAt: answer.answeredAt, answerCount: answers.filter(event => event.wordId === answer.wordId).length, statisticsComplete: !incomplete.has(answer.wordId) });
  }
  return { records, source, dataScope: 'RECORDED_EVENTS' as const, statisticsComplete: incomplete.size === 0, incompleteWordCount: incomplete.size, firstRecordedAt: answers.at(-1)?.answeredAt ?? null, lastRecordedAt: answers[0]?.answeredAt ?? null };
}
interface Context {
  account: string; url: string; method: string; body: Record<string, unknown>; query: URLSearchParams;
  dictionary: BookWord[]; practiceEvents: StudyLog[]; practiceItems: EvidenceItem[];
  createPractice: (words: BookWord[]) => BatchCreated;
}
function fail(status: number, code: string, message: string): never { throw { status, code, message }; }
export function mockWordStudy(context: Context): { data: unknown; status: number } | undefined {
  const { account, url, method, body, query, dictionary } = context;
  const detail = url.match(/^\/words\/(\d+)$/);
  if (detail && method === 'get') {
    const word = dictionary.find(entry => entry.id === Number(detail[1]));
    if (!word) fail(404, 'WORD_NOT_FOUND', '单词不存在');
    const plan = mockLearned(account, word.id);
    const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(' ', 'T');
    const data: WordDetail = { id: word.id, word: word.word, phonetic: word.phonetic, translation: word.translation, translationGroups: word.translationGroups, personalBooks: personalBooksForWord(account, word.id), plan: plan ? { planStatus: plan.planStatus, joinedAt: plan.joinedAt, firstLearnedAt: plan.firstLearnedAt, lastLearnedAt: plan.lastLearnedAt, lastResult: plan.lastResult, nextReviewAt: plan.nextReviewAt, reviewLevel: plan.reviewLevel, started: !!plan.firstLearnedAt, due: plan.planStatus === 'ACTIVE' && !!plan.firstLearnedAt && !!plan.nextReviewAt && plan.nextReviewAt <= now } : null };
    return { data, status: 200 };
  }
  if (url !== '/learning/weak-words' && url !== '/learning/weak-words/practice') return;
  const source = method === 'post' ? body.source : query.get('source') || 'DAILY';
  if (source !== 'DAILY' && source !== 'PRACTICE') fail(400, 'INVALID_PARAMETER', '薄弱词来源不合法');
  const daily = mockDailyEvidence(account);
  const result = weakEvidence(source, dictionary, source === 'DAILY' ? daily.items : context.practiceItems, [...daily.events, ...context.practiceEvents]);
  if (url.endsWith('/practice') && method === 'post') {
    if (Object.keys(body).some(key => !['source', 'wordIds'].includes(key))) fail(400, 'INVALID_PARAMETER', '请求字段不合法');
    const ids = Array.isArray(body.wordIds) ? [...new Set(body.wordIds)] : [];
    if (!ids.length || ids.length > 100 || ids.some(id => !Number.isInteger(id) || Number(id) < 1)) fail(400, 'INVALID_PARAMETER', '请选择 1～100 个不同单词');
    if (ids.some(id => !dictionary.some(word => word.id === id))) fail(404, 'WORD_NOT_FOUND', '部分单词不存在');
    if (ids.some(id => !result.records.some(word => word.wordId === id))) fail(409, 'WEAK_WORD_SELECTION_CHANGED', '所选词不再全部属于本来源薄弱词，请刷新后重新选择');
    return { data: context.createPractice((ids as number[]).map(id => dictionary.find(word => word.id === id)!)), status: 201 };
  }
  const page = Number(query.get('page') || 1), size = Number(query.get('size') || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 100) fail(400, 'INVALID_PARAMETER', '分页参数不合法');
  const data: WeakWordsPage = { ...result, page, size, total: result.records.length, records: result.records.slice((page - 1) * size, page * size) };
  return { data, status: 200 };
}
