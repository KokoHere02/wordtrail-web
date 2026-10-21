<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ArrowRight, Check } from 'lucide-vue-next';
import { useDailySession } from '../../composables/useDailySession';
import { useStartDaily } from '../../composables/useStartDaily';
import { useAuthStore } from '../../stores/auth';
import type { Result } from '../../types/api';
import DailyStats from '../../components/learning/DailyStats.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppButton from '../../components/ui/AppButton.vue';
import ReinforcementStatus from '../../components/learning/ReinforcementStatus.vue';
const route = useRoute();
const router = useRouter();
const requestedId = route.params.batchId ? Number(route.params.batchId) : undefined;
const session = useDailySession(useAuthStore().user!.id);
const { starting, startError, start } = useStartDaily(async task => {
  const path = task.status === 'IN_PROGRESS' ? `/learn/${task.batchId}` : `/records/${task.batchId}`;
  if (route.path === path) await session.open(task.batchId);
  else await router.push(path);
});
const { progress, overview, item, receipt, answerDetails, detailsError, pending, loading, saving, error, expired, historical, noWords, notice, correctableLogId } = session;
const choices: { value: Result; name: string; className: string; key: string }[] = [{ value: 3, name: '忘记', className: 'forgot', key: '1' }, { value: 2, name: '模糊', className: 'uncertain', key: '2' }, { value: 1, name: '认识', className: 'known', key: '3' }];
const readonly = computed(() => historical.value || !!progress.value && progress.value.status !== 'IN_PROGRESS' && !receipt.value && !pending.value);
const reinforcementItem = computed(() => receipt.value ? answerDetails.value : item.value);
const canAnswer = computed(() => !!item.value && ['PENDING', 'RELEARNING'].includes(item.value.learningStatus) && item.value.nextAttemptNo !== null && item.value.nextAttemptNo <= item.value.attemptLimit && progress.value?.nextItemId === item.value.itemId && !receipt.value && !pending.value && !loading.value && !saving.value && !expired.value && !readonly.value);
async function next() {
  await session.next();
  if (!error.value && !item.value && progress.value?.status === 'COMPLETED') await router.push(`/records/${progress.value.batchId}`);
}
function keyboard(event: KeyboardEvent) {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('[role="dialog"]') || event.target instanceof HTMLElement && event.target.closest('input,select,textarea,button,a,[contenteditable=true]')) return;
  const choice = choices.find(c => c.key === event.key);
  if (choice && canAnswer.value) { event.preventDefault(); void session.answer(choice.value); }
  if (event.key === 'Enter' && receipt.value) { event.preventDefault(); void next(); }
}
onMounted(() => { void session.open(requestedId); document.addEventListener('keydown', keyboard); });
onBeforeUnmount(() => document.removeEventListener('keydown', keyboard));
</script>
<template>
  <div class="memory-page practice-page live-daily-page">
    <div class="practice-breadcrumb"><p><span class="practice-badge">今日复习</span></p><RouterLink to="/today" class="violet-link">返回今日<ArrowLeft :size="17" /></RouterLink></div>
    <div class="live-study-heading"><span>{{ progress?.learningDate || '每日学习' }}</span><RouterLink to="/plan" class="muted-link">管理计划</RouterLink></div>
    <StatePanel :loading="loading" />
    <p v-if="notice" class="live-notice" role="status">{{ notice }}</p>
    <p v-if="startError" class="inline-error" role="alert">{{ startError }}</p>
    <div v-if="error && !noWords" class="live-error" role="alert"><p>{{ error }}</p><div class="live-actions"><button v-if="pending && !expired" class="violet-link" :disabled="saving || loading" @click="session.retry">{{ saving ? '正在确认…' : '重试原请求' }}</button><RouterLink v-else-if="expired" to="/today" class="violet-link">返回今日任务</RouterLink><button v-else class="violet-link" :disabled="loading || saving" @click="session.open(requestedId)">重新同步</button><RouterLink to="/books" class="muted-link">去词库选词</RouterLink></div></div>
    <div v-if="noWords && !loading" class="library-empty"><h1>今天暂时没有待学的词</h1><p>{{ error }}</p><RouterLink to="/books" class="btn btn-primary">去词库加入计划<ArrowRight :size="18" /></RouterLink><RouterLink to="/plan" class="violet-link">查看我的计划</RouterLink></div><div v-if="!loading && !expired && !noWords && item && !readonly" class="memory-content">
      <p class="practice-counter">{{ item.itemType === 'NEW' ? '新词' : '复习' }}<template v-if="item.learningStatus === 'RELEARNING'"> · 本轮强化</template> · 已完成 {{ progress?.completedCount }} / {{ progress?.totalCount }} 词</p>
      <ReinforcementStatus v-if="reinforcementItem" :item="reinforcementItem" :answered="!!receipt" />
      <p v-if="detailsError" class="inline-error" role="alert">已保存，巩固状态暂未同步。<button class="violet-link" :disabled="saving" @click="session.syncAnswerDetails">重新同步</button></p>
      <div class="memory-word-stage"><Transition name="word" mode="out-in"><section :key="`${item.itemId}:${item.nextAttemptNo}`" class="memory-word-content"><div class="memory-title"><h1 :class="{ 'long-memory-word': item.word.length > 14 }" lang="en">{{ item.word }}</h1></div><p class="memory-phonetic">{{ item.phonetic }}</p><div class="live-meaning" aria-live="polite"><Transition name="feedback" mode="out-in"><p v-if="receipt" key="meaning" class="memory-meaning">{{ receipt.translation || '暂无释义' }}</p><p v-else key="hint" class="subtle-copy">回想这个词的意思</p></Transition></div></section></Transition></div>
      <div class="recall-options" role="group" aria-label="你对这个单词的记忆"><button v-for="choice in choices" :key="choice.value" :class="['recall-card', `recall-${choice.className}`, { picked: receipt?.result === choice.value }]" :disabled="!canAnswer" :aria-pressed="receipt?.result === choice.value" @click="session.answer(choice.value)"><strong>{{ choice.name }}</strong><span>按 {{ choice.key }} 自评</span><Check v-if="receipt?.result === choice.value" class="recall-check" :size="17" /></button></div>
      <div class="recall-caption live-recall-caption"><template v-if="receipt"><button v-if="receipt.result === 1 && correctableLogId" class="muted-link" :disabled="saving || !!pending" @click="session.correct">记错了</button><button class="violet-link" :disabled="saving || !!pending" @click="next">{{ progress?.status === 'COMPLETED' ? '完成本轮' : '下一个单词' }}<ArrowRight :size="17" /></button></template><span v-else>{{ saving ? '正在保存…' : '' }}</span></div>
      <DailyStats v-if="progress" :task="progress" />
      <p v-if="receipt?.correction" class="practice-feedback" role="status"><Check :size="20" />已更正为不认识</p>
    </div>
    <div v-else-if="!loading && !error && !expired && !noWords" class="library-empty"><h1>{{ historical ? '历史任务仅供回顾' : progress?.status === 'COMPLETED' ? '本轮已结束' : !progress ? '开始今日学习' : '本轮暂无可作答单词' }}</h1><DailyStats v-if="progress" :task="progress" /><AppButton v-if="!historical && !pending && (!progress || overview?.canAddMore && overview.task?.batchId === progress.batchId)" :busy="starting" @click="start">{{ progress ? '继续学习' : '开始学习' }}<ArrowRight :size="18" /></AppButton><button v-if="!historical && progress?.status === 'IN_PROGRESS'" class="violet-link" @click="session.open(requestedId)">重新同步任务</button><RouterLink v-if="progress" :to="`/records/${progress.batchId}`" class="btn btn-secondary">查看本轮记录<ArrowRight :size="18" /></RouterLink><RouterLink to="/books" class="violet-link">去词库选词</RouterLink></div>
  </div>
</template>
