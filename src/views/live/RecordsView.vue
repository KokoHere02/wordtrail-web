<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ArrowRight, ArrowUpRight, BookOpen } from 'lucide-vue-next';
import { dailyApi } from '../../api/daily';
import { useResource } from '../../composables/useResource';
import type { Page, Status } from '../../types/api';
import type { DailyTask } from '../../types/daily';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import { dailyRecordStatus } from '../../utils/dailyRecordStatus';
const { data, loading, error, load } = useResource<{ tasks: Page<DailyTask>; learningDate: string }>();
const status = ref<Status>('IN_PROGRESS');
const filters: { value: Status; label: string }[] = [{ value: 'IN_PROGRESS', label: '未完成' }, { value: 'COMPLETED', label: '已完成' }, { value: 'ABANDONED', label: '已放弃' }];
const page = ref(1);
const size = 8;
const refresh = () => load(async () => {
  const [tasks, today] = await Promise.all([dailyApi.tasks({ page: page.value, size, status: status.value }), dailyApi.today()]);
  return { tasks, learningDate: today.learningDate };
});
watch(status, () => { if (page.value !== 1) page.value = 1; else void refresh(); });
watch(page, refresh);
onMounted(refresh);
</script>
<template>
  <div class="records-page">
    <header class="library-heading"><div><h1 class="reveal" style="--delay: 60ms">学习记录</h1></div><RouterLink to="/learn" class="btn btn-primary">进入今日学习<ArrowRight :size="18" /></RouterLink></header>
    <div class="wordlist-tools"><nav class="category-tabs" aria-label="每日任务状态"><button v-for="entry in filters" :key="entry.value" :class="{ active: status === entry.value }" :aria-pressed="status === entry.value" @click="status = entry.value">{{ entry.label }}</button></nav></div>
    <StatePanel :loading="loading" :error="error" :empty="!!data && !data.tasks.records.length" message="还没有这个状态的每日任务。" @retry="refresh" />
    <TransitionGroup v-if="data && !loading && !error" tag="div" name="book-grid" class="record-list">
      <RouterLink v-for="task in data.tasks.records" :key="task.batchId" :to="`/records/${task.batchId}`" class="record-card">
        <span class="record-icon"><BookOpen :size="24" /></span>
        <div><span class="learning-badge">每日学习 · {{ dailyRecordStatus(task, data.learningDate) }}</span><h2>{{ task.learningDate }}</h2><p>新词 {{ task.newCount }} · 复习 {{ task.reviewCount }}</p></div>
        <div class="record-summary"><strong>{{ task.completedCount }} / {{ task.totalCount }}<small>词</small></strong><span v-if="task.skippedCount">跳过 {{ task.skippedCount }} 词</span></div>
        <ArrowUpRight :size="22" class="record-arrow" />
      </RouterLink>
    </TransitionGroup>
    <AppPagination v-if="data" :page="page" :size="size" :total="data.tasks.total" :disabled="loading" @change="page = $event" />
  </div>
</template>
