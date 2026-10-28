<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { dictationApi } from '../../api/dictation';
import { useResource } from '../../composables/useResource';
import type { Page, Status } from '../../types/api';
import type { DictationTask } from '../../types/dictation';
import AppPagination from '../ui/AppPagination.vue';
import StatePanel from '../ui/StatePanel.vue';
const props = withDefaults(defineProps<{ resumeOnly?: boolean; active?: boolean }>(), { active: true });
const { data, loading, error, load } = useResource<Page<DictationTask>>();
const status = ref<Status>('IN_PROGRESS');
const page = ref(1);
const size = 8;
const filters: { value: Status; label: string }[] = [{ value: 'IN_PROGRESS', label: '进行中' }, { value: 'COMPLETED', label: '已完成' }, { value: 'ABANDONED', label: '已放弃' }];
const records = computed(() => props.resumeOnly ? data.value?.records.filter(task => task.status === 'IN_PROGRESS' && task.singleAttempt && task.canContinue) ?? [] : data.value?.records ?? []);
const refresh = () => load(() => dictationApi.tasks({ page: page.value, size, status: props.resumeOnly ? 'IN_PROGRESS' : status.value }));
watch(status, () => { if (page.value !== 1) page.value = 1; else void refresh(); });
watch(page, refresh);
watch(() => props.active, active => { if (active) void refresh(); });
onMounted(() => { if (props.active !== false) void refresh(); });
let activated = false;
onActivated(() => { if (activated && props.active !== false) void refresh(); activated = true; });
defineExpose({ refresh });
</script>
<template>
  <section v-if="!resumeOnly || loading || error || records.length || (data && data.total > size)" id="dictation-tasks" :class="['dictation-tasks', { 'dictation-resume': resumeOnly }]" aria-labelledby="dictation-tasks-heading">
    <div class="dictation-section-heading"><h2 id="dictation-tasks-heading">{{ resumeOnly ? '继续测验' : '默写记录' }}</h2><button type="button" class="muted-link" :disabled="loading" @click="refresh">刷新记录</button></div>
    <div v-if="!resumeOnly" class="category-tabs" role="group" aria-label="默写批次状态"><button v-for="filter in filters" :key="filter.value" :aria-pressed="status === filter.value" :class="{ active: status === filter.value }" @click="status = filter.value">{{ filter.label }}</button></div>
    <StatePanel :loading="loading" :error="error" :empty="!!data && !records.length" :message="resumeOnly ? '本页没有可继续的测验。' : '暂无这个状态的默写任务。'" @retry="refresh" />
    <div v-if="!loading && !error" class="dictation-task-list"><article v-for="task in records" :key="task.batchId" class="dictation-task-row"><div><h3>{{ task.singleAttempt ? '独立默写测验' : '旧版默写记录' }}{{ task.bookId === null ? '' : ` · 词本 #${task.bookId}` }} · {{ task.totalCount }} 词 <span class="dictation-task-number">#{{ task.batchId }}</span></h3><p class="subtle-copy">{{ task.createdAt.replace('T', ' ') }} · 完成 {{ task.completedCount }} / {{ task.totalCount }} 词 · 已提交 {{ task.attemptCount }} 次</p></div><RouterLink v-if="task.singleAttempt && task.canContinue && task.status === 'IN_PROGRESS'" :to="`/dictation/${task.batchId}`" class="btn btn-secondary">继续测验</RouterLink><RouterLink v-else :to="`/dictation/${task.batchId}/result`" class="btn btn-secondary">查看记录</RouterLink></article></div>
    <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="page = $event" />
  </section>
</template>
