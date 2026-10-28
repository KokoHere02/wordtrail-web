<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, ArrowRight } from 'lucide-vue-next';
import { dailyApi } from '../../api/daily';
import { useResource } from '../../composables/useResource';
import { useStartDaily } from '../../composables/useStartDaily';
import type { DailyTask, TodayOverview } from '../../types/daily';
import DailyStats from '../../components/learning/DailyStats.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppButton from '../../components/ui/AppButton.vue';
import TrainingHistory from '../../components/learning/TrainingHistory.vue';
import TrainingItems from '../../components/learning/TrainingItems.vue';
import { useRouter } from 'vue-router';
import { useStudyWorkspace } from '../../stores/studyWorkspace';
import { useDailyGoal } from '../../composables/useDailyGoal';
import { dailyRecordStatus } from '../../utils/dailyRecordStatus';
const router = useRouter(), workspace = useStudyWorkspace();
const section = ref<'words' | 'history'>('words');
function extra(itemId: number) { workspace.extraDailyItemId = itemId; void router.push(`/learn/${id}`); }
const id = Number(useRoute().params.batchId);
const { data, loading, error, load } = useResource<{ task: DailyTask; today: TodayOverview }>();
const { goal, refresh: refreshGoal } = useDailyGoal(() => data.value?.task.learningDate, () => data.value?.task.batchId);
const refresh = async () => {
  await load(async () => { const [task, today] = await Promise.all([dailyApi.task(id), dailyApi.today()]); return { task, today }; });
  if (data.value && data.value.task.learningDate === data.value.today.learningDate) await refreshGoal();
};
const { starting, startError, noWords, start } = useStartDaily(undefined, refresh);
onMounted(refresh);
</script>
<template>
  <div class="live-daily-result">
    <RouterLink to="/records" class="muted-link"><ArrowLeft :size="17" />返回学习记录</RouterLink>
    <StatePanel :loading="loading" :error="error" @retry="refresh" />
    <template v-if="data && !loading && !error">
    <header class="daily-record-heading">
      <div><h1>{{ data.task.learningDate }} 学习记录</h1><span class="learning-badge">{{ dailyRecordStatus(data.task, data.today.learningDate) }}</span></div>
      <div class="result-ctas"><RouterLink v-if="data.task.learningDate === data.today.learningDate && (data.today.needsMoreWords || noWords)" to="/books" class="btn btn-primary">添加单词到学习计划<ArrowRight :size="18" /></RouterLink><AppButton v-else-if="data.today.canAddMore && data.today.task?.batchId === data.task.batchId && data.task.learningDate === data.today.learningDate" :busy="starting" @click="start">继续学习<ArrowRight :size="18" /></AppButton><RouterLink v-else-if="data.task.status === 'IN_PROGRESS' && data.task.learningDate === data.today.learningDate" :to="`/learn/${data.task.batchId}`" class="btn btn-primary">继续学习<ArrowRight :size="18" /></RouterLink><RouterLink to="/today" class="btn btn-secondary">回到今日<ArrowRight :size="18" /></RouterLink></div>
    </header>
    <DailyStats :task="data.task" />
    <div class="daily-record-summary">
    <p v-if="data.task.learningDate === data.today.learningDate && goal" class="daily-goal-status">{{ goal.reached ? '每日目标已达成' : `距每日目标还差 ${goal.remainingCount} 词` }}</p>
    <p v-if="data.task.learningDate === data.today.learningDate && (data.today.needsMoreWords || noWords)" class="daily-needs-words">请添加单词到学习计划，收进词本后还需选择“加入学习计划”。</p>
    <p v-if="startError" class="inline-error" role="alert">{{ startError }}</p>
    </div>
    <section class="daily-record-content" aria-label="学习明细">
      <div class="daily-record-toolbar">
        <nav class="category-tabs" aria-label="记录内容"><button :class="{ active: section === 'words' }" :aria-pressed="section === 'words'" aria-controls="record-words" @click="section = 'words'">单词列表</button><button :class="{ active: section === 'history' }" :aria-pressed="section === 'history'" aria-controls="record-history" @click="section = 'history'">练习记录</button></nav>
        <RouterLink :to="{ path: '/statistics', query: { date: data.task.learningDate } }" class="muted-link">当日统计<ArrowRight :size="16" /></RouterLink>
      </div>
      <div id="record-words" v-show="section === 'words'"><TrainingItems :batch-id="id" :allow-extra="data.task.learningDate === data.today.learningDate" @extra="extra" /></div>
      <div id="record-history" v-show="section === 'history'"><TrainingHistory :batch-id="id" /></div>
    </section>
    </template>
  </div>
