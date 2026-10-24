import { computed, nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { sentencesApi } from '../api/sentences';
import { ApiError, errorMessage } from '../api/http';
import { useStudySurface } from './useStudySurface';
import type { SentenceProgress, SentenceCurrent, SentenceSubmission, SentenceSelfReview, SentenceAssessment, SentenceSchedule } from '../types/sentences';
type Pending = { itemId: number } & (
  { kind: 'submission'; body: SentenceSubmission } | { kind: 'self-review'; body: SentenceSelfReview }
);
function isPending(value: unknown): value is Pending {
  if (!value || typeof value !== 'object' || !('itemId' in value) || !Number.isInteger(value.itemId) || Number(value.itemId) < 1 || !('body' in value) || !value.body || typeof value.body !== 'object' || !('kind' in value)) return false;
  const body = value.body;
  if (!('requestId' in body) || typeof body.requestId !== 'string') return false;
  if (value.kind === 'self-review') return 'assessment' in body && ['UNDERSTOOD', 'PARTIAL', 'NOT_UNDERSTOOD'].includes(String(body.assessment));
  return value.kind === 'submission' && 'action' in body && (body.action === 'REVEAL' && !('translation' in body) || body.action === 'ANSWER' && 'translation' in body && typeof body.translation === 'string');
}
export function useSentenceSession(userId: number, sessionId: number) {
  const router = useRouter();
  const surface = useStudySurface();
  const key = `wordtrail.sentences.pending.${userId}.${sessionId}`;
  const draftKey = (itemId: number) => `wordtrail.sentences.draft.${userId}.${sessionId}.${itemId}`;
  const progress = shallowRef<SentenceProgress>();
  const current = shallowRef<SentenceCurrent | null>();
  const pending = shallowRef<Pending>();
  const translation = ref('');
  watch(translation, value => {
    if (current.value?.status !== 'PENDING' || busy.value) return;
    try { if (value) sessionStorage.setItem(draftKey(current.value.itemId), value); else sessionStorage.removeItem(draftKey(current.value.itemId)); }
    catch { notice.value = '当前译文暂未保存到本地，请保持此页打开。'; }
  }, { flush: 'sync' });
  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');
  const notice = ref('');
  const lastSchedule = shallowRef<{ sentenceId: number; value: SentenceSchedule | null | undefined }>();
  const validation = ref('');
  const blocked = ref(false);
  const busy = computed(() => loading.value || saving.value);
  const isCurrent = computed(() => progress.value?.status === 'IN_PROGRESS' && current.value?.itemId === progress.value.nextItemId);
  const canSubmit = computed(() => isCurrent.value && current.value?.status === 'PENDING' && !busy.value && !pending.value && !blocked.value);
  const canReview = computed(() => isCurrent.value && current.value?.status === 'AWAITING_REVIEW' && current.value.selfAssessment === null && !busy.value && !pending.value && !blocked.value);
  let active = true;
  onScopeDispose(() => { active = false; });
  try { const value: unknown = JSON.parse(sessionStorage.getItem(key) || 'null'); if (isPending(value)) pending.value = value; }
  catch { /* A storage write failure is surfaced before submitting anything. */ }
  function remember(value?: Pending) {
    if (value) {
      try { sessionStorage.setItem(key, JSON.stringify(value)); }
      catch { error.value = '无法保存待确认请求，请允许会话存储后重试。'; return false; }
    } else { try { sessionStorage.removeItem(key); } catch { /* A stale entry can safely replay the same operation. */ } }
    pending.value = value;
    return true;
  }
  async function fetchState() {
    current.value = undefined; translation.value = ''; validation.value = '';
    await nextTick();
    if (!active) return;
    let state = await sentencesApi.progress(sessionId);
    if (!active) return;
    const item = await sentencesApi.current(sessionId);
    if (!active) return;
    if (item === null && state.status !== 'COMPLETED' || item !== null && state.nextItemId !== item.itemId) state = await sentencesApi.progress(sessionId);
    if (!active) return;
    progress.value = state;
    if (item === null) {
      current.value = null;
      if (pending.value) return;
      if (state.status === 'COMPLETED') { if (!surface || surface.active.value) await router.replace(`/sentences/sessions/${sessionId}/result`); return; }
      throw new ApiError('当前题目暂未返回，请重新同步。', 'SENTENCE_STATE_INCONSISTENT');
    }
    if (state.status !== 'IN_PROGRESS' || state.nextItemId !== item.itemId || item.status === 'DONE') throw new ApiError('进度与当前题目已变化，请重新同步。', 'SENTENCE_STATE_INCONSISTENT');
    current.value = item;
    if (item.status === 'PENDING') { try { translation.value = sessionStorage.getItem(draftKey(item.itemId)) || ''; } catch { /* Keep this page editable if storage is unavailable. */ } }
  }
  async function load() {
    if (busy.value || blocked.value) return;
    loading.value = true; error.value = ''; notice.value = '';
    try {
      await fetchState();
      if (active && pending.value) error.value = '上次操作结果尚未确认，请原样重试后继续。';
    } catch (value) { if (active) { error.value = errorMessage(value); terminal(value); } }
    finally { if (active) loading.value = false; }
  }
  function terminal(value: unknown) {
    if (value instanceof ApiError && ['SENTENCE_SESSION_NOT_FOUND', 'REQUEST_ID_REUSED'].includes(value.code)) {
      blocked.value = true;
      if (value.code === 'REQUEST_ID_REUSED') error.value += '；原请求已保留，请核对练习记录，勿换键重放旧页面。';
    }
  }
  async function send() {
    const action = pending.value;
    if (!action || busy.value || blocked.value) return;
    saving.value = true; error.value = ''; notice.value = '';
    let saved = false;
    try {
      const feedback = action.kind === 'submission'
        ? await sentencesApi.submit(sessionId, action.itemId, action.body)
        : await sentencesApi.selfReview(sessionId, action.itemId, action.body);
      if (!active) return;
      saved = true; remember(); progress.value = feedback.progress;
      if (action.kind === 'submission') { try { sessionStorage.removeItem(draftKey(action.itemId)); } catch { /* A submitted item never restores a local draft. */ } }
      if (action.kind === 'self-review') lastSchedule.value = { sentenceId: feedback.sentenceId, value: feedback.reviewSchedule };
      // A replay can describe an old attempt. Only Current may choose the visible phase/item.
      await fetchState();
    } catch (value) {
      if (!active) return;
      error.value = errorMessage(value);
      if (saved) error.value = `操作已保存，恢复当前题目失败：${error.value}；请重新同步，不必重复提交。`;
      else if (value instanceof ApiError && ['STALE_SENTENCE_ITEM', 'SELF_REVIEW_NOT_ALLOWED', 'SENTENCE_ITEM_NOT_FOUND'].includes(value.code)) {
        remember();
        try { sessionStorage.removeItem(draftKey(action.itemId)); } catch { /* Do not resubmit a stale local draft. */ }
        try { await fetchState(); notice.value = '题目状态已变化，已恢复服务端当前题目。'; }
        catch (syncError) { error.value += `；${errorMessage(syncError)}`; }
      } else if (value instanceof ApiError && ['INVALID_PARAMETER', 'INVALID_SENTENCE_SUBMISSION'].includes(value.code)) remember();
      terminal(value);
    } finally { if (active) saving.value = false; }
  }
  async function submit(action: 'ANSWER' | 'REVEAL') {
    if (!canSubmit.value || !current.value) return;
    validation.value = '';
    if (action === 'ANSWER' && (!translation.value.trim() || translation.value.length > 2000)) { validation.value = '请输入 1～2000 个字符的译文。'; return; }
    const requestId = crypto.randomUUID();
    const body: SentenceSubmission = action === 'ANSWER' ? { action, translation: translation.value, requestId } : { action, requestId };
    if (remember({ kind: 'submission', itemId: current.value.itemId, body })) await send();
  }
  async function review(assessment: SentenceAssessment) {
    if (!canReview.value || !current.value) return;
    if (remember({ kind: 'self-review', itemId: current.value.itemId, body: { assessment, requestId: crypto.randomUUID() } })) await send();
  }
  return { progress, current, pending, translation, loading, saving, busy, error, notice, lastSchedule, validation, blocked, canSubmit, canReview, load, submit, review, retry: send };
}
