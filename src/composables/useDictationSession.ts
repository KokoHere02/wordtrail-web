import { computed, nextTick, onScopeDispose, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { dictationApi } from '../api/dictation';
import { createRequestId } from '../utils/requestId';
import { ApiError, errorMessage } from '../api/http';
import { useStudySurface } from './useStudySurface';
import type { DictationTask, DictationQuestion, DictationAnswer, DictationAnswerBody } from '../types/dictation';

interface Pending { itemId: number; body: DictationAnswerBody }
function isPending(value: unknown): value is Pending {
  if (!value || typeof value !== 'object' || !('itemId' in value) || !Number.isInteger(value.itemId) || Number(value.itemId) < 1 || !('body' in value) || !value.body || typeof value.body !== 'object') return false;
  const body = value.body;
  return 'attemptNo' in body && body.attemptNo === 1
    && 'presentationId' in body && typeof body.presentationId === 'string'
    && 'requestId' in body && typeof body.requestId === 'string'
    && 'action' in body && (body.action === 'REVEAL' && !('input' in body) || body.action === 'ANSWER' && 'input' in body && typeof body.input === 'string');
}
export function useDictationSession(userId: number, batchId: number) {
  const router = useRouter(), surface = useStudySurface();
  const key = `wordtrail.dictation.pending.${userId}.${batchId}`;
  const progress = shallowRef<DictationTask>(), question = shallowRef<DictationQuestion>();
  // Only an explicit REVEAL is held on screen. Normal answers are never judged locally.
  const answer = shallowRef<DictationAnswer>(), pending = shallowRef<Pending>();
  const input = ref(''), notice = ref(''), error = ref(''), validation = ref('');
  const loading = ref(false), saving = ref(false), recoverable = ref(false), blocked = ref(false), legacyReadOnly = ref(false);
  const readOnly = computed(() => legacyReadOnly.value || progress.value?.singleAttempt === false);
  const busy = computed(() => loading.value || saving.value);
  const canAnswer = computed(() => !!question.value && !answer.value && !pending.value && !busy.value && !blocked.value && !readOnly.value && surface?.active.value !== false && progress.value?.canContinue === true && progress.value.status === 'IN_PROGRESS');
  const canNext = computed(() => !!answer.value && !pending.value && !busy.value && !blocked.value && !readOnly.value && (progress.value?.canContinue === true || progress.value?.status === 'COMPLETED'));
  let active = true, invalidPending = false;
  onScopeDispose(() => { active = false; });
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (isPending(value)) pending.value = value;
    else invalidPending = value !== null;
  } catch { invalidPending = true; }
  function remember(value?: Pending) {
    if (value) {
      try { sessionStorage.setItem(key, JSON.stringify(value)); }
      catch { error.value = '无法保存待确认请求，请允许会话存储后重试。'; return false; }
    } else { try { sessionStorage.removeItem(key); } catch { /* Replaying the same receipt is idempotent. */ } }
    pending.value = value;
    return true;
  }
  function hideAnswer() { question.value = undefined; answer.value = undefined; input.value = ''; validation.value = ''; }
  async function readTask() {
    const task = await dictationApi.task(batchId);
    if (!active) return;
    progress.value = task;
    if (typeof task.singleAttempt !== 'boolean' || typeof task.canContinue !== 'boolean')
      throw new ApiError('独立默写测验接口尚未更新，请重启第 20 节新版后端。', 'DICTATION_ENDPOINT_REQUIRED');
    return task;
  }
  async function issue() {
    hideAnswer(); await nextTick();
    if (!active) return;
    const issued = await dictationApi.next(batchId);
    if (!active) return;
    if (issued.nextAttemptNo !== 1 || !issued.presentationId)
      throw new ApiError('题目不是单次作答测验，请确认已启动新版后端。', 'DICTATION_ENDPOINT_REQUIRED');
    question.value = issued;
  }
  async function showResult(task: DictationTask) {
    if (active && task.status === 'COMPLETED' && (!surface || surface.active.value)) await router.replace(`/dictation/${batchId}/result`);
  }
  async function restore() {
    const task = await readTask();
    if (!active || !task) return;
    if (!task.singleAttempt || legacyReadOnly.value) { hideAnswer(); blocked.value = true; return; }
    if (invalidPending) { blocked.value = true; error.value = '未确认请求的格式无法读取，请在默写记录中核对；不能更换请求键重答。'; return; }
    // Even after the final answer, an unknown write must retry its original bytes.
    if (pending.value) { error.value = '上次提交结果尚未确认，请原样重试后继续。'; return; }
    if (task.status === 'COMPLETED') { await showResult(task); return; }
    if (!task.canContinue) { hideAnswer(); blocked.value = true; notice.value = '本轮不可继续，可查看记录或新建测验。'; return; }
    if (task.nextItemId === null) { recoverable.value = true; error.value = '服务端暂未提供待答题目，请重新同步。'; return; }
    await issue();
  }
  async function handleFailure(value: unknown) {
    error.value = errorMessage(value);
    if (!(value instanceof ApiError)) return;
    if (value.code === 'DICTATION_LEGACY_READ_ONLY') {
      legacyReadOnly.value = true; blocked.value = true; hideAnswer(); error.value = ''; return;
    }
    if (value.code === 'DICTATION_ALREADY_ANSWERED') {
      remember(); hideAnswer(); error.value = ''; notice.value = '本题已提交，已恢复测验进度。';
      await restore(); return;
    }
    if (['STALE_DICTATION_ANSWER', 'DICTATION_ITEM_NOT_FOUND'].includes(value.code)) {
      remember(); hideAnswer(); recoverable.value = true;
      error.value += '；题目已过期，请重新获取当前题目。';
    } else if (value.code === 'DICTATION_NOT_IN_PROGRESS') {
      remember(); hideAnswer(); await restore();
    } else if (['BATCH_NOT_FOUND', 'NOT_DICTATION_TASK', 'DICTATION_ENDPOINT_REQUIRED', 'REQUEST_ID_REUSED'].includes(value.code)) {
      blocked.value = true; hideAnswer();
      if (value.code === 'REQUEST_ID_REUSED') error.value += '；原请求已保留，请返回默写记录核对，勿更换请求键重放。';
    } else if (['INVALID_PARAMETER', 'INVALID_DICTATION_ANSWER'].includes(value.code)) {
      remember();
    }
  }
  async function fail(value: unknown) {
    if (!active) return;
    recoverable.value = true;
    try { await handleFailure(value); }
    catch (syncError) { error.value = errorMessage(syncError); }
  }
  async function load() {
    if (busy.value || blocked.value) return;
    loading.value = true; error.value = ''; recoverable.value = false;
    const previous = question.value, draft = input.value;
    hideAnswer();
    try {
      await restore();
      if (active && previous?.presentationId === question.value?.presentationId) input.value = draft;
    } catch (value) { await fail(value); }
    finally { if (active) loading.value = false; }
  }
  async function send() {
    const action = pending.value;
    if (!action || busy.value || blocked.value || readOnly.value) return;
    saving.value = true; error.value = ''; notice.value = '';
    try {
      const saved = await dictationApi.answer(batchId, action.itemId, action.body);
      if (!active) return;
      remember(); hideAnswer(); progress.value = saved.progress; recoverable.value = false;
      if (saved.action === 'REVEAL') answer.value = saved;
      else {
        notice.value = '已提交';
        // A failed next/read never resubmits the confirmed answer.
        await restore();
      }
    } catch (value) { await fail(value); }
    finally { if (active) saving.value = false; }
  }
  async function submit(action: 'ANSWER' | 'REVEAL') {
    if (!canAnswer.value || !question.value) return;
    validation.value = '';
    if (action === 'ANSWER' && (!input.value.trim() || input.value.length > 255)) { validation.value = '请输入 1～255 个字符的英文答案。'; return; }
    const common = { attemptNo: 1 as const, presentationId: question.value.presentationId, requestId: createRequestId() };
    const body: DictationAnswerBody = action === 'ANSWER' ? { ...common, action, input: input.value } : { ...common, action };
    if (remember({ itemId: question.value.itemId, body })) await send();
  }
  async function next() {
    if (!canNext.value || !progress.value) return;
    if (progress.value.status === 'COMPLETED') { await showResult(progress.value); return; }
    await load();
  }
  return { progress, question, answer, pending, input, notice, loading, saving, busy, error, validation, recoverable, blocked, readOnly, canAnswer, canNext, load, submit, retry: send, next };
}
