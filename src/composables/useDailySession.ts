import { ref } from 'vue';
import { dailyApi } from '../api/daily';
import { ApiError, errorMessage } from '../api/http';
import type { Result } from '../types/api';
import type { DailyTask, DailyStudyItem, DailyAnswerResult, DailyAnswerBody, DailyCorrectionBody, TodayOverview } from '../types/daily';

type Pending = { batchId: number; item: DailyStudyItem } & (
  { kind: 'answer'; body: DailyAnswerBody } | { kind: 'correction'; body: DailyCorrectionBody }
);

// A request with an unknown outcome must survive reload with the same id and body.
// Scope it to the authenticated user. This contains no credentials.
export function useDailySession(userId: number) {
  const key = `wordory.daily.pending.${userId}`;
  const progress = ref<DailyTask>();
  const overview = ref<TodayOverview>();
  const item = ref<DailyStudyItem>();
  const receipt = ref<DailyAnswerResult>();
  const answerDetails = ref<DailyStudyItem>();
  const detailsError = ref('');
  let answerLogId: number | null = null;
  const pending = ref<Pending>();
  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');
  const expired = ref(false);
  const historical = ref(false);
  const noWords = ref(false);
  const notice = ref('');
  const correctableLogId = ref<number | null>(null);
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (raw && typeof raw === 'object' && 'batchId' in raw && 'kind' in raw && 'body' in raw && 'item' in raw) pending.value = raw as Pending;
  } catch { /* A disabled storage area must not break page setup. */ }
  function remember(value?: Pending) {
    if (value) {
      try { sessionStorage.setItem(key, JSON.stringify(value)); }
      catch { error.value = '无法保存待确认请求，请允许此页面使用会话存储后重试。'; return false; }
    } else {
      try { sessionStorage.removeItem(key); } catch { /* A stale entry can safely replay the same idempotent request on reload. */ }
    }
    pending.value = value;
    return true;
  }
  async function readQueue(batchId: number) {
    const task = await dailyApi.task(batchId);
    await readCurrent(task);
    receipt.value = undefined;
    answerDetails.value = undefined;
    detailsError.value = '';
    answerLogId = null;
    correctableLogId.value = null;
  }
  async function readCurrent(initial: DailyTask) {
    let task = initial;
    for (let attempt = 0; attempt < 2; attempt++) {
      progress.value = task;
      if (task.status !== 'IN_PROGRESS' || task.nextItemId === null) { item.value = undefined; return; }
      const detail = await dailyApi.item(task.batchId, task.nextItemId);
      if (['PENDING', 'RELEARNING'].includes(detail.learningStatus) && detail.nextAttemptNo !== null) {
        if (!Number.isInteger(detail.attemptLimit) || detail.attemptLimit < 1 || detail.nextAttemptNo < 1 || detail.nextAttemptNo > detail.attemptLimit) {
          item.value = undefined;
          throw new ApiError('作答上限或序号无效，请确认后端已更新。', 'DAILY_CONTRACT_MISMATCH');
        }
        item.value = detail; return;
      }
      // A plan change can happen between reading progress and its item. Never answer SKIPPED/DONE.
      item.value = undefined;
      receipt.value = undefined;
      correctableLogId.value = null;
      notice.value = '计划或队列已变化，已重新获取任务。跳过的词不计为完成。';
      task = await dailyApi.task(task.batchId);
    }
    progress.value = task;
    if (task.status === 'IN_PROGRESS' && task.nextItemId !== null) throw new Error('队列仍在变化，请重新同步后继续。');
  }
  async function open(batchId?: number) {
    if (loading.value || saving.value) return;
    loading.value = true;
    error.value = '';
    notice.value = '';
    expired.value = false;
    noWords.value = false;
    try {
      const today = await dailyApi.today();
      overview.value = today;
      if (pending.value) {
        // Resolve an outstanding write before advancing to any other task.
        progress.value = await dailyApi.task(pending.value.batchId);
        historical.value = progress.value.learningDate !== today.learningDate;
        item.value = pending.value.item;
        error.value = '上次保存结果尚未确认，请重试原请求后继续。';
      } else {
        const task = batchId ? await dailyApi.task(batchId) : today.task;
        historical.value = task ? task.learningDate !== today.learningDate : false;
        progress.value = task ?? undefined;
        if (!task) { item.value = undefined; noWords.value = today.unassignedCount === 0; }
        else if (historical.value) item.value = undefined;
        else await readCurrent(task);
        receipt.value = undefined;
        answerDetails.value = undefined;
        detailsError.value = '';
        answerLogId = null;
        correctableLogId.value = null;
      }
    } catch (e) { handleError(e); }
    finally { loading.value = false; }
  }
  function handleError(e: unknown) {
    error.value = errorMessage(e);
    noWords.value = e instanceof ApiError && e.code === 'NO_DAILY_WORDS';
    if (e instanceof ApiError && e.code === 'DAILY_TASK_EXPIRED') {
      expired.value = true;
      remember();
      correctableLogId.value = null;
    }
  }
  async function loadAnswerDetails(batchId: number, itemId: number, originalLogId: number) {
    answerDetails.value = undefined;
    correctableLogId.value = null;
    detailsError.value = '';
    try {
      const current = await dailyApi.item(batchId, itemId);
      if (!Number.isInteger(current.attemptLimit) || current.attemptLimit < 1) throw new ApiError('接口未返回有效作答上限，请确认后端已更新。', 'DAILY_CONTRACT_MISMATCH');
      answerDetails.value = current;
      if (current.learningStatus !== 'SKIPPED' && current.correctableLogId === originalLogId) correctableLogId.value = originalLogId;
    } catch (e) { detailsError.value = errorMessage(e); }
  }
  async function syncAnswerDetails() {
    if (saving.value || loading.value || pending.value || !receipt.value || !item.value || !progress.value || answerLogId === null) return;
    saving.value = true;
    try { await loadAnswerDetails(progress.value.batchId, item.value.itemId, answerLogId); }
    finally { saving.value = false; }
  }
  async function send() {
    if (!pending.value || saving.value || expired.value) return;
    const action = pending.value;
    saving.value = true;
    error.value = '';
    answerDetails.value = undefined;
    detailsError.value = '';
    try {
      const saved = action.kind === 'answer'
        ? await dailyApi.answer(action.batchId, action.item.itemId, action.body)
        : await dailyApi.correct(action.batchId, action.item.itemId, action.body);
      receipt.value = saved;
      progress.value = saved.progress;
      item.value = action.item;
      remember();
      // Use the original ANSWER event, never the returned correction event id.
      const originalLogId = action.kind === 'answer' ? saved.logId : action.body.logId;
      answerLogId = originalLogId;
      await loadAnswerDetails(action.batchId, action.item.itemId, originalLogId);
    } catch (e) {
      handleError(e);
      if (e instanceof ApiError && ['STALE_DAILY_ANSWER', 'CORRECTION_NOT_ALLOWED', 'PLAN_WORD_UNAVAILABLE'].includes(e.code)) {
        remember();
        correctableLogId.value = null;
        let synced = false;
        try { await readQueue(action.batchId); synced = true; }
        catch (reloadError) { error.value += `；${errorMessage(reloadError)}`; item.value = undefined; }
        if (e.code === 'PLAN_WORD_UNAVAILABLE' && synced) {
          notice.value = '该词已暂停、移出或被跳过，已停止重试旧答案，并同步最新任务。';
          error.value = '';
        }
      }
      // All unknown outcomes retain the original action; no local counters advance.
    } finally { saving.value = false; }
  }
  async function answer(result: Result) {
    if (saving.value || loading.value || historical.value || expired.value || pending.value || receipt.value || !item.value || progress.value?.status !== 'IN_PROGRESS' || progress.value.nextItemId !== item.value.itemId || !['PENDING', 'RELEARNING'].includes(item.value.learningStatus) || item.value.nextAttemptNo === null || item.value.nextAttemptNo > item.value.attemptLimit) return;
    if (!remember({ batchId: progress.value.batchId, item: item.value, kind: 'answer', body: { result, attemptNo: item.value.nextAttemptNo, requestId: crypto.randomUUID() } })) return;
    await send();
  }
  async function correct(result: 2 | 3 = 3) {
    if (saving.value || loading.value || historical.value || expired.value || pending.value || !item.value || !progress.value || !correctableLogId.value || receipt.value?.result !== 1) return;
    if (!remember({ batchId: progress.value.batchId, item: item.value, kind: 'correction', body: { result, logId: correctableLogId.value, requestId: crypto.randomUUID() } })) return;
    await send();
  }
  async function correctPrevious(batchId: number, previous: DailyStudyItem, logId: number, result: 2 | 3 = 3) {
    if (saving.value || loading.value || historical.value || expired.value || pending.value || progress.value?.batchId !== batchId) return;
    loading.value = true;
    error.value = '';
    let allowed = false;
    try {
      const current = await dailyApi.item(batchId, previous.itemId);
      if (current.learningStatus === 'SKIPPED' || current.correctableLogId !== logId) throw new ApiError('这次反馈已不能更正，请返回当前单词继续。', 'CORRECTION_NOT_ALLOWED');
      allowed = true;
    } catch (value) { handleError(value); }
    finally { loading.value = false; }
    if (allowed && remember({ batchId, item: previous, kind: 'correction', body: { result, logId, requestId: crypto.randomUUID() } })) await send();
  }
  async function next() {
    if (!receipt.value || !progress.value || saving.value || loading.value || pending.value || expired.value) return;
    loading.value = true;
    error.value = '';
    try { await readQueue(progress.value.batchId); }
    catch (e) { handleError(e); }
    finally { loading.value = false; }
  }
  return { progress, overview, item, receipt, answerDetails, detailsError, pending, loading, saving, error, expired, historical, noWords, notice, correctableLogId, open, answer, correct, correctPrevious, syncAnswerDetails, retry: send, next };
}
