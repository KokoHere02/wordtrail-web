<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, ArrowUpRight } from 'lucide-vue-next';
import { dailyApi } from '../../api/daily';
import { useResource } from '../../composables/useResource';
import { useStartDaily } from '../../composables/useStartDaily';
import type { TodayOverview } from '../../types/daily';
import StatePanel from '../../components/ui/StatePanel.vue';
import ProgressBar from '../../components/ui/ProgressBar.vue';
import TodayStatistics from '../../components/learning/TodayStatistics.vue';
import AppButton from '../../components/ui/AppButton.vue';
import { useDailyGoal } from '../../composables/useDailyGoal';
const router = useRouter();
const { data, loading, error, load } = useResource<TodayOverview>();
const { goal, refresh: refreshGoal } = useDailyGoal(() => data.value?.learningDate, () => data.value?.task?.batchId);
const refresh = async () => { await load(dailyApi.today); if (data.value) await refreshGoal(); };
const { starting, startError, noWords, start } = useStartDaily(undefined, refresh);
function continueLearning() {
  if (data.value?.task?.status === 'IN_PROGRESS') return router.push(`/learn/${data.value.task.batchId}`);
  return start();
}
onMounted(refresh);
</script>
<template>
  <div class="today-page">
    <section class="today-hero">
      <h1 class="reveal" style="--delay: 60ms">今日学习</h1>
      <StatePanel :loading="loading" :error="error" @retry="refresh" />
      <template v-if="data && !loading && !error">
        <p class="live-date">{{ data.learningDate }} · {{ data.task ? '本任务目标' : '今日目标' }} {{ data.dailyTarget }} 词 · <RouterLink to="/settings" class="violet-link">设置目标</RouterLink></p>
        <p v-if="(data.task ? data.task.newWordTarget : data.newWordTarget) != null && (data.task ? data.task.reviewLimit : data.reviewLimit) != null" class="subtle-copy">{{ data.task ? '当前任务每轮偏好' : '下一任务每轮偏好' }}：新词 {{ data.task ? data.task.newWordTarget : data.newWordTarget }} · 复习 {{ data.task ? data.task.reviewLimit : data.reviewLimit }}</p>
        <p v-else class="subtle-copy">当前任务策略：优先复习，再补新词。</p>
        <p class="subtle-copy">未编入今日任务的到期复习：{{ data.reviewBacklogCount ?? '—' }} 词 · 逾期复习：{{ data.overdueReviewCount ?? '—' }} 词</p>
        <p class="subtle-copy">逾期指上海今日零点前已到期、仍未完成的启用词，可能包含今日已安排的词。</p>
        <p v-if="data.task?.status === 'COMPLETED'" class="subtle-copy">本组已结束</p>
        <p v-if="goal" class="daily-goal-status">{{ goal.reached ? '每日目标已达成' : `距每日目标还差 ${goal.remainingCount} 词` }}</p>
        <p v-if="data.needsMoreWords || noWords" class="daily-needs-words">请添加单词到学习计划，收进词本后还需选择“加入学习计划”。</p>
        <div class="daily-equation reveal" style="--delay: 180ms">
          <div><strong>{{ data.dueCount }}</strong><span>待复习</span></div><b>·</b>
          <div><strong>{{ data.newCount }}</strong><span>计划内新词</span></div><b>·</b>
          <div><strong>{{ data.task ? data.task.totalCount : '—' }}</strong><span>{{ data.task ? '今日已安排' : '开始后安排' }}</span></div>
        </div>
        <div class="today-cta reveal" style="--delay: 240ms">
          <RouterLink v-if="data.needsMoreWords || noWords" to="/books" class="btn btn-primary btn-hero">添加单词到学习计划<ArrowRight :size="21" /></RouterLink>
          <AppButton v-else-if="!data.task || data.task.status === 'IN_PROGRESS' || data.canAddMore" class="btn-hero" :busy="starting" @click="continueLearning">{{ data.task ? '继续学习' : '开始学习' }}<ArrowRight :size="21" /></AppButton>
          <RouterLink v-else :to="`/records/${data.task.batchId}`" class="btn btn-primary btn-hero">{{ data.task.status === 'ABANDONED' ? '查看今日记录' : '查看今日结果' }}<ArrowRight :size="21" /></RouterLink>
          <RouterLink v-if="!data.needsMoreWords && !noWords" to="/books" class="btn btn-secondary btn-hero">去词库选词</RouterLink>
        </div>
        <p v-if="startError" class="inline-error" role="alert">{{ startError }}</p>
        <p v-if="data.canAddMore" class="subtle-copy">未安排 {{ data.unassignedCount }} 词 · <RouterLink :to="`/records/${data.task?.batchId}`" class="violet-link">查看已有结果</RouterLink></p>
      </template>
    </section>
    <section v-if="data && !loading && !error" class="today-plan reveal" style="--delay: 280ms">
      <div class="today-plan-content">
        <div class="plan-heading"><h2>学习计划</h2><RouterLink to="/plan" class="violet-link">管理计划<ArrowRight :size="19" /></RouterLink></div>
        <p>{{ data.activeCount }} 个启用中的单词</p>
        <p v-if="data.task" class="daily-assigned-counts">今日已安排：新词 {{ data.task.newCount }} · 复习 {{ data.task.reviewCount }}</p>
        <div v-if="data.task" class="plan-progress"><ProgressBar :value="data.task.completedCount" :max="data.task.totalCount" label="今日完成进度" /><span>已完成 {{ data.task.completedCount }} / 已安排 {{ data.task.totalCount }} 词 · 跳过 {{ data.task.skippedCount }} 词</span></div>
        <p v-else-if="!data.activeCount" class="subtle-copy">从词库选词并加入学习计划。</p>
      </div>
    </section>
    <TodayStatistics />
    <div class="today-streak live-actions"><RouterLink to="/learn" class="muted-link">每日单词 · 认读／默写／听音<ArrowUpRight :size="18" /></RouterLink><RouterLink to="/follow-typing" class="muted-link">跟拼练习<ArrowUpRight :size="18" /></RouterLink><RouterLink to="/consolidation" class="muted-link">错因与巩固<ArrowUpRight :size="18" /></RouterLink><RouterLink to="/dictation" class="muted-link">独立默写专项<ArrowUpRight :size="18" /></RouterLink><RouterLink to="/sentences" class="muted-link">句子英译中<ArrowUpRight :size="18" /></RouterLink><RouterLink to="/records" class="muted-link">查看学习记录<ArrowUpRight :size="18" /></RouterLink></div>
  </div>
</template>
