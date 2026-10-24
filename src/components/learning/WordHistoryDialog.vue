<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { dailyApi } from '../../api/daily';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { WordHistoryEvent } from '../../types/daily';
import AppDialog from '../ui/AppDialog.vue';
import AppPagination from '../ui/AppPagination.vue';
import StatePanel from '../ui/StatePanel.vue';
import DictationHistoryList from './DictationHistoryList.vue';
const props = defineProps<{ modelValue: boolean; wordId: number | null; word: string; initialMode?: 'RECOGNITION' | 'DICTATION' }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const { data, loading, error, load } = useResource<Page<WordHistoryEvent>>();
const page = ref(1);
const mode = ref<'RECOGNITION' | 'DICTATION'>(props.initialMode || 'RECOGNITION');
const size = 10;
const labels = { 1: '认识', 2: '模糊', 3: '不认识' };
const groups = computed(() => [
  { label: '本页每日学习事件', events: data.value?.records.filter(event => event.taskType === 'DAILY') || [] },
  { label: '本页认识专项事件', events: data.value?.records.filter(event => event.taskType === 'PRACTICE') || [] },
]);
function refresh() {
  const id = props.wordId;
  if (props.modelValue && id !== null && mode.value === 'RECOGNITION') void load(() => dailyApi.history(id, { page: page.value, size }));
}
watch(() => [props.modelValue, props.wordId] as const, () => { page.value = 1; mode.value = props.initialMode || 'RECOGNITION'; }, { flush: 'sync' });
watch(() => [props.modelValue, props.wordId, mode.value] as const, refresh, { immediate: true });
function changePage(value: number) { page.value = value; refresh(); }
</script>
<template>
  <AppDialog :model-value="modelValue" :title="`${word} · 学习历史`" description="北京时间 · 最新在前" @update:model-value="emit('update:modelValue', $event)">
    <div class="category-tabs history-type-tabs" role="group" aria-label="历史类型"><button :class="{ active: mode === 'RECOGNITION' }" :aria-pressed="mode === 'RECOGNITION'" @click="mode = 'RECOGNITION'">认识记录</button><button :class="{ active: mode === 'DICTATION' }" :aria-pressed="mode === 'DICTATION'" @click="mode = 'DICTATION'">默写记录</button></div>
    <DictationHistoryList v-if="modelValue && mode === 'DICTATION' && wordId !== null" :word-id="wordId" />
    <template v-if="mode === 'RECOGNITION'">
    <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" message="暂无事件记录，不能解释为从未学习。" @retry="refresh" />
    <template v-if="!loading && !error">
      <section v-for="group in groups.filter(entry => entry.events.length)" :key="group.label" class="history-group">
        <h3>{{ group.label }}</h3>
        <article v-for="event in group.events" :key="event.logId" class="history-event">
          <div class="live-actions"><span class="learning-badge">{{ event.eventType === 'CORRECTION' ? '更正事件' : '正常作答' }}</span><strong>{{ labels[event.result] }}</strong></div>
          <p>{{ event.answeredAt.replace('T', ' ') }}</p>
          <p v-if="event.eventType === 'CORRECTION'">更正原作答 #{{ event.correctsLogId ?? '未提供' }} · 不另计次数</p>
          <details class="copy-note"><summary>事件详情</summary>
            <p>事件 #{{ event.logId }} · 批次 #{{ event.batchId }} · 学习日 {{ event.learningDate }}</p>
            <p>当日作答序号 {{ event.attemptNo }}（含专项） · {{ event.affectsSchedule ? '影响长期安排' : '不影响长期安排' }}</p>
            <template v-if="event.scheduleAvailable && event.scheduleBefore && event.scheduleAfter"><span>事件前</span><pre>{{ JSON.stringify(event.scheduleBefore, null, 2) }}</pre><span>事件后</span><pre>{{ JSON.stringify(event.scheduleAfter, null, 2) }}</pre></template>
            <p v-else class="subtle-copy">调度快照不可用。</p>
          </details>
        </article>
      </section>
    </template>
    <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="changePage" />
    </template>
    <RouterLink v-if="wordId !== null" :to="`/words/${wordId}`" class="violet-link history-detail-link" @click="emit('update:modelValue', false)">单词详情</RouterLink>
  </AppDialog>
</template>
