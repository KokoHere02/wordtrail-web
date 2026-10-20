<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { dailyApi } from '../../api/daily';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { WordHistoryEvent } from '../../types/daily';
import AppDialog from '../ui/AppDialog.vue';
import AppPagination from '../ui/AppPagination.vue';
import StatePanel from '../ui/StatePanel.vue';
const props = defineProps<{ modelValue: boolean; wordId: number | null; word: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const { data, loading, error, load } = useResource<Page<WordHistoryEvent>>();
const page = ref(1);
const size = 10;
const labels = { 1: '认识', 2: '模糊', 3: '不认识' };
const groups = computed(() => [
  { label: '本页每日学习事件', events: data.value?.records.filter(event => event.taskType === 'DAILY') || [] },
  { label: '本页专项练习事件', events: data.value?.records.filter(event => event.taskType === 'PRACTICE') || [] },
]);
function refresh() {
  const id = props.wordId;
  if (props.modelValue && id !== null) void load(() => dailyApi.history(id, { page: page.value, size }));
}
watch(() => [props.modelValue, props.wordId] as const, () => { page.value = 1; refresh(); }, { immediate: true });
function changePage(value: number) { page.value = value; refresh(); }
</script>
<template>
  <AppDialog :model-value="modelValue" :title="`${word} · 学习历史`" description="北京时间，按事件时间倒序分页。更正保留原反馈，不作为额外一次作答。" @update:model-value="emit('update:modelValue', $event)">
    <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" message="未查询到已记录的学习事件。旧数据可能缺少事件，不能解释为从未学习。" @retry="refresh" />
    <template v-if="!loading && !error">
      <section v-for="group in groups.filter(entry => entry.events.length)" :key="group.label" class="history-group">
        <h3>{{ group.label }}</h3>
        <article v-for="event in group.events" :key="event.logId" class="history-event">
          <div class="live-actions"><span class="learning-badge">{{ event.eventType === 'CORRECTION' ? '更正事件' : '正常作答' }}</span><strong>{{ labels[event.result] }}</strong><span class="subtle-copy">事件 #{{ event.logId }}</span></div>
          <p>{{ event.answeredAt.replace('T', ' ') }} · 学习日 {{ event.learningDate }}</p>
          <p>本词当日正常作答序号 {{ event.attemptNo }}（含专项） · 批次 #{{ event.batchId }}</p>
          <p v-if="event.eventType === 'CORRECTION'">更正原作答 #{{ event.correctsLogId ?? '未提供' }}，不另计作答次数。</p>
          <p>{{ event.affectsSchedule ? '此事件影响长期安排' : '此事件不影响长期安排' }}</p>
          <details v-if="event.scheduleAvailable && event.scheduleBefore && event.scheduleAfter"><summary>查看事件前后调度快照</summary><span>事件前</span><pre>{{ JSON.stringify(event.scheduleBefore, null, 2) }}</pre><span>事件后</span><pre>{{ JSON.stringify(event.scheduleAfter, null, 2) }}</pre></details>
          <p v-else class="subtle-copy">完整调度快照不可用；专项通常没有快照，不从当前记忆状态推算历史。</p>
        </article>
      </section>
    </template>
    <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="changePage" />
  </AppDialog>
</template>
