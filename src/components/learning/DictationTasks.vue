<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { dictationApi } from '../../api/dictation';
import { useResource } from '../../composables/useResource';
import type { Page, Status } from '../../types/api';
import type { DictationTask } from '../../types/dictation';
import AppPagination from '../ui/AppPagination.vue';
import StatePanel from '../ui/StatePanel.vue';
defineProps<{ resumeOnly?: boolean }>();
const { data, loading, error, load } = useResource<Page<DictationTask>>();
const status = ref<Status>('IN_PROGRESS');
const page = ref(1);
const size = 8;
const filters: { value: Status; label: string }[] = [{ value: 'IN_PROGRESS', label: '进行中' }, { value: 'COMPLETED', label: '已完成' }, { value: 'ABANDONED', label: '已放弃' }];
const refresh = () => load(() => dictationApi.tasks({ page: page.value, size, status: status.value }));
watch(status, () => { if (page.value !== 1) page.value = 1; else void refresh(); });
watch(page, refresh);
onMounted(refresh);
defineExpose({ refresh });
</script>
<template>
  <section id="dictation-tasks" class="dictation-tasks" aria-labelledby="dictation-tasks-heading">
    <div class="dictation-section-heading"><h2 id="dictation-tasks-heading">{{ resumeOnly ? '继续默写' : '默写记录' }}</h2><button type="button" class="muted-link" :disabled="loading" @click="refresh">刷新记录</button></div>
    <div v-if="!resumeOnly" class="category-tabs" role="group" aria-label="默写批次状态"><button v-for="filter in filters" :key="filter.value" :aria-pressed="status === filter.value" :class="{ active: status === filter.value }" @click="status = filter.value">{{ filter.label }}</button></div>
    <StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="暂无这个状态的默写任务。" @retry="refresh" />
    <div v-if="!loading && !error" class="dictation-task-list"><article v-for="task in data?.records" :key="task.batchId" class="dictation-task-row"><div><h3>{{ task.bookId === null ? '跨词本默写' : `词本 #${task.bookId} 默写` }}</h3><p class="subtle-copy">{{ task.createdAt.replace('T', ' ') }} · 完成 {{ task.completedCount }} / {{ task.totalCount }} 词 · 尝试 {{ task.attemptCount }} 次</p></div><RouterLink v-if="task.status !== 'ABANDONED'" :to="`/dictation/${task.batchId}${task.status === 'COMPLETED' ? '/result' : ''}`" class="btn btn-secondary">{{ task.status === 'COMPLETED' ? '回顾默写' : '继续默写' }}</RouterLink><span v-else class="subtle-copy">已放弃</span></article></div>
    <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="page = $event" />
  </section>
</template>
