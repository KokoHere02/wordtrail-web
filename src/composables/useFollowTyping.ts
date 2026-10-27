import { computed, onScopeDispose, ref, watch } from 'vue';
import { followTypingApi, type FollowTypingCreate } from '../api/followTyping';
import { ApiError, errorMessage } from '../api/http';
import { useDailyTraining } from './useDailyTraining';

export function useFollowTyping(userId: number, resolveBatch: (id: number) => Promise<unknown>) {
  const session = useDailyTraining(userId, 'FOLLOW_TYPING');
  const count = ref(20), busy = ref(false), error = ref(''), pendingCreate = ref<FollowTypingCreate>();
  const abandonPending = ref<number>(), knownBatch = ref<number>();
  const createKey = `wordtrail.follow.create.${userId}`, countKey = `wordtrail.follow.count.${userId}`, abandonKey = `wordtrail.follow.abandon.${userId}`;
  let alive = true;
  onScopeDispose(() => { alive = false; });
  try {
    const savedCount = Number(localStorage.getItem(countKey));
    if (Number.isInteger(savedCount) && savedCount >= 10 && savedCount <= 20) count.value = savedCount;
    const raw = sessionStorage.getItem(createKey);
    if (raw) {
      const body = JSON.parse(raw) as FollowTypingCreate;
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(body.requestId) || !Number.isInteger(body.count) || body.count < 10 || body.count > 20) throw new Error();
      pendingCreate.value = body; count.value = body.count;
    }
    const savedAbandon = Number(sessionStorage.getItem(abandonKey));
    if (savedAbandon > 0) abandonPending.value = savedAbandon;
  } catch { error.value = '本地重试信息无法读取，请先核对跟拼历史轮次。'; }
  watch(count, value => { try { localStorage.setItem(countKey, String(value)); } catch { /* The server still owns task snapshots. */ } });
  const blocked = computed(() => busy.value || session.blocked.value || !!pendingCreate.value || !!abandonPending.value && abandonPending.value === session.task.value?.batchId);
  function clearCreate() { sessionStorage.removeItem(createKey); pendingCreate.value = undefined; }
  async function resolve(id: number) {
    knownBatch.value = id;
    await resolveBatch(id);
  }
  function creationFailure(e: unknown) {
    const uncertain = !(e instanceof ApiError) || e.code === 'NETWORK_ERROR' || (e.status ?? 0) >= 500 || e.code === 'FOLLOW_TYPING_DEPLOYMENT_REQUIRED';
    if (!uncertain) clearCreate();
    error.value = uncertain && pendingCreate.value ? '创建结果尚未确认，请重试原请求。词数与请求标识已保留。' :
      e instanceof ApiError && e.code === 'NO_FOLLOW_TYPING_WORDS' ? '暂无可用跟拼词，请检查启用中的学习计划，或等待重复限制冷却后再练。' : errorMessage(e);
  }
  async function create() {
    if (!pendingCreate.value) {
      if (!Number.isInteger(count.value) || count.value < 10 || count.value > 20) throw new ApiError('本轮词数为 10～20 的整数。', 'INVALID_COUNT');
      const body = { requestId: crypto.randomUUID(), count: count.value };
      sessionStorage.setItem(createKey, JSON.stringify(body)); pendingCreate.value = body;
    }
    try {
      const task = await followTypingApi.create(pendingCreate.value);
      if (!alive) return;
      knownBatch.value = task.batchId; clearCreate(); await resolve(task.batchId);
    } catch (e) {
      if (!alive) return;
      if (e instanceof ApiError && e.code === 'FOLLOW_TYPING_IN_PROGRESS') {
        const batches = await followTypingApi.batches({ page: 1, size: 20, status: 'IN_PROGRESS' });
        if (!alive) return;
        const active = batches.records.find(task => task.status === 'IN_PROGRESS');
        if (active) { clearCreate(); await resolve(active.batchId); return; }
        clearCreate(); error.value = '轮次状态已变化，请重新同步跟拼练习。'; return;
      }
      creationFailure(e);
    }
  }
  async function open(id?: number) {
    if (busy.value || session.busy.value || !alive) return;
    busy.value = true; error.value = '';
    try {
      if (id) {
        await session.open(id);
        if (!alive) return;
        knownBatch.value = id;
        if (abandonPending.value === id && session.task.value?.status !== 'IN_PROGRESS' && session.task.value) {
          abandonPending.value = undefined; sessionStorage.removeItem(abandonKey);
        }
        return;
      }
      const batches = await followTypingApi.batches({ page: 1, size: 20, status: 'IN_PROGRESS' });
      if (!alive) return;
      const active = batches.records.find(task => task.status === 'IN_PROGRESS');
      if (active) { clearCreate(); await resolve(active.batchId); return; }
      if (pendingCreate.value) { error.value = '有一次创建结果尚未确认，请重试原请求。'; return; }
      await create();
    } catch (e) { if (alive) error.value = errorMessage(e); }
    finally { if (alive) busy.value = false; }
  }
  async function retryCreate() {
    if (busy.value || !pendingCreate.value || !alive) return;
    busy.value = true; error.value = '';
    try { await create(); }
    catch (e) { if (alive) error.value = errorMessage(e); }
    finally { if (alive) busy.value = false; }
  }
  async function abandon() {
    const id = session.task.value?.batchId;
    if (!id || busy.value || session.busy.value || session.pending.value || !alive) return;
    busy.value = true; error.value = '';
    try {
      sessionStorage.setItem(abandonKey, String(id)); abandonPending.value = id;
      await followTypingApi.abandon(id);
      if (!alive) return;
      abandonPending.value = undefined; sessionStorage.removeItem(abandonKey);
      await session.open(id);
    } catch (e) { if (alive) error.value = '放弃结果尚未确认，请重试放弃或重新同步服务器进度。'; }
    finally { if (alive) busy.value = false; }
  }
  return { session, count, busy, blocked, error, pendingCreate, abandonPending, knownBatch, open, retryCreate, abandon };
}
