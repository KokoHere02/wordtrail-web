import { computed, getCurrentScope, onScopeDispose, ref } from 'vue';
import { dailyApi } from '../api/daily';
import { dailyTrainingApi, requireTrainingTask } from '../api/dailyTraining';
import { ApiError, errorMessage } from '../api/http';
import type { DailyCorrectionBody, TodayOverview } from '../types/daily';
import type { Result } from '../types/api';
import type { DailyStudyMode, TrainingTask, TrainingQuestion, TrainingAnswer, TrainingAnswerBody } from '../types/dailyTraining';

type Pending = { batchId: number; itemId: number } & (
  { kind: 'training'; body: TrainingAnswerBody } | { kind: 'correction'; body: DailyCorrectionBody }
);
const staleCodes = new Set(['STALE_STUDY_MODE', 'STALE_TRAINING_ANSWER', 'STALE_TRAINING_ITEM', 'STALE_DAILY_ANSWER', 'PLAN_WORD_UNAVAILABLE', 'CORRECTION_NOT_ALLOWED', 'ANSWER_ALREADY_REVEALED']);

// A single owner and write lock for all three DAILY modes. Independent practice never uses this session.
export function useDailyTraining(userId: number) {
  const task = ref<TrainingTask>(), today = ref<TodayOverview>(), question = ref<TrainingQuestion>();
  const receipt = ref<TrainingAnswer>();
  const mode = ref<DailyStudyMode>('RECOGNITION');
  const busy = ref(false), error = ref(''), notice = ref(''), expired = ref(false), promptUnavailable = ref(false);
  const pending = ref<Pending>(), showingFeedback = ref(false), extraItemId = ref<number>();
  const drafts = ref<Record<string, string>>({});
  let alive = true, generation = 0;
  if (getCurrentScope()) onScopeDispose(() => { alive = false; generation++; });
  const historical = computed(() => !!task.value && task.value.learningDate !== today.value?.learningDate);
  const blocked = computed(() => busy.value || !!pending.value || expired.value || historical.value || !!error.value);
  const key = (id: number) => `wordtrail.training.pending.${userId}.${id}`;
  const draftKey = computed(() => question.value ? `${question.value.itemId}:${question.value.mode}` : '');
  const input = computed({ get: () => drafts.value[draftKey.value] ?? '', set: value => { if (draftKey.value) drafts.value[draftKey.value] = value; } });
  // Only the persisted phase proves a revealed recognition prompt. hintUsed is exposure history.
  const definition = computed(() => question.value?.mode === 'RECOGNITION' && question.value.phase === 'AWAITING_SELF_ASSESSMENT' &&
    question.value.answerRevealed ? question.value : undefined);
  // Recognition accepts self assessment from either phase; revealing the meaning is optional.
  const canRate = computed(() => !blocked.value && !showingFeedback.value && question.value?.mode === 'RECOGNITION');
  const canCorrect = computed(() => !blocked.value && showingFeedback.value && receipt.value?.mode === 'RECOGNITION' &&
    task.value?.studyMode === 'RECOGNITION' && receipt.value.progress.modeVersion === task.value.modeVersion &&
    receipt.value.action === 'ANSWER' && !!receipt.value.reviewLogId && receipt.value.selfAssessment === 1);
  function persist(value?: Pending) {
    const id = value?.batchId ?? pending.value?.batchId;
    // Persist before dispatch: an unknown response must survive refresh with the exact body.
    if (id) { if (value) sessionStorage.setItem(key(id), JSON.stringify(value)); else sessionStorage.removeItem(key(id)); }
    pending.value = value;
  }
  function restorePending(id: number) {
    const raw = sessionStorage.getItem(key(id));
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Pending;
      if (saved.batchId === id && Number.isInteger(saved.itemId) && saved.body?.requestId &&
        (saved.kind === 'training' || saved.kind === 'correction')) pending.value = saved;
      else throw new Error('Invalid pending request');
    } catch { error.value = '未确认请求的本地记录无法读取，请重新登录后核对服务端记录。'; }
  }
  function update(value: TrainingTask) { task.value = requireTrainingTask(value); mode.value = task.value.studyMode; }
  function readable(e: unknown) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405 || e.code === 'TRAINING_ENDPOINT_REQUIRED'))
      return '统一每日训练接口不可用。请确认业务库已执行 011 迁移，且已启动新版后端。';
    return errorMessage(e);
  }
  async function fetchQuestion(token: number) {
    if (!task.value || historical.value || expired.value) return;
    if (task.value.status !== 'IN_PROGRESS' && extraItemId.value === undefined) {
      question.value = undefined;
      // canAddMore changes only after the queue finishes. Refresh its authoritative overview;
      // this must remain a GET, never an implicit same-day append.
      const overview = await dailyApi.today();
      if (!alive || token !== generation) return;
      today.value = overview;
      if (overview.task?.batchId === task.value.batchId) {
        const latest = requireTrainingTask(overview.task);
        update(latest);
        if (latest.status === 'IN_PROGRESS') await fetchQuestion(token);
      }
      return;
    }
    const q = await dailyTrainingApi.next(task.value.batchId, extraItemId.value);
    if (!alive || token !== generation) return;
    update(q.progress);
    if (q.mode !== task.value!.studyMode || q.modeVersion !== task.value!.modeVersion || !q.presentationId || !Number.isInteger(q.attemptNo))
      throw new ApiError('展示版本不一致，请重新同步任务。', 'STALE_TRAINING_ANSWER');
    question.value = q; promptUnavailable.value = false;
  }
  async function resync(token: number) {
    question.value = undefined;
    if (!task.value) return;
    const latest = requireTrainingTask(await dailyApi.task(task.value.batchId));
    if (!alive || token !== generation) return;
    update(latest); await fetchQuestion(token);
  }
  async function handle(e: unknown, token: number, wasWrite = false) {
    if (!alive || token !== generation) return;
    const code = e instanceof ApiError ? e.code : '';
    const unknown = !(e instanceof ApiError) || e.code === 'NETWORK_ERROR' || (e.status ?? 0) >= 500;
    if (wasWrite && !unknown) persist();
    if (code === 'DAILY_TASK_EXPIRED') { expired.value = true; question.value = undefined; error.value = '这份任务已跨日，请进入今日任务继续。'; return; }
    if (code === 'TRAINING_PROMPT_UNAVAILABLE') { promptUnavailable.value = true; question.value = undefined; error.value = ''; notice.value = '这个词缺少中文释义，请切换认读或跟拼，继续同一任务。'; return; }
    if (code === 'NO_TRAINING_ITEM') {
      question.value = undefined;
      try {
        if (!task.value) return;
        const [latest, overview] = await Promise.all([dailyApi.task(task.value.batchId), dailyApi.today()]);
        if (!alive || token !== generation) return;
        update(requireTrainingTask(latest)); today.value = overview;
      } catch (syncError) { await handleSyncError(syncError); }
      notice.value = '本组训练已结束，可以查看记录或追加训练。'; return;
    }
    if (staleCodes.has(code)) {
      showingFeedback.value = false; receipt.value = undefined;
      if (code === 'PLAN_WORD_UNAVAILABLE') extraItemId.value = undefined;
      notice.value = code === 'ANSWER_ALREADY_REVEALED' ? '答案已揭示，已恢复当前展示，请继续作答。' : code === 'PLAN_WORD_UNAVAILABLE' ? '计划已变化，正在同步可学单词。' : '题目或方式已更新，已丢弃旧提交，请核对当前题目后重新作答。';
      try { await resync(token); } catch (syncError) { await handleSyncError(syncError); }
      return;
    }
    error.value = unknown && wasWrite ? '保存结果尚未确认。请重试原请求，期间不能切换方式或提交新答案。' : readable(e);
  }
  async function handleSyncError(e: unknown) {
    const code = e instanceof ApiError ? e.code : '';
    if (code === 'TRAINING_PROMPT_UNAVAILABLE') { promptUnavailable.value = true; question.value = undefined; notice.value = '这个词缺少中文释义，请切换认读或跟拼。'; }
    else if (code === 'DAILY_TASK_EXPIRED') { expired.value = true; question.value = undefined; error.value = '这份任务已跨日，请返回今日任务。'; }
    else error.value = readable(e);
  }
  async function open(id?: number) {
    if (busy.value || !alive) return;
    const token = ++generation; busy.value = true; error.value = ''; notice.value = ''; expired.value = false; promptUnavailable.value = false;
    question.value = undefined; receipt.value = undefined; showingFeedback.value = false;
    try {
      const overview = await dailyApi.today();
      if (!alive || token !== generation) return;
      today.value = overview;
      const value = id ? await dailyApi.task(id) : overview.task;
      if (!alive || token !== generation) return;
      pending.value = undefined;
      if (!value) {
        task.value = undefined;
        const settings = await dailyApi.settings();
        if (alive && token === generation) mode.value = settings.preferredStudyMode ?? 'RECOGNITION';
        return;
      }
      if (task.value?.batchId !== value.batchId || task.value.totalCount !== value.totalCount) extraItemId.value = undefined;
      update(requireTrainingTask(value));
      restorePending(value.batchId);
      if (pending.value) { notice.value = '有一次尚未确认的操作，请重试原请求。'; return; }
      if (!error.value) await fetchQuestion(token);
    } catch (e) { await handle(e, token); }
    finally { if (alive && token === generation) busy.value = false; }
  }
  async function changeMode(nextMode: DailyStudyMode) {
    if (busy.value || pending.value || expired.value || historical.value || !alive) return;
    if (!task.value) { mode.value = nextMode; return; }
    if (mode.value === nextMode && question.value) return;
    const token = ++generation; busy.value = true; error.value = ''; notice.value = ''; promptUnavailable.value = false;
    question.value = undefined; receipt.value = undefined; showingFeedback.value = false;
    try {
      const updated = await dailyTrainingApi.mode(task.value.batchId, nextMode, task.value.modeVersion);
      if (!alive || token !== generation) return;
      update(updated); await fetchQuestion(token);
    } catch (e) {
      // A mode write can succeed even if its response is lost. Resolve from GET, never guess its version.
      await handle(e, token);
      if (alive && token === generation && error.value && !expired.value) {
        try { await resync(token); error.value = ''; notice.value = '已按服务端恢复当前学习方式。'; }
        catch (syncError) { await handleSyncError(syncError); }
      }
    } finally { if (alive && token === generation) busy.value = false; }
  }
  async function dispatch(value: Pending, token: number) {
    try {
      if (value.kind === 'training') {
        const result = await dailyTrainingApi.answer(value.batchId, value.itemId, value.body);
        if (!alive || token !== generation) return;
        update(result.progress); persist(); receipt.value = result;
        if (result.action === 'ANSWER') delete drafts.value[`${value.itemId}:${result.mode}`];
        showingFeedback.value = result.action === 'ANSWER';
      } else {
        const corrected = await dailyApi.correct(value.batchId, value.itemId, value.body);
        if (!alive || token !== generation) return;
        update(requireTrainingTask(corrected.progress)); persist();
        // A correction may reopen a DONE item. Show the freshly fetched phase/status instead of the old receipt.
        receipt.value = undefined; showingFeedback.value = false;
        notice.value = '更正已保存，不增加训练次数。';
      }
      question.value = undefined;
      try { await fetchQuestion(token); } catch (e) { await handle(e, token); }
    } catch (e) { await handle(e, token, true); }
  }
  async function perform(body: TrainingAnswerBody | DailyCorrectionBody, kind: Pending['kind'], itemId: number) {
    if (busy.value || pending.value || expired.value || historical.value || !task.value) return;
    const token = ++generation; busy.value = true; error.value = ''; notice.value = '';
    try {
      const value = { batchId: task.value.batchId, itemId, kind, body } as Pending;
      persist(value); await dispatch(value, token);
    } catch (e) { error.value = readable(e); }
    finally { if (alive && token === generation) busy.value = false; }
  }
  function action(action: 'REVEAL' | 'ANSWER', result?: Result) {
    const q = question.value;
    if (!q || blocked.value || showingFeedback.value || (action === 'ANSWER' && q.mode === 'RECOGNITION' && !canRate.value)) return;
    const common = { requestId: crypto.randomUUID(), presentationId: q.presentationId, modeVersion: q.modeVersion, attemptNo: q.attemptNo };
    if (action === 'REVEAL') { if (!q.answerRevealed) return perform({ ...common, action }, 'training', q.itemId); return; }
    if (q.mode === 'RECOGNITION') { if (result) return perform({ ...common, action, result }, 'training', q.itemId); }
    else if (input.value.trim() && input.value.length <= 255) return perform({ ...common, action, input: input.value }, 'training', q.itemId);
  }
  async function retry() {
    if (busy.value || !pending.value || expired.value || historical.value) return;
    const token = ++generation; busy.value = true; error.value = ''; notice.value = '';
    try { await dispatch(pending.value, token); }
    finally { if (alive && token === generation) busy.value = false; }
  }
  function correct(result: Result) {
    if (!canCorrect.value || !receipt.value?.reviewLogId) return;
    return perform({ result, logId: receipt.value.reviewLogId, requestId: crypto.randomUUID() }, 'correction', receipt.value.itemId);
  }
  function continueTraining() {
    if (blocked.value) return;
    showingFeedback.value = false; receipt.value = undefined;
  }
  async function extra(itemId?: number) {
    if (busy.value || pending.value || expired.value || historical.value) return;
    extraItemId.value = itemId; showingFeedback.value = false; receipt.value = undefined;
    await open(task.value?.batchId);
  }
  async function start() {
    if (busy.value || pending.value || !alive) return;
    const token = ++generation; const selected = mode.value;
    busy.value = true; error.value = ''; notice.value = ''; extraItemId.value = undefined;
    try {
      const started = requireTrainingTask(await dailyApi.start());
      if (!alive || token !== generation) return;
      update(started);
      const overview = await dailyApi.today();
      if (!alive || token !== generation) return;
      today.value = overview;
      if (selected !== started.studyMode) {
        const changed = await dailyTrainingApi.mode(started.batchId, selected, started.modeVersion);
        if (!alive || token !== generation) return;
        update(changed);
      }
      showingFeedback.value = false; receipt.value = undefined;
      await fetchQuestion(token);
    } catch (e) { await handle(e, token); }
    finally { if (alive && token === generation) busy.value = false; }
  }
  return { task, today, question, mode, busy, error, notice, pending, expired, historical, promptUnavailable, blocked,
    input, definition, receipt, showingFeedback, canRate, canCorrect, extraItemId,
    open, changeMode, action, retry, correct, continueTraining, extra, start };
}
