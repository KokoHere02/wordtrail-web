<script setup lang="ts">
import { onMounted, onScopeDispose, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BookOpen, PencilLine } from 'lucide-vue-next';
import { consolidationApi, isIssueFilter, type CreateConsolidation } from '../../api/consolidation';
import { ApiError, errorMessage } from '../../api/http';
import { useAuthStore } from '../../stores/auth';
import { createRequestId } from '../../utils/requestId';
import AppButton from '../../components/ui/AppButton.vue';

const router = useRouter(), userId = useAuthStore().user!.id;
const key = `wordtrail.consolidation.automatic.${userId}`, oldKey = `wordtrail.consolidation.create.${userId}`;
const busy = ref(false), message = ref(''), empty = ref(false), oldPending = ref<CreateConsolidation>();
let alive = true;
onScopeDispose(() => { alive = false; });
function definitive(e: unknown) {
  return e instanceof ApiError && !['NETWORK_ERROR', 'TRAINING_DEPLOYMENT_REQUIRED', 'IDENTITY_CHANGED'].includes(e.code) && (e.status === undefined || e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status));
}
async function start() {
  if (busy.value) return;
  busy.value = true; message.value = ''; empty.value = false;
  try {
    const old = sessionStorage.getItem(oldKey);
    if (old) {
      try {
        const body = JSON.parse(old) as CreateConsolidation;
        if (!isIssueFilter(body) || !body.requestId || !body.mode || (!!body.wordIds === (body.count !== undefined))) throw new Error();
        oldPending.value = body; message.value = '有一次练习准备结果尚未确认，请重试原请求。';
      } catch { message.value = '之前的练习请求无法读取，请核对学习记录。'; }
      return;
    }
    let requestId = sessionStorage.getItem(key);
    if (!requestId) { requestId = createRequestId(); sessionStorage.setItem(key, requestId); }
    const task = await consolidationApi.automatic(requestId);
    if (!alive) return;
    sessionStorage.removeItem(key);
    await router.replace(`/consolidation/study/${task.batchId}`);
  } catch (e) {
    if (!alive) return;
    if (definitive(e)) sessionStorage.removeItem(key);
    empty.value = e instanceof ApiError && e.code === 'NO_CONSOLIDATION_WORDS';
    message.value = empty.value ? '' : errorMessage(e);
  } finally { if (alive) busy.value = false; }
}
async function retryOld() {
  if (!oldPending.value || busy.value) return;
  busy.value = true; message.value = '';
  try { await consolidationApi.create(oldPending.value); sessionStorage.removeItem(oldKey); oldPending.value = undefined; }
  catch (e) { if (definitive(e)) { sessionStorage.removeItem(oldKey); oldPending.value = undefined; } message.value = errorMessage(e); }
  finally { if (alive) busy.value = false; }
  if (alive && !message.value) await start();
}
onMounted(() => { void start(); });
</script>
<template>
  <div class="study-workspace consolidation-workspace">
    <nav class="workspace-shortcuts" aria-label="学习入口"><RouterLink to="/learn"><BookOpen :size="16" :stroke-width="1.7" aria-hidden="true" /><span>每日单词</span></RouterLink><RouterLink to="/dictation"><PencilLine :size="16" :stroke-width="1.7" aria-hidden="true" /><span>独立默写专项</span></RouterLink><RouterLink to="/consolidation" class="is-active" aria-current="page"><BookOpen :size="16" aria-hidden="true" /><span>错因与巩固</span></RouterLink></nav>
    <div class="library-empty learning-empty" aria-live="polite">
      <h1>{{ busy ? '正在准备错词巩固' : empty ? '暂无待巩固的错词' : '错词巩固' }}</h1>
      <p v-if="busy">正在准备需要巩固的单词…</p>
      <p v-if="message" role="status">{{ message }}</p>
      <AppButton v-if="oldPending && !busy" @click="retryOld">重试原请求</AppButton>
      <AppButton v-else-if="message && !busy && !message.includes('无法读取')" @click="start">重试</AppButton>
      <RouterLink to="/consolidation/words" class="muted-link">查看错词与错因</RouterLink>
    </div>
  </div>
</template>
