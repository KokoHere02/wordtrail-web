// Explicit offline adapter only. Scheduling here is a fixture, not backend verification.
import type { BookWord, Result } from '../types/api';
import type { PlanWord, PlanStatus, DailyTask, DailyStudyItem, DailyAnswerResult, DailyStatistics, WordHistoryEvent } from '../types/daily';
interface TaskFixture { task: DailyTask; items: DailyStudyItem[]; queue: number[]; skippedBefore?: Record<number, { status: DailyStudyItem['learningStatus']; attempt: number | null; position: number }> }
interface EventFixture { signature: string; batchId: number; receipt: Omit<DailyAnswerResult, 'progress'>; wordId?: number; history?: WordHistoryEvent; reinforcementBefore?: number | null }
interface State { plan: PlanWord[]; tasks: TaskFixture[]; events: Record<string, EventFixture>; nextId: number; latestLog: number | null; dailyTarget?: number }
const date = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
const timestamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(' ', 'T');
function read(account: string): State { return JSON.parse(localStorage.getItem(`wordory.mock.daily.${account}`) || '{"plan":[],"tasks":[],"events":{},"nextId":100000,"latestLog":null}') as State; }
const save = (account: string, state: State) => localStorage.setItem(`wordory.mock.daily.${account}`, JSON.stringify(state));
function fail(status: number, code: string, message: string): never { throw { status, code, message }; }
function recalculate(fixture: TaskFixture) {
  const { task, items, queue } = fixture;
  task.completedCount = items.filter(word => word.learningStatus === 'DONE').length;
  task.skippedCount = items.filter(word => word.learningStatus === 'SKIPPED').length;
  task.unfamiliarCount = items.filter(word => word.learningStatus === 'DONE' && (word.result !== 1 || word.completionReason === 'LIMIT_REACHED')).length;
  task.nextItemId = queue[0] ?? null;
  if (task.status === 'IN_PROGRESS' && !queue.length) task.status = 'COMPLETED';
}
function synchronizePlan(state: State, wordId: number, status: PlanStatus) {
  const fixture = state.tasks.find(entry => entry.task.learningDate === date());
  const item = fixture?.items.find(word => word.wordId === wordId);
  if (!fixture || !item) return;
  fixture.skippedBefore ||= {};
  if (status !== 'ACTIVE' && item.learningStatus !== 'SKIPPED') {
    fixture.skippedBefore[item.itemId] = { status: item.learningStatus, attempt: item.nextAttemptNo, position: Math.max(0, fixture.queue.indexOf(item.itemId)) };
    item.learningStatus = 'SKIPPED'; item.nextAttemptNo = null;
    fixture.queue = fixture.queue.filter(id => id !== item.itemId);
  } else if (status === 'ACTIVE' && fixture.task.status === 'IN_PROGRESS' && item.learningStatus === 'SKIPPED') {
    const saved = fixture.skippedBefore[item.itemId];
    if (saved) {
      item.learningStatus = saved.status; item.nextAttemptNo = saved.attempt;
      if (saved.status !== 'DONE') fixture.queue.splice(Math.min(saved.position, fixture.queue.length), 0, item.itemId);
      delete fixture.skippedBefore[item.itemId];
    }
  }
  recalculate(fixture);
}
function statisticsFor(state: State, day: string): DailyStatistics {
  const fixture = state.tasks.find(entry => entry.task.learningDate === day);
  const events = Object.values(state.events).filter(entry => entry.history?.learningDate === day && entry.history.taskType === 'DAILY');
  const learned = fixture?.items.filter(word => word.answerCount > 0 || word.result !== null || events.some(event => event.wordId === word.wordId)) || [];
  const incomplete = learned.filter(word => word.answerCount !== events.filter(event => event.wordId === word.wordId && event.history?.eventType === 'ANSWER').length);
  const normal = events.filter(event => event.history?.eventType === 'ANSWER');
  const activity = { trainingCount: normal.length, studiedCount: new Set(normal.map(event => event.wordId)).size,
    recalledCount: learned.filter(word => word.learningStatus === 'DONE' && word.completionReason === 'RECALLED' && word.result === 1 && !incomplete.includes(word)).length };
  return { ...activity, learningDate: day, completedCount: learned.filter(word => word.learningStatus === 'DONE').length, answerCount: events.filter(event => event.history?.eventType === 'ANSWER').length, newCompletedCount: learned.filter(word => word.learningStatus === 'DONE' && word.itemType === 'NEW').length, reviewCompletedCount: learned.filter(word => word.learningStatus === 'DONE' && word.itemType === 'REVIEW').length, unfamiliarCount: learned.filter(word => word.result === 2 || word.result === 3).length, hasLearningActivity: normal.length > 0, statisticsComplete: incomplete.length === 0, incompleteWordCount: incomplete.length };
}
export function mockLearned(account: string, wordId: number) { return read(account).plan.find(word => word.wordId === wordId); }
export function mockDailyEvidence(account: string) {
  const state = read(account);
  return {
    tasks: state.tasks.map(fixture => ({ task: fixture.task, items: fixture.items })),
    dailyTarget: state.dailyTarget ?? 20,
    events: Object.values(state.events).filter(event => event.wordId !== undefined && event.history).map(event => ({ ...event.history!, wordId: event.wordId! })),
    items: state.tasks.flatMap(fixture => fixture.items.map(item => ({ batchId: fixture.task.batchId, itemId: item.itemId, wordId: item.wordId, result: item.result, answerCount: item.answerCount ?? null }))),
  };
}
export function mockDaily(account: string, url: string, method: string, body: Record<string, unknown>, query: URLSearchParams, catalog: (id: number) => BookWord[], practiceEvents: (WordHistoryEvent & { wordId: number })[] = []): { data: unknown } | undefined {
  if (!url.startsWith('/learning-plan/') && !url.startsWith('/learning/') && !/^\/learning-batches\/\d+\/daily(?:\/|$)/.test(url)) return;
  const state = read(account);
  const respond = (data: unknown) => { save(account, state); return { data }; };
  const paginate = <T>(records: T[]) => { const page = Number(query.get('page') || 1); const size = Number(query.get('size') || 20); return { page, size, total: records.length, records: records.slice((page - 1) * size, page * size) }; };
  const pools = () => { const active = state.plan.filter(w => w.planStatus === 'ACTIVE'); return { active, due: active.filter(w => w.firstLearnedAt && w.nextReviewAt && w.nextReviewAt <= timestamp()), fresh: active.filter(w => !w.firstLearnedAt) }; };
  if (url === '/learning/settings') {
    if (method === 'put') {
      if (typeof body.dailyTarget !== 'number' || !Number.isInteger(body.dailyTarget) || body.dailyTarget < 1 || body.dailyTarget > 200 || Object.keys(body).length !== 1) fail(400, 'INVALID_PARAMETER', '每日目标必须是 1～200 的整数');
      state.dailyTarget = body.dailyTarget;
    }
    return respond({ dailyTarget: state.dailyTarget ?? 20 });
  }
  if (url.startsWith('/learning/statistics/')) {
    const day = query.get('date') || date();
    if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) fail(400, 'INVALID_PARAMETER', '日期格式不合法');
    if (url.endsWith('/daily')) return respond(statisticsFor(state, day));
    if (url.endsWith('/calendar')) {
      const month = query.get('month') || date().slice(0, 7);
      if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) fail(400, 'INVALID_PARAMETER', '月份格式不合法');
      const [year, index] = month.split('-').map(Number);
      const days = Array.from({ length: new Date(Date.UTC(year!, index!, 0)).getUTCDate() }, (_, offset) => {
        const { newCompletedCount: _new, reviewCompletedCount: _review, unfamiliarCount: _unfamiliar, ...summary } = statisticsFor(state, `${month}-${String(offset + 1).padStart(2, '0')}`);
        return summary;
      });
      return respond({ month, statisticsComplete: days.every(entry => entry.statisticsComplete), days });
    }
    if (url.endsWith('/words')) {
      const fixture = state.tasks.find(entry => entry.task.learningDate === day);
      return respond(paginate((fixture?.items || []).filter(word => word.answerCount > 0 || word.result !== null).map(word => ({ wordId: word.wordId, word: word.word, translation: state.plan.find(entry => entry.wordId === word.wordId)?.translation ?? null, translationGroups: state.plan.find(entry => entry.wordId === word.wordId)?.translationGroups, itemType: word.itemType, lastResult: word.result, answerCount: Object.values(state.events).filter(event => event.wordId === word.wordId && event.history?.learningDate === day && event.history.eventType === 'ANSWER').length, completed: word.learningStatus === 'DONE', statisticsComplete: word.answerCount === Object.values(state.events).filter(event => event.wordId === word.wordId && event.history?.learningDate === day && event.history.eventType === 'ANSWER').length }))));
    }
  }
  const historyMatch = url.match(/^\/learning-plan\/words\/(\d+)\/history$/);
  if (historyMatch) return respond(paginate([...Object.values(state.events).filter(event => event.wordId === Number(historyMatch[1]) && event.history).map(event => event.history!), ...practiceEvents.filter(event => event.wordId === Number(historyMatch[1]))].sort((a, b) => b.answeredAt.localeCompare(a.answeredAt) || b.logId - a.logId)));
  if (url === '/learning-plan/words' && method === 'post') {
    const ids = Array.isArray(body.wordIds) ? [...new Set(body.wordIds)] : [];
    const words = catalog(Number(body.bookId));
    if (!ids.length || ids.length > 100 || ids.some(id => !words.some(w => w.id === id))) fail(400, 'INVALID_PARAMETER', '请选择此词书中的 1～100 个单词');
    let addedCount = 0, reactivatedCount = 0, unchangedCount = 0;
    for (const id of ids) {
      const existing = state.plan.find(w => w.wordId === id);
      if (existing) {
        if (existing.planStatus === 'ACTIVE') unchangedCount++;
        else { existing.planStatus = 'ACTIVE'; synchronizePlan(state, existing.wordId, 'ACTIVE'); reactivatedCount++; }
      } else {
        const word = words.find(w => w.id === id)!;
        state.plan.push({ wordId: word.id, word: word.word, phonetic: word.phonetic, translation: word.translation, translationGroups: word.translationGroups, planStatus: 'ACTIVE', joinedAt: timestamp(), firstLearnedAt: null, lastLearnedAt: null, lastResult: null, nextReviewAt: null, reviewLevel: 0 });
        addedCount++;
      }
    }
    return respond({ requestedCount: ids.length, addedCount, reactivatedCount, unchangedCount });
  }
  if (url === '/learning-plan/words' && method === 'get') {
    const sortBy = query.get('sortBy') || 'joined_at'; const direction = query.get('direction') || 'DESC';
    if (!['joined_at', 'next_review_at'].includes(sortBy) || !['ASC', 'DESC'].includes(direction)) fail(400, 'INVALID_PARAMETER', '排序参数非法');
    const key = sortBy === 'joined_at' ? 'joinedAt' : 'nextReviewAt'; const sign = direction === 'ASC' ? 1 : -1;
    const records = state.plan.filter(w => w.planStatus === (query.get('status') || 'ACTIVE') && w.word.toLowerCase().startsWith((query.get('keyword') || '').toLowerCase()) && (query.get('learningStatus') === 'NEW' ? !w.firstLearnedAt : query.get('learningStatus') === 'LEARNED' ? !!w.firstLearnedAt : query.get('learningStatus') === 'DUE' ? w.planStatus === 'ACTIVE' && !!w.firstLearnedAt && !!w.nextReviewAt && w.nextReviewAt <= timestamp() : true));
    records.sort((a, b) => a[key] === null ? b[key] === null ? sign * (a.wordId - b.wordId) : 1 : b[key] === null ? -1 : sign * (a[key]!.localeCompare(b[key]!) || a.wordId - b.wordId));
    return respond(paginate(records));
  }
  const changeStatus = (ids: number[]) => {
    const status = body.status as PlanStatus;
    if (!['ACTIVE', 'PAUSED', 'REMOVED'].includes(status) || !ids.length || ids.length > 100 || ids.some(id => !Number.isInteger(id) || id <= 0)) fail(400, 'INVALID_PARAMETER', '计划状态或单词参数不合法');
    const words = ids.map(id => state.plan.find(word => word.wordId === id));
    if (words.some(word => !word)) fail(404, 'PLAN_WORD_NOT_FOUND', '计划单词不存在，整批未修改');
    if (words.some(word => word!.planStatus === 'REMOVED' && status !== 'REMOVED')) fail(409, 'INVALID_PLAN_TRANSITION', '已移出单词需从词书重新加入，整批未修改');
    let changedCount = 0;
    for (const word of words) { if (word!.planStatus !== status) changedCount++; word!.planStatus = status; synchronizePlan(state, word!.wordId, status); }
    return { requestedCount: ids.length, changedCount, unchangedCount: ids.length - changedCount, status };
  };
  if (url === '/learning-plan/words/status' && method === 'patch') return respond(changeStatus(Array.isArray(body.wordIds) ? [...new Set(body.wordIds as number[])] : []));
  const planMatch = url.match(/^\/learning-plan\/words\/(\d+)$/);
  if (planMatch && method === 'patch') {
    changeStatus([Number(planMatch[1])]);
    return respond(null);
  }
  const unassigned = (fixture?: TaskFixture) => {
    const p = pools();
    const assigned = new Set(fixture?.items.map(item => item.wordId) || []);
    return [...p.due, ...p.fresh].filter(word => !assigned.has(word.wordId));
  };
  if (url === '/learning/today') {
    const p = pools(); const fixture = state.tasks.find(t => t.task.learningDate === date());
    const task = fixture?.task || null;
    const unassignedCount = unassigned(fixture).length;
    return respond({ learningDate: date(), dailyTarget: task?.dailyTarget ?? state.dailyTarget ?? 20, activeCount: p.active.length, dueCount: p.due.length, newCount: p.fresh.length, unassignedCount, canAddMore: task?.status === 'COMPLETED' && unassignedCount > 0, task });
  }
  if (url === '/learning/today/start' && method === 'post') {
    const existing = state.tasks.find(t => t.task.learningDate === date());
    if (existing && existing.task.status !== 'COMPLETED') return respond(existing.task);
    const target = existing?.task.dailyTarget ?? state.dailyTarget ?? 20;
    const selected = unassigned(existing).slice(0, target);
    if (!selected.length) {
      if (existing) return respond(existing.task);
      fail(409, 'NO_DAILY_WORDS', '今天没有到期或待学单词，请先去词库加入计划。');
    }
    const batchId = existing?.task.batchId ?? state.nextId++;
    const items: DailyStudyItem[] = selected.map(w => ({ itemId: state.nextId++, wordId: w.wordId, word: w.word, phonetic: w.phonetic, itemType: w.firstLearnedAt ? 'REVIEW' : 'NEW', learningStatus: 'PENDING', result: null, answerCount: 0, nextAttemptNo: 1, nextItemId: null, correctableLogId: null, reinforcementRemaining: 0, attemptLimit: 6, completionReason: null }));
    const task: DailyTask = existing?.task ?? { batchId, learningDate: date(), dailyTarget: target, taskType: 'DAILY', status: 'IN_PROGRESS', totalCount: 0, completedCount: 0, skippedCount: 0, answerCount: 0, unfamiliarCount: 0, newCount: 0, reviewCount: 0, nextItemId: null };
    task.totalCount += items.length;
    task.newCount += items.filter(w => w.itemType === 'NEW').length;
    task.reviewCount += items.filter(w => w.itemType === 'REVIEW').length;
    task.status = 'IN_PROGRESS'; task.nextItemId = items[0]!.itemId;
    if (existing) { existing.items.push(...items); existing.queue.push(...items.map(w => w.itemId)); }
    else state.tasks.push({ task, items, queue: items.map(w => w.itemId) });
    return respond(task);
  }
  if (url === '/learning/daily-tasks') return respond(paginate(state.tasks.filter(t => t.task.status === (query.get('status') || 'IN_PROGRESS')).map(t => t.task).reverse()));
  const match = url.match(/^\/learning-batches\/(\d+)\/daily(?:\/items\/(\d+)(?:\/(answer|correction))?)?$/);
  if (!match) fail(404, 'NOT_FOUND', '演示接口不存在');
  const fixture = state.tasks.find(t => t.task.batchId === Number(match[1]));
  if (!fixture) fail(404, 'BATCH_NOT_FOUND', '每日任务不存在');
  const { task, items, queue } = fixture;
  if (!match[2]) return respond({ ...task, nextItemId: task.learningDate === date() ? task.nextItemId : null });
  const item = items.find(w => w.itemId === Number(match[2]));
  if (!item) fail(404, 'ITEM_NOT_FOUND', '单词不存在');
  const definition = state.plan.find(w => w.wordId === item.wordId);
  if (!match[3]) return respond({ ...item, ...(item.learningStatus === 'DONE' && definition?.translation != null ? { translation: definition.translation, translationGroups: definition.translationGroups } : {}), correctableLogId: item.learningStatus !== 'SKIPPED' && item.correctableLogId === state.latestLog && task.learningDate === date() ? item.correctableLogId : null, nextAttemptNo: task.learningDate === date() ? item.nextAttemptNo : null, nextItemId: task.learningDate === date() ? task.nextItemId : null });
  const signature = JSON.stringify({ url, body });
  const requestId = String(body.requestId || '');
  if (task.learningDate !== date()) fail(409, 'DAILY_TASK_EXPIRED', '历史每日任务只读，请返回今日。');
  if (item.learningStatus === 'SKIPPED' || state.plan.find(word => word.wordId === item.wordId)?.planStatus !== 'ACTIVE') fail(409, 'PLAN_WORD_UNAVAILABLE', '词已暂停、移出或跳过，请同步队列');
  const cached = state.events[requestId];
  if (cached) {
    if (cached.signature !== signature) fail(409, 'REQUEST_ID_REUSED', '请求键已用于其他内容');
    return respond({ ...cached.receipt, progress: state.tasks.find(t => t.task.batchId === cached.batchId)!.task });
  }
  if (![1, 2, 3].includes(Number(body.result)) || requestId.length < 8 || requestId.length > 64) fail(400, 'INVALID_PARAMETER', '自评参数不合法');
  const correction = match[3] === 'correction';
  if (correction && (body.logId !== item.correctableLogId || body.logId !== state.latestLog)) fail(409, 'CORRECTION_NOT_ALLOWED', '当前反馈不可更正');
  const original = correction ? Object.values(state.events).find(event => event.receipt.logId === body.logId && !event.receipt.correction) : undefined;
  const reinforcementBefore = correction ? original?.reinforcementBefore : item.reinforcementRemaining;
  if (reinforcementBefore === null || reinforcementBefore === undefined) fail(409, 'REVIEW_HISTORY_INCOMPLETE', '学习历史不完整，无法恢复巩固状态，请核查记录');
  if (correction) {
    const queued = queue.indexOf(item.itemId);
    if (queued >= 0) queue.splice(queued, 1);
  } else {
    if (queue[0] !== item.itemId || body.attemptNo !== item.nextAttemptNo) fail(409, 'STALE_DAILY_ANSWER', '队列已变化，请同步');
    queue.shift(); item.answerCount++; task.answerCount++;
  }
  item.result = body.result as Result;
  const firstFeedback = item.answerCount === 1;
  const remaining = firstFeedback ? item.result === 1 ? 0 : item.result === 2 ? 2 : 3
    : item.result === 1 ? Math.max(0, reinforcementBefore - 1) : Math.max(reinforcementBefore, item.result === 2 ? 2 : 3);
  item.reinforcementRemaining = remaining;
  item.learningStatus = remaining === 0 || item.answerCount >= item.attemptLimit ? 'DONE' : 'RELEARNING';
  item.completionReason = item.learningStatus === 'DONE' ? remaining === 0 ? 'RECALLED' : 'LIMIT_REACHED' : null;
  item.nextAttemptNo = item.learningStatus === 'DONE' ? null : item.answerCount + 1;
  const gap = item.result === 1 ? remaining >= 2 ? 5 : 7 : 3;
  if (item.learningStatus === 'RELEARNING') queue.splice(Math.min(gap, queue.length), 0, item.itemId);
  const logId = state.nextId++;
  if (!correction) { item.correctableLogId = logId; state.latestLog = logId; }
  const plan = state.plan.find(w => w.wordId === item.wordId)!;
  plan.firstLearnedAt ||= timestamp(); plan.lastLearnedAt = timestamp(); plan.lastResult = item.result;
  // Fixture scheduling intentionally uses tomorrow; the live UI always displays backend dates.
  plan.nextReviewAt = new Date(Date.now() + 86400000).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(' ', 'T');
  task.completedCount = items.filter(w => w.learningStatus === 'DONE').length;
  task.unfamiliarCount = items.filter(w => w.learningStatus === 'DONE' && (w.result !== 1 || w.completionReason === 'LIMIT_REACHED')).length;
  task.nextItemId = queue[0] ?? null;
  task.status = queue.length ? 'IN_PROGRESS' : 'COMPLETED';
  const receipt = { logId, itemId: item.itemId, result: item.result, translation: definition?.translation ?? null, translationGroups: definition?.translationGroups, answeredAt: timestamp(), correction };
  state.events[requestId] = { signature, batchId: task.batchId, receipt, wordId: item.wordId, reinforcementBefore, history: { logId, batchId: task.batchId, itemId: item.itemId, learningDate: task.learningDate, answeredAt: receipt.answeredAt, result: item.result, taskType: 'DAILY', eventType: correction ? 'CORRECTION' : 'ANSWER', correctsLogId: correction ? Number(body.logId) : null, attemptNo: item.answerCount, affectsSchedule: item.answerCount === 1, scheduleBefore: null, scheduleAfter: null, scheduleAvailable: false } };
  return respond({ ...receipt, progress: task });
}