</template>
<style scoped>
.live-daily-result { width: min(calc(100% - var(--s5) * 2), 1040px); margin: 0 auto; padding-top: var(--s6); }
.daily-record-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--s5); margin: var(--s6) 0; }
.daily-record-heading h1 { font-size: clamp(23px, 3vw, 30px); line-height: 1.4; margin: 0 0 var(--s3); }
.daily-record-heading .result-ctas { display: flex; flex-wrap: wrap; gap: var(--s3); margin: 0; }
.daily-record-summary { display: grid; gap: var(--s2); }
.daily-record-summary:has(> p) { margin-top: var(--s4); }
.daily-record-summary p { margin: 0; }
.daily-record-content { margin-top: var(--s8); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 0 var(--s6); }
.daily-record-toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); padding-block: var(--s4); border-bottom: 1px solid var(--line); }
.daily-record-toolbar .category-tabs { border: 0; margin: 0; }
.daily-record-toolbar > a { white-space: nowrap; font-size: var(--text-sm); }
.daily-record-content :deep(.training-items), .daily-record-content :deep(.training-history) { margin: 0; }
.daily-record-content :deep(.training-item-row), .daily-record-content :deep(.training-history-row) { padding-block: var(--s5); }
.daily-record-content :deep(.training-item-row) { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--s5); }
.daily-record-content :deep(.training-item-row > :not(.training-item-footer)) { grid-column: 1; }
.daily-record-content :deep(.training-item-row .training-item-footer) { grid-column: 2; grid-row: 1 / span 3; align-self: center; flex-direction: column; align-items: flex-end; margin-top: 0; }
.daily-record-content :deep(.training-item-row header), .daily-record-content :deep(.training-history-row header) { margin-bottom: var(--s2); }
.daily-record-content :deep(.training-item-footer) { justify-content: space-between; margin-top: var(--s3); font-size: var(--text-sm); }
.daily-record-content :deep(.training-item-order) { display: inline-grid; place-items: center; min-width: 28px; height: 28px; background: var(--surface-raised); border-radius: var(--radius-sm); font-variant-numeric: tabular-nums; }
.daily-record-content :deep(.training-history-row time) { margin-left: auto; font-size: var(--text-sm); }
.daily-record-content :deep(.pagination) { margin: 0; padding-block: var(--s4); }
@media (max-width: 640px) {
  .live-daily-result { padding-top: var(--s3); }
  .daily-record-heading { align-items: flex-start; flex-direction: column; }
  .daily-record-heading .result-ctas { width: 100%; }
  .daily-record-heading .result-ctas .btn { flex: 1; }
  .daily-record-content { padding-inline: var(--s4); margin-top: var(--s6); }
  .daily-record-toolbar { align-items: stretch; flex-wrap: wrap; gap: 0; }
  .daily-record-toolbar > a { margin: 0 0 var(--s3) auto; }
  .daily-record-content :deep(.training-history-row time) { flex-basis: 100%; margin-left: 0; }
  .daily-record-content :deep(.training-item-row) { grid-template-columns: minmax(0, 1fr); }
  .daily-record-content :deep(.training-item-row .training-item-footer) { grid-column: 1; grid-row: auto; flex-direction: row; align-items: baseline; margin-top: var(--s3); }
}
</style>
