<script setup lang="ts">
import { computed, onMounted, ref, watchEffect, onActivated, onScopeDispose, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowRight } from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth';
import { useDailyLearning } from '../../composables/useDailyLearning';
import { useStartDaily } from '../../composables/useStartDaily';
import { useLearningKeys } from '../../composables/useLearningKeys';
import LearningCard from '../../components/learning/LearningCard.vue';
import LearningControls from '../../components/learning/LearningControls.vue';
import ReviewHeader from '../../components/learning/ReviewHeader.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppButton from '../../components/ui/AppButton.vue';
import { useStudySurface } from '../../composables/useStudySurface';
import type { Result } from '../../types/api';
import { dailyApi } from '../../api/daily';
const props = defineProps<{ embedded?: boolean; requestedBatchId?: number }>();
const surface = useStudySurface();
const route = useRoute();
const router = useRouter();
const requestedId = props.embedded ? props.requestedBatchId : route.params.batchId ? Number(route.params.batchId) : undefined;
const learning = useDailyLearning(useAuthStore().user!.id);
const { session, current, answer, isPast, busy, feedback, reveal, canRate, canPrevious, canNext, canCorrect } = learning;
const { progress, overview, item, pending, loading, saving, error, expired, historical, noWords, notice } = session;
const { visible, definition, loading: revealLoading, error: revealError } = reveal;
const card = ref<InstanceType<typeof LearningCard>>();
const displayKey = computed(() => isPast.value ? `past:${learning.history.selected.value?.key}` : `live:${item.value?.itemId}:${item.value?.nextAttemptNo}`);
const readonly = computed(() => historical.value || progress.value?.status === 'ABANDONED');
const { starting, startError, start } = useStartDaily(async task => {
  const path = task.status === 'IN_PROGRESS' ? `/learn/${task.batchId}` : `/records/${task.batchId}`;
  if (route.path === path) await session.open(task.batchId); else await router.push(path);
});
function revealMeaning() { if (current.value && !busy.value) return reveal.reveal(); }
function pronounce() { if (current.value && !busy.value) card.value?.pronounce(); }
watchEffect(() => { if (surface) surface.state.source = progress.value ? `每日计划 · ${progress.value.learningDate}` : '每日计划'; });
async function rate(result: Result) { await learning.rate(result); if (surface?.active.value && !session.pending.value && !session.error.value && session.receipt.value) await learning.next(); }
async function retryAnswer() { await learning.retry(); if (surface?.active.value && !session.pending.value && !session.error.value && session.receipt.value) await learning.next(); }
useLearningKeys({ reveal: revealMeaning, pronounce, rate: result => card.value?.rate(result), previous: learning.previous, next: learning.next, correct: () => card.value?.openCorrection(), cancelCorrection: () => card.value?.cancelCorrection() });
onMounted(() => session.open(requestedId));
let live = true;
onScopeDispose(() => { live = false; });
onActivated(() => {
  void nextTick(async () => {
    if (!live || !surface?.active.value || busy.value || pending.value || !progress.value) return;
    const id = progress.value.batchId;
    try {
      const latest = await dailyApi.task(id);
      if (!live || !surface.active.value || busy.value || pending.value || progress.value?.batchId !== id) return;
      const previous = progress.value;
      if (latest.totalCount !== previous.totalCount || latest.nextItemId !== previous.nextItemId || latest.status !== previous.status || latest.answerCount !== previous.answerCount || latest.skippedCount !== previous.skippedCount) await session.open(id);
    } catch { if (live) notice.value = '暂未同步最新任务，可在练习设置中重新同步。'; }
  });
});
</script>
<template>
  <div class="review-page learning-page live-daily-page">
    <ReviewHeader :completed="progress?.completedCount || 0" :total="progress?.totalCount || 0" :skipped="progress?.skippedCount || 0" back-to="/today" label="今日学习" :description="progress?.learningDate" />
    <div class="learning-main">
      <div v-if="surface?.state.settings" class="workspace-configuration live-actions"><RouterLink to="/plan" class="muted-link">调整计划范围</RouterLink><RouterLink to="/settings" class="muted-link">每日目标</RouterLink><button class="muted-link" :disabled="busy" @click="session.open(requestedId)">同步服务端进度</button></div>
      <StatePanel :loading="loading && !current" />
      <p v-if="notice || feedback" class="learning-notice" role="status">{{ notice || feedback }}</p>
      <p v-if="startError" class="inline-error" role="alert">{{ startError }}</p>
      <div v-if="error && !noWords" class="live-error learning-error" role="alert"><p>{{ error }}</p><button v-if="pending && !expired" class="violet-link" :disabled="busy" @click="retryAnswer">{{ saving ? '正在确认…' : '重试原请求' }}</button><button v-else-if="!expired" class="violet-link" :disabled="busy" @click="session.open(requestedId)">重新同步</button><RouterLink v-else to="/today" class="violet-link">返回今日任务</RouterLink></div>
      <template v-if="current && !readonly && !expired">
        <LearningCard ref="card" :word="current.word" :phonetic="current.phonetic" :word-key="displayKey" variant="daily" :visible="visible" :definition="definition" :reveal-loading="revealLoading" :reveal-error="revealError" :busy="busy" :rate-disabled="!canRate || revealLoading" :result="answer?.result" :past="isPast" :can-correct="canCorrect" @reveal="revealMeaning" @rate="rate" @correct="learning.correct" />
        <LearningControls :previous-disabled="!canPrevious" :next-disabled="!canNext" :final="!isPast && progress?.status === 'COMPLETED'" @previous="learning.previous" @next="learning.next" />
      </template>
      <div v-else-if="!loading && !error" class="library-empty learning-empty"><h1>{{ historical ? '历史任务仅供回顾' : noWords ? '今天暂时没有待学的词' : progress?.status === 'COMPLETED' ? '本轮已结束' : !progress ? '开始今日学习' : '本轮暂无可作答单词' }}</h1><p v-if="progress">完成 {{ progress.completedCount }} / {{ progress.totalCount }} 词</p><AppButton v-if="!historical && !pending && (!progress || overview?.canAddMore)" :busy="starting" @click="start">{{ progress ? '继续学习' : '开始学习' }}<ArrowRight :size="18" /></AppButton><RouterLink v-if="progress" :to="`/records/${progress.batchId}`" class="btn btn-secondary">查看本轮记录</RouterLink><RouterLink to="/books" class="violet-link">去词库选词</RouterLink></div>
    </div>
  </div>
</template>
