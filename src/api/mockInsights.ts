// Read-only fixtures for the explicit mock mode; production statistics always come from the backend.
import type { LearningSource } from '../types/words';
import type { LearningCoverage, LearningGoal, LearningSummary, LearningTrend, LearningTrendDay } from '../types/insights';
import { mockDailyEvidence } from './mockDaily';
import { incompleteEvidence, type EvidenceItem, type StudyLog } from './mockWordStudy';
interface Context {
  account: string; url: string; method: string; query: URLSearchParams;
  practiceEvents: StudyLog[]; practiceItems: EvidenceItem[];
}
function offset(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function fail(message: string): never { throw { status: 400, code: 'INVALID_PARAMETER', message }; }
export function mockInsights(context: Context): { data: LearningTrend | LearningSummary } | undefined {
  const { account, url, method, query } = context;
  if (!['/learning/statistics/trends', '/learning/statistics/summary'].includes(url) || method !== 'get') return;
  const selected = query.get('source') ?? 'DAILY';
  if (selected !== 'DAILY' && selected !== 'PRACTICE') fail('统计来源须为 DAILY 或 PRACTICE');
  const source: LearningSource = selected;
  const daysText = query.get('days') ?? '7';
  if (url.endsWith('/trends') && !['7', '30'].includes(daysText)) fail('趋势天数须为 7 或 30');
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
  const daily = mockDailyEvidence(account);
  const events = [...daily.events, ...context.practiceEvents].filter(event => event.taskType === source);
  const answers = events.filter(event => event.eventType === 'ANSWER').sort((a, b) => a.answeredAt.localeCompare(b.answeredAt) || a.logId - b.logId);
  const incomplete = incompleteEvidence(source === 'DAILY' ? daily.items : context.practiceItems, events);
  const coverage: LearningCoverage = {
    dataScope: source === 'DAILY' ? 'RECORDED_ANSWERS_AND_DAILY_ITEMS' : 'RECORDED_ANSWERS', coverageScope: 'ALL_RETAINED_SOURCE_ITEMS',
    statisticsComplete: incomplete.size === 0, incompleteWordCount: incomplete.size,
    firstRecordedAt: answers[0]?.answeredAt ?? null, lastRecordedAt: answers.at(-1)?.answeredAt ?? null,
  };
  const answerDays = new Map<string, StudyLog[]>();
  for (const answer of answers) {
    const day = answer.answeredAt.slice(0, 10);
    if (day > today) continue;
    const records = answerDays.get(day) || [];
    records.push(answer); answerDays.set(day, records);
  }
  const completedDays = new Map<string, Set<number>>();
  if (source === 'DAILY') {
    for (const fixture of daily.tasks) {
      const day = fixture.task.learningDate;
      const ids = completedDays.get(day) || new Set<number>();
      for (const item of fixture.items) if (item.learningStatus === 'DONE') ids.add(item.wordId);
      completedDays.set(day, ids);
    }
  }
  const recordFor = (day: string): LearningTrendDay => {
    const normal = answerDays.get(day) || [];
    const studiedCount = new Set(normal.map(event => event.wordId)).size;
    return { learningDate: day, completedCount: source === 'DAILY' ? completedDays.get(day)?.size ?? 0 : studiedCount, answerCount: normal.length, studiedCount, trainingCount: normal.length, recalledCount: source === 'DAILY' ? new Set(daily.tasks.filter(fixture => fixture.task.learningDate === day).flatMap(fixture => fixture.items).filter(item => item.learningStatus === 'DONE' && item.completionReason === 'RECALLED' && item.result === 1 && !incomplete.has(item.wordId)).map(item => item.wordId)).size : 0, hasLearningActivity: normal.length > 0, hasRecordedAnswers: normal.length > 0 };
  };
  if (url.endsWith('/trends')) {
    const days = daysText === '30' ? 30 : 7;
    const records = Array.from({ length: days }, (_, index) => recordFor(offset(today, index - days + 1)));
    return { data: { source, days, from: records[0]!.learningDate, to: today, totalCompletedCount: records.reduce((sum, record) => sum + record.completedCount, 0), totalAnswerCount: records.reduce((sum, record) => sum + record.answerCount, 0), totalTrainingCount: records.reduce((sum, record) => sum + record.trainingCount, 0), totalRecalledCount: records.reduce((sum, record) => sum + record.recalledCount, 0), coverage, records } };
  }
  const studyDays = [...answerDays.keys()].sort();
  let longestStreak = 0, streak = 0;
  for (let index = 0; index < studyDays.length; index++) {
    streak = index > 0 && offset(studyDays[index - 1]!, 1) === studyDays[index] ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
  }
  let currentStreak = 0;
  let cursor = answerDays.has(today) ? today : offset(today, -1);
  while (answerDays.has(cursor)) { currentStreak++; cursor = offset(cursor, -1); }
  const current = recordFor(today);
  let goal: LearningGoal | null = null;
  if (source === 'DAILY') {
    const task = daily.tasks.find(fixture => fixture.task.learningDate === today)?.task;
    const dailyTarget = task?.dailyTarget ?? daily.dailyTarget;
    goal = { dailyTarget, completedCount: current.completedCount, remainingCount: Math.max(0, dailyTarget - current.completedCount), reached: current.completedCount >= dailyTarget, targetSource: task ? 'TASK_SNAPSHOT' : 'SETTING', batchId: task?.batchId ?? null, taskStatus: task?.status ?? null };
  }
  return { data: { learningDate: today, source, currentStreak, longestStreak, totalStudyDays: studyDays.length, hasStudiedToday: current.hasRecordedAnswers, todayStudiedCount: current.studiedCount, todayCompletedCount: current.completedCount, todayAnswerCount: current.answerCount, todayTrainingCount: current.trainingCount, todayRecalledCount: current.recalledCount, goal, coverage } };
}
