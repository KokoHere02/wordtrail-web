import { computed, nextTick, onScopeDispose, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { dictationApi } from '../api/dictation';
import { ApiError, errorMessage } from '../api/http';
import { useStudySurface } from './useStudySurface';
import type { DictationTask, DictationQuestion, DictationAnswer, DictationAnswerBody } from '../types/dictation';

interface Pending { itemId: number; body: DictationAnswerBody }
function isPending(value: unknown): value is Pending {
  if (!value || typeof value !== 'object' || !('itemId' in value) || !Number.isInteger(value.itemId) || Number(value.itemId) < 1 || !('body' in value) || !value.body || typeof value.body !== 'object') return false;
  const body = value.body;
  return 'attemptNo' in body && Number.isInteger(body.attemptNo) && Number(body.attemptNo) >= 1
    && 'presentationId' in body && typeof body.presentationId === 'string'
    && 'requestId' in body && typeof body.requestId === 'string'
    && 'action' in body && (body.action === 'REVEAL' && !('input' in body) || body.action === 'ANSWER' && 'input' in body && typeof body.input === 'string');
}
export function useDictationSession(userId: number, batchId: number) {
  const router = useRouter();
  const surface = useStudySurface();
  const key = `wordtrail.dictation.pending.${userId}.${batchId}`;
  const progress = shallowRef<DictationTask>();
  const question = shallowRef<DictationQuestion>();
  const answer = shallowRef<DictationAnswer>();
  const pending = shallowRef<Pending>();
  const input = ref('');
  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');
  const validation = ref('');
  const recoverable = ref(false);
  const blocked = ref(false);
  const busy = computed(() => loading.value || saving.value);
  const canAnswer = computed(() => !!question.value && !answer.value && !pending.value && !busy.value && !blocked.value && progress.value?.status === 'IN_PROGRESS');
  const canNext = computed(() => !!answer.value && !pending.value && !busy.value && !blocked.value && (progress.value?.status === 'IN_PROGRESS' || progress.value?.status === 'COMPLETED'));
  let active = true;
  onScopeDispose(() => { active = false; });
  try { const value: unknown = JSON.parse(sessionStorage.getItem(key) || 'null'); if (isPending(value)) pending.value = value; }
  catch { /* Disabled storage is reported before any answer is sent. */ }
  function remember(value?: Pending) {
    if (value) {
      try { sessionStorage.setItem(key, JSON.stringify(value)); }
      catch { error.value = '无法保存待确认请求，请允许会话存储后重试。'; return false; }
    } else { try { sessionStorage.removeItem(key); } catch { /* A stale stored request can only replay its original idempotent result. */ } }
    pending.value = value;
    return true;
  }
  function hideAnswer() { question.value = undefined; answer.value = undefined; input.value = ''; validation.value = ''; }
  async function readTask() {
    const task = await dictationApi.task(batchId);
    if (!active) return;
    progress.value = task;
    return task;
  }
  async function issue() {
    // This must reach the DOM before the POST, even if the same item reappears.
    hideAnswer();
    await nextTick();
    if (!active) return;
    question.value = await dictationApi.next(batchId);
    if (!active) question.value = undefined;
  }
  async function showResult(task: DictationTask) {
    if (active && task.status === 'COMPLETED' && (!surface || surface.active.value)) await router.replace(`/dictation/${batchId}/result`);
  }
  async function handleFailure(value: unknown) {
    error.value = errorMessage(value);
    if (!(value instanceof ApiError)) return;
    if (['STALE_DICTATION_ANSWER', 'DICTATION_ITEM_NOT_FOUND'].includes(value.code)) {
      remember(); hideAnswer(); recoverable.value = true;
      error.value = `${error.value}；题目已过期，请重新获取当前题目。`;
    } else if (value.code === 'DICTATION_NOT_IN_PROGRESS') {
      remember(); hideAnswer();
      const task = await readTask();
      if (task?.status === 'COMPLETED') await showResult(task);
      else if (task?.status === 'ABANDONED') blocked.value = true;
      else recoverable.value = true;
    } else if (['BATCH_NOT_FOUND', 'NOT_DICTATION_TASK', 'DICTATION_ENDPOINT_REQUIRED', 'REQUEST_ID_REUSED'].includes(value.code)) {
      blocked.value = true;
      if (value.code === 'REQUEST_ID_REUSED') error.value += '；原请求已保留，请返回默写记录核对，勿更换请求键重放。';
    } else if (['INVALID_PARAMETER', 'INVALID_DICTATION_ANSWER'].includes(value.code)) {
      remember();
    }
  }
  async function load() {
    if (busy.value || blocked.value) return;
    loading.value = true; error.value = ''; recoverable.value = false; hideAnswer();
    try {
      const task = await readTask();
      if (!active || !task) return;
      if (pending.value) { error.value = '上次提交结果尚未确认，请原样重试后继续。'; return; }
      if (task.status === 'COMPLETED') { await showResult(task); return; }
      if (task.status === 'ABANDONED') { blocked.value = true; error.value = '本轮已放弃，请返回默写记录。'; return; }
      if (task.nextItemId === null) { recoverable.value = true; error.value = '服务端暂未提供待答题目，请重新同步。'; return; }
      await issue();
    } catch (value) {
      if (active) { recoverable.value = true; try { await handleFailure(value); } catch (syncError) { error.value += `；${errorMessage(syncError)}`; } }
    } finally { if (active) loading.value = false; }
  }
  async function send() {
    const action = pending.value;
    if (!action || busy.value || blocked.value) return;
    saving.value = true; error.value = '';
    try {
      const saved = await dictationApi.answer(batchId, action.itemId, action.body);
      if (!active) return;
      remember();
      progress.value = saved.progress; answer.value = saved;
      recoverable.value = false;
    } catch (value) {
      if (active) { try { await handleFailure(value); } catch (syncError) { error.value += `；${errorMessage(syncError)}`; } }
    } finally { if (active) saving.value = false; }
  }
  async function submit(action: 'ANSWER' | 'REVEAL') {
    if (!canAnswer.value || !question.value) return;
    validation.value = '';
    if (action === 'ANSWER' && (!input.value.trim() || input.value.length > 255)) { validation.value = '请输入 1～255 个字符的英文答案。'; return; }
    const common = { attemptNo: question.value.nextAttemptNo, presentationId: question.value.presentationId, requestId: crypto.randomUUID() };
    const body: DictationAnswerBody = action === 'ANSWER' ? { ...common, action, input: input.value } : { ...common, action };
    if (remember({ itemId: question.value.itemId, body })) await send();
  }
  async function next() {
    if (!canNext.value || !progress.value) return;
    if (progress.value.status === 'COMPLETED') { await showResult(progress.value); return; }
    // GET first: a replayed receipt may describe an old event with newer progress.
    await load();
  }
  return { progress, question, answer, pending, input, loading, saving, busy, error, validation, recoverable, blocked, canAnswer, canNext, load, submit, retry: send, next };
}
