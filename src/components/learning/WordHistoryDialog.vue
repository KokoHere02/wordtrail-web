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
import { ArrowUpRight, History, RotateCcw } from 'lucide-vue-next';
const props = defineProps<{ modelValue: boolean; wordId: number | null; word: string; initialMode?: 'RECOGNITION' | 'DICTATION' }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const { data, loading, error, load } = useResource<Page<WordHistoryEvent>>();
const page = ref(1);
const mode = ref<'RECOGNITION' | 'DICTATION'>(props.initialMode || 'RECOGNITION');
const size = 10;
const labels = { 1: '认识', 2: '模糊', 3: '不认识' };
const groups = computed(() => [
  { label: '每日学习', events: data.value?.records.filter(event => event.taskType === 'DAILY') || [] },
  { label: '历史认读专项', events: data.value?.records.filter(event => event.taskType === 'PRACTICE') || [] },
]);
function scheduleFields(snapshot: Record<string, unknown>) {
  const fields: { label: string; value: string }[] = [];
  if (typeof snapshot.reviewLevel === 'number') fields.push({ label: '复习等级', value: String(snapshot.reviewLevel) });
  if (typeof snapshot.nextReviewAt === 'string') fields.push({ label: '下次复习', value: snapshot.nextReviewAt.replace('T', ' ') });
  else if (snapshot.nextReviewAt === null) fields.push({ label: '下次复习', value: '未安排' });
  return fields;
}
function refresh() {
  const id = props.wordId;
  if (props.modelValue && id !== null && mode.value === 'RECOGNITION') void load(() => dailyApi.history(id, { page: page.value, size }));
}
watch(() => [props.modelValue, props.wordId] as const, () => { page.value = 1; mode.value = props.initialMode || 'RECOGNITION'; }, { flush: 'sync' });
watch(() => [props.modelValue, props.wordId, mode.value] as const, refresh, { immediate: true });
function changePage(value: number) { page.value = value; refresh(); }
</script>
<template>
  <AppDialog :model-value="modelValue" :title="`${word} · 学习历史`" description="最新记录在前 · 北京时间" panel-class="word-history-dialog" @update:model-value="emit('update:modelValue', $event)">
    <div class="history-type-tabs" role="group" aria-label="历史类型"><button type="button" :class="{ active: mode === 'RECOGNITION' }" :aria-pressed="mode === 'RECOGNITION'" @click="mode = 'RECOGNITION'">学习记录</button><button type="button" :class="{ active: mode === 'DICTATION' }" :aria-pressed="mode === 'DICTATION'" @click="mode = 'DICTATION'">默写记录</button></div>
    <div class="word-history-body">
      <DictationHistoryList v-if="modelValue && mode === 'DICTATION' && wordId !== null" :word-id="wordId" />
      <template v-if="mode === 'RECOGNITION'">
        <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" message="暂无事件记录，不能解释为从未学习。" @retry="refresh" />
        <template v-if="!loading && !error">
          <section v-for="group in groups.filter(entry => entry.events.length)" :key="group.label" class="history-group">
            <header class="word-history-group-heading"><h3>{{ group.label }}</h3><span>{{ group.events.length }} 条</span></header>
            <article v-for="event in group.events" :key="event.logId" class="history-event word-history-event">
              <header class="word-history-event-heading"><span :class="['word-history-mark', { 'is-correction': event.eventType === 'CORRECTION' }]"><RotateCcw v-if="event.eventType === 'CORRECTION'" :size="17" aria-hidden="true" /><History v-else :size="17" aria-hidden="true" /></span><div><strong>{{ event.taskType === 'PRACTICE' ? labels[event.result] : event.eventType === 'CORRECTION' ? '已更正作答' : '已记录作答' }}</strong><span class="word-history-event-kind">{{ event.eventType === 'CORRECTION' ? '更正记录' : '学习作答' }}</span></div><time :datetime="event.answeredAt">{{ event.answeredAt.replace('T', ' ') }}</time></header>
              <div class="word-history-event-meta"><span>学习日 {{ event.learningDate }}</span><span>第 {{ event.attemptNo }} 次作答</span></div>
              <details class="word-history-details"><summary>查看记录详情</summary><dl class="word-history-facts"><div><dt>记录编号</dt><dd>#{{ event.logId }}</dd></div><div><dt>学习批次</dt><dd>#{{ event.batchId }}</dd></div><div v-if="event.eventType === 'CORRECTION'"><dt>对应原记录</dt><dd>{{ event.correctsLogId === null ? '未记录' : `#${event.correctsLogId}` }}</dd></div></dl>
                <div v-if="event.scheduleAvailable && event.scheduleBefore && event.scheduleAfter" class="word-history-schedules"><section v-for="(snapshot, index) in [event.scheduleBefore, event.scheduleAfter]" :key="index"><h4>{{ index === 0 ? '学习前' : '学习后' }}</h4><dl v-if="scheduleFields(snapshot).length"><div v-for="field in scheduleFields(snapshot)" :key="field.label"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div></dl><p v-else>未记录复习安排</p></section></div>
              </details>
            </article>
          </section>
        </template>
        <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="changePage" />
      </template>
    </div>
    <footer v-if="wordId !== null" class="word-history-footer"><RouterLink :to="`/words/${wordId}`" class="violet-link" @click="emit('update:modelValue', false)">单词详情<ArrowUpRight :size="16" aria-hidden="true" /></RouterLink></footer>
  </AppDialog>
</template>
