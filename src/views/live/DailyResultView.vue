<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, ArrowRight, Check } from 'lucide-vue-next';
import { dailyApi } from '../../api/daily';
import { useResource } from '../../composables/useResource';
import type { DailyTask, TodayOverview } from '../../types/daily';
import DailyStats from '../../components/learning/DailyStats.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
const id = Number(useRoute().params.batchId);
const { data, loading, error, load } = useResource<{ task: DailyTask; today: TodayOverview }>();
const refresh = () => load(async () => { const [task, today] = await Promise.all([dailyApi.task(id), dailyApi.today()]); return { task, today }; });
onMounted(refresh);
</script>
<template>
  <div class="preview-result-page live-daily-result">
    <RouterLink to="/records" class="muted-link"><ArrowLeft :size="17" />返回学习记录</RouterLink>
    <StatePanel :loading="loading" :error="error" @retry="refresh" />
    <template v-if="data && !loading && !error"><div class="result-celebration"><span v-if="data.task.status === 'COMPLETED'" class="completion-check"><Check :size="30" /></span><p class="overline">A LITTLE BETTER EVERY DAY</p><h1>{{ data.task.status === 'COMPLETED' ? '今天的积累，已经留下。' : data.task.status === 'ABANDONED' ? '这一轮已结束。' : '一点积累，正在继续。' }}</h1><p>{{ data.task.learningDate }} · {{ data.task.newCount }} 个新词 · {{ data.task.reviewCount }} 个复习词</p></div>
    <DailyStats :task="data.task" /><p class="result-disclaimer">这是本轮用户自评记录。任务结束时可能包含跳过词，不表示全部完成或已经掌握。</p><RouterLink :to="{ path: '/statistics', query: { date: data.task.learningDate } }" class="violet-link">查看该日统计和单词</RouterLink>
    <p v-if="data.task.learningDate !== data.today.learningDate" class="result-disclaimer">历史每日任务只读，请在今日任务中继续学习。</p>
    <div class="result-ctas"><RouterLink v-if="data.task.status === 'IN_PROGRESS' && data.task.learningDate === data.today.learningDate" :to="`/learn/${data.task.batchId}`" class="btn btn-primary">继续学习<ArrowRight :size="18" /></RouterLink><RouterLink to="/today" class="btn btn-secondary">回到今日<ArrowRight :size="18" /></RouterLink></div>
    </template>
  </div>
</template>
