import { computed, getCurrentScope, onScopeDispose, ref } from 'vue';
import { followTypingApi } from '../api/followTyping';
import { consolidationApi } from '../api/consolidation';
import { dailyApi } from '../api/daily';
import { dailyTrainingApi, requireTrainingTask } from '../api/dailyTraining';
import { ApiError, errorMessage } from '../api/http';
import { createRequestId } from '../utils/requestId';
import type { DailyCorrectionBody, TodayOverview } from '../types/daily';
import type { Result } from '../types/api';
import type { DailyStudyMode, TrainingTask, TrainingQuestion, TrainingAnswer, TrainingAnswerBody, TrainingScope } from '../types/dailyTraining';

type Pending = { batchId: number; itemId: number } & (
  { kind: 'training'; body: TrainingAnswerBody } | { kind: 'correction'; body: DailyCorrectionBody }
);
const staleCodes = new Set(['STALE_STUDY_MODE', 'STALE_TRAINING_ANSWER', 'STALE_TRAINING_ITEM', 'STALE_DAILY_ANSWER', 'PLAN_WORD_UNAVAILABLE', 'CORRECTION_NOT_ALLOWED', 'ANSWER_ALREADY_REVEALED', 'CONSOLIDATION_WORD_UNAVAILABLE']);

// Task scopes share presentation, retry and phase recovery; their endpoints and progress stay isolated.
export function useDailyTraining(userId: number, scope: TrainingScope = 'DAILY') {
  const follow = scope === 'FOLLOW_TYPING', practice = scope !== 'DAILY';
  const api = follow ? followTypingApi : practice ? consolidationApi : dailyTrainingApi;
  const readTask = follow ? followTypingApi.task : practice ? consolidationApi.task : dailyApi.task;
  const task = ref<TrainingTask>(), today = ref<TodayOverview>(), question = ref<TrainingQuestion>();
  const receipt = ref<TrainingAnswer>();
  const mode = ref<DailyStudyMode>('RECOGNITION');
  const busy = ref(false), error = ref(''), notice = ref(''), expired = ref(false), promptUnavailable = ref(false);
  const pending = ref<Pending>(), showingFeedback = ref(false), extraItemId = ref<number>();
  const noWords = ref(false);
  const drafts = ref<Record<string, string>>({});
  let alive = true, generation = 0;
  if (getCurrentScope()) onScopeDispose(() => { alive = false; generation++; });
  const historical = computed(() => !practice && !!task.value && task.value.learningDate !== today.value?.learningDate);
  const legacyFollow = computed(() => !practice && task.value?.studyMode === 'FOLLOW_TYPING');
  const blocked = computed(() => legacyFollow.value || busy.value || !!pending.value || expired.value || historical.value || !!error.value);
  const key = (id: number) => follow ? `wordtrail.follow.pending.${userId}.${id}` : practice ? `wordtrail.consolidation.pending.${userId}.${id}` : `wordtrail.training.pending.${userId}.${id}`;
  const draftKey = computed(() => question.value ? `${question.value.itemId}:${question.value.mode}` : '');
  const input = computed({ get: () => drafts.value[draftKey.value] ?? '', set: value => { if (draftKey.value) drafts.value[draftKey.value] = value; } });
  // Only the persisted phase proves a revealed recognition prompt. hintUsed is exposure history.
  const definition = computed(() => question.value?.mode === 'RECOGNITION' && question.value.phase === 'AWAITING_SELF_ASSESSMENT' &&
    question.value.answerRevealed ? question.value : undefined);
  // Recognition accepts self assessment from either phase; revealing the meaning is optional.
  const canRate = computed(() => !blocked.value && !showingFeedback.value && question.value?.mode === 'RECOGNITION');
  const canCorrect = computed(() => !practice && !blocked.value && showingFeedback.value && receipt.value?.mode === 'RECOGNITION' &&
    task.value?.studyMode === 'RECOGNITION' && receipt.value.progress.modeVersion === task.value.modeVersion &&
    receipt.value.action === 'ANSWER' && !!receipt.value.reviewLogId);
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
      if (follow && (saved.kind !== 'training' || saved.body.action !== 'ANSWER' || !('input' in saved.body) || typeof saved.body.input !== 'string' || 'result' in saved.body))
        throw new Error('Invalid follow typing request');
      if (saved.batchId === id && Number.isInteger(saved.itemId) && saved.body?.requestId &&
        (saved.kind === 'training' || saved.kind === 'correction')) {
        if (legacyFollow.value && saved.kind === 'training') {
          sessionStorage.setItem(`${key(id)}.legacy-follow`, raw); sessionStorage.removeItem(key(id));
          notice.value = '旧跟拼提交信息已保留，请在历史记录中核对。';
        } else pending.value = saved;
      }
      else throw new Error('Invalid pending request');
    } catch { error.value = '未确认请求的本地记录无法读取，请重新登录后核对服务端记录。'; }
  }
  function update(value: TrainingTask) {
    if (value.taskType !== (practice ? 'PRACTICE' : 'DAILY')) throw new ApiError('任务类型不匹配，请返回任务列表。', 'WRONG_TASK_TYPE');
    task.value = requireTrainingTask(value); mode.value = task.value.studyMode;
  }
  function readable(e: unknown) {
    if (follow && e instanceof ApiError && (e.status === 404 || e.status === 405)) return '独立跟拼接口暂不可用，请确认已部署第 36 节新版后端。';
    if (e instanceof ApiError && (e.status === 404 || e.status === 405 || e.code === 'TRAINING_ENDPOINT_REQUIRED'))
      return '统一每日训练接口不可用。请确认业务库已执行 011 迁移，且已启动新版后端。';
    return errorMessage(e);
  }
  async function fetchQuestion(token: number) {
    if (!task.value || historical.value || expired.value || legacyFollow.value) return;
    if (follow && task.value.status === 'ABANDONED') { question.value = undefined; return; }
    if (!follow && task.value.status !== 'IN_PROGRESS' && extraItemId.value === undefined) {
      question.value = undefined;
      if (practice) return;
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
    const q = await api.next(task.value.batchId, extraItemId.value);
    if (!alive || token !== generation) return;
    if (q === null) {
      question.value = undefined; extraItemId.value = undefined;
      const latest = await readTask(task.value.batchId);
      if (!alive || token !== generation) return;
      update(requireTrainingTask(latest));
      if (!practice) {
        const overview = await dailyApi.today();
        if (alive && token === generation) today.value = overview;
      }
      return;
    }
    update(q.progress);
    if (q.mode !== task.value!.studyMode || q.modeVersion !== task.value!.modeVersion || !q.presentationId || !Number.isInteger(q.attemptNo))
      throw new ApiError('展示版本不一致，请重新同步任务。', 'STALE_TRAINING_ANSWER');
    question.value = q; promptUnavailable.value = false;
  }
  async function resync(token: number) {
    question.value = undefined;
    if (!task.value) return;
    const latest = requireTrainingTask(await readTask(task.value.batchId));
    if (!alive || token !== generation) return;
    update(latest); await fetchQuestion(token);
  }
  async function handle(e: unknown, token: number, wasWrite = false) {
    if (!alive || token !== generation) return;
    const code = e instanceof ApiError ? e.code : '';
    const unknown = !(e instanceof ApiError) || e.code === 'NETWORK_ERROR' || (e.status ?? 0) >= 500;
    if (wasWrite && !unknown) persist();
    if (!practice && code === 'NO_DAILY_WORDS') {
      noWords.value = true; question.value = undefined; error.value = '';
      try {
        const overview = await dailyApi.today();
        if (!alive || token !== generation) return;
        today.value = overview;
        if (overview.task) update(requireTrainingTask(overview.task));
      } catch (syncError) { await handleSyncError(syncError); }
      return;
    }
    if (code === 'FOLLOW_TYPING_PRACTICE_REQUIRED') {
      question.value = undefined; error.value = ''; notice.value = '跟拼已移至独立练习，请选择其他每日方式继续。';
      try { await resync(token); } catch (syncError) { await handleSyncError(syncError); }
      return;
    }
    if (follow && code === 'BATCH_ABANDONED') { await resync(token); return; }
    if (code === 'DAILY_TASK_EXPIRED') { expired.value = true; question.value = undefined; error.value = '这份任务已跨日，请进入今日任务继续。'; return; }
    if (code === 'TRAINING_PROMPT_UNAVAILABLE') { promptUnavailable.value = true; question.value = undefined; error.value = ''; notice.value = '这个词缺少中文释义，请切换认读或听音默写，继续同一任务。'; return; }
    if (code === 'NO_TRAINING_ITEM') {
      question.value = undefined;
      try {
        if (!task.value) return;
        const [latest, overview] = await Promise.all([readTask(task.value.batchId), practice ? Promise.resolve(undefined) : dailyApi.today()]);
        if (!alive || token !== generation) return;
        update(requireTrainingTask(latest)); today.value = overview;
      } catch (syncError) { await handleSyncError(syncError); }
      notice.value = '本组训练已结束，可以查看记录或追加训练。'; return;
    }
    if (staleCodes.has(code)) {
      showingFeedback.value = false; receipt.value = undefined;
      if (code === 'PLAN_WORD_UNAVAILABLE' || code === 'CONSOLIDATION_WORD_UNAVAILABLE') extraItemId.value = undefined;
      notice.value = code === 'ANSWER_ALREADY_REVEALED' ? '答案已揭示，已恢复当前展示，请继续作答。' : code === 'PLAN_WORD_UNAVAILABLE' ? '计划已变化，正在同步可学单词。' : '题目或方式已更新，已丢弃旧提交，请核对当前题目后重新作答。';
      try { await resync(token); } catch (syncError) { await handleSyncError(syncError); }
      return;
    }
    error.value = unknown && wasWrite ? '保存结果尚未确认。请重试原请求，期间不能切换方式或提交新答案。' : readable(e);
  }
  async function handleSyncError(e: unknown) {
    const code = e instanceof ApiError ? e.code : '';
    if (code === 'TRAINING_PROMPT_UNAVAILABLE') { promptUnavailable.value = true; question.value = undefined; notice.value = '这个词缺少中文释义，请切换认读或听音默写。'; }
    else if (code === 'DAILY_TASK_EXPIRED') { expired.value = true; question.value = undefined; error.value = '这份任务已跨日，请返回今日任务。'; }
    else error.value = readable(e);
  }
  async function open(id?: number) {
    if (busy.value || !alive) return;
    const token = ++generation; busy.value = true; error.value = ''; notice.value = ''; expired.value = false; promptUnavailable.value = false;
    noWords.value = false;
    question.value = undefined; receipt.value = undefined; showingFeedback.value = false;
    try {
      const overview = practice ? undefined : await dailyApi.today();
      if (!alive || token !== generation) return;
      today.value = overview;
      if (practice && !id) throw new ApiError('请选择巩固批次。', 'MISSING_BATCH');
      const value = id ? await readTask(id) : overview?.task;
      if (!alive || token !== generation) return;
      pending.value = undefined;
      if (!value) {
        task.value = undefined;
        const settings = await dailyApi.settings();
        if (alive && token === generation) mode.value = settings.preferredStudyMode === 'FOLLOW_TYPING' ? 'RECOGNITION' : settings.preferredStudyMode ?? 'RECOGNITION';
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
    if (follow) return;
    if (!practice && nextMode === 'FOLLOW_TYPING') { notice.value = '跟拼已移至独立练习，请使用跟拼练习入口。'; return; }
    if (busy.value || pending.value || expired.value || historical.value || !alive) return;
    if (!task.value) { mode.value = nextMode; return; }
    if (mode.value === nextMode && question.value) return;
    const token = ++generation; busy.value = true; error.value = ''; notice.value = ''; promptUnavailable.value = false;
    question.value = undefined; receipt.value = undefined; showingFeedback.value = false;
    try {
      const updated = await api.mode(task.value.batchId, nextMode, task.value.modeVersion);
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
        const result = await api.answer(value.batchId, value.itemId, value.body);
        if (!alive || token !== generation) return;
        update(result.progress); persist(); receipt.value = result;
        if (result.action === 'ANSWER' && (!follow || result.verdict === 'CORRECT')) delete drafts.value[`${value.itemId}:${result.mode}`];
        showingFeedback.value = !follow && result.action === 'ANSWER';
      } else {
        const corrected = await dailyApi.correct(value.batchId, value.itemId, value.body);
        if (!alive || token !== generation) return;
        update(requireTrainingTask(corrected.progress)); persist();
        // Keep the original answer/log so further corrections still refer to the same answer.
        if (receipt.value?.itemId === value.itemId && showingFeedback.value) {
          receipt.value = { ...receipt.value, selfAssessment: corrected.result, progress: task.value! };
        } else {
          receipt.value = undefined; showingFeedback.value = false;
          notice.value = '更正已保存，不增加训练次数。';
        }
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
    if (follow && (action !== 'ANSWER' || result !== undefined)) return;
    const q = question.value;
    if (!q || blocked.value || showingFeedback.value || (action === 'ANSWER' && q.mode === 'RECOGNITION' && !canRate.value)) return;
    const common = { requestId: createRequestId(), presentationId: q.presentationId, modeVersion: q.modeVersion, attemptNo: q.attemptNo };
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
    if (!canCorrect.value || !receipt.value?.reviewLogId || result === receipt.value.selfAssessment) return;
    return perform({ result, logId: receipt.value.reviewLogId, requestId: createRequestId() }, 'correction', receipt.value.itemId);
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
    if (practice || busy.value || pending.value || !alive) return;
    const token = ++generation; const selected = mode.value;
    busy.value = true; error.value = ''; notice.value = ''; extraItemId.value = undefined;
    noWords.value = false;
    try {
      const started = requireTrainingTask(await dailyApi.start());
      if (!alive || token !== generation) return;
      update(started);
      const overview = await dailyApi.today();
      if (!alive || token !== generation) return;
      today.value = overview;
      if (started.status === 'IN_PROGRESS' && selected !== started.studyMode) {
        const changed = await api.mode(started.batchId, selected, started.modeVersion);
        if (!alive || token !== generation) return;
        update(changed);
      }
      showingFeedback.value = false; receipt.value = undefined;
      await fetchQuestion(token);
    } catch (e) { await handle(e, token); }
    finally { if (alive && token === generation) busy.value = false; }
  }
  return { task, today, question, mode, busy, error, notice, pending, expired, historical, promptUnavailable, blocked, noWords,
    input, definition, receipt, showingFeedback, canRate, canCorrect, extraItemId,
    legacyFollow, open, changeMode, recoverPresentation: () => open(task.value?.batchId), action, retry, correct, continueTraining, extra, start };
}
