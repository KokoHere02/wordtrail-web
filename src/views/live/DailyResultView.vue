<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, ArrowRight, Check } from 'lucide-vue-next';
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
const router = useRouter(), workspace = useStudyWorkspace();
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
  <div class="preview-result-page live-daily-result">
    <RouterLink to="/records" class="muted-link"><ArrowLeft :size="17" />返回学习记录</RouterLink>
    <StatePanel :loading="loading" :error="error" @retry="refresh" />
    <template v-if="data && !loading && !error"><div class="result-celebration"><span v-if="data.task.status === 'COMPLETED'" class="completion-check"><Check :size="30" /></span><h1>{{ data.task.status === 'COMPLETED' ? '本轮已结束' : data.task.status === 'ABANDONED' ? '本轮已放弃' : '本轮进行中' }}</h1><p>{{ data.task.learningDate }} · {{ data.task.newCount }} 个新词 · {{ data.task.reviewCount }} 个复习词</p></div>
    <DailyStats :task="data.task" /><RouterLink :to="{ path: '/statistics', query: { date: data.task.learningDate } }" class="violet-link">查看该日统计和单词</RouterLink>
    <p v-if="data.task.learningDate === data.today.learningDate && goal" class="daily-goal-status">{{ goal.reached ? '每日目标已达成' : `距每日目标还差 ${goal.remainingCount} 词` }}</p>
    <p v-if="data.task.learningDate === data.today.learningDate && (data.today.needsMoreWords || noWords)" class="daily-needs-words">请添加单词到学习计划，收进词本后还需选择“加入学习计划”。</p>
    <p v-if="startError" class="inline-error" role="alert">{{ startError }}</p>
    <div class="result-ctas"><RouterLink v-if="data.task.learningDate === data.today.learningDate && (data.today.needsMoreWords || noWords)" to="/books" class="btn btn-primary">添加单词到学习计划<ArrowRight :size="18" /></RouterLink><AppButton v-else-if="data.today.canAddMore && data.today.task?.batchId === data.task.batchId && data.task.learningDate === data.today.learningDate" :busy="starting" @click="start">继续学习<ArrowRight :size="18" /></AppButton><RouterLink v-else-if="data.task.status === 'IN_PROGRESS' && data.task.learningDate === data.today.learningDate" :to="`/learn/${data.task.batchId}`" class="btn btn-primary">继续学习<ArrowRight :size="18" /></RouterLink><RouterLink to="/today" class="btn btn-secondary">回到今日<ArrowRight :size="18" /></RouterLink></div>
    <h2>本组词项</h2><TrainingItems :batch-id="id" :allow-extra="data.task.learningDate === data.today.learningDate" @extra="extra" />
    <h2>训练历史</h2><TrainingHistory :batch-id="id" />
    </template>
  </div>
</template>
