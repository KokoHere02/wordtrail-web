<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowRight, RotateCcw } from 'lucide-vue-next';
import { learningRecordsApi } from '../../api/learningRecords';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { LearningRecord, LearningRecordFilter, LearningRecordStatus } from '../../types/learningRecords';
import AppSelect from '../../components/ui/AppSelect.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';

const route = useRoute();
const types: { value: LearningRecordFilter; label: string }[] = [
  { value: 'ALL', label: '全部' }, { value: 'DAILY', label: '每日学习' },
  { value: 'DICTATION', label: '单词默写' }, { value: 'SENTENCE', label: '句子练习' },
];
const statuses: { value: 'ALL' | LearningRecordStatus; label: string }[] = [
  { value: 'ALL', label: '全部状态' }, { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'COMPLETED', label: '已完成' }, { value: 'INCOMPLETE', label: '未完成' }, { value: 'ABANDONED', label: '已放弃' },
];
const type = ref<LearningRecordFilter>(types.find(entry => entry.value === route.query.type)?.value ?? 'ALL');
const status = ref<'ALL' | LearningRecordStatus>('ALL');
const page = ref(1), size = 20;
const { data, loading, error, load } = useResource<Page<LearningRecord>>();
const refresh = () => load(() => learningRecordsApi.list({ type: type.value, status: status.value, page: page.value, size }));
watch([type, status], () => { if (page.value !== 1) page.value = 1; else void refresh(); });
watch(page, refresh);
onMounted(refresh);

const groups = computed(() => {
  const result: { date: string; rows: LearningRecord[] }[] = [];
  for (const row of data.value?.records ?? []) {
    const last = result[result.length - 1];
    if (last?.date === row.recordDate) last.rows.push(row);
    else result.push({ date: row.recordDate, rows: [row] });
  }
  return result;
});
const names: Record<string, string> = { BANK: '句子题库练习', REVIEW: '薄弱句子练习', FAVORITES: '收藏句子练习', DUE: '到期句子复习' };
const statusNames: Record<LearningRecordStatus, string> = { IN_PROGRESS: '进行中', COMPLETED: '已完成', INCOMPLETE: '未完成', ABANDONED: '已放弃' };
function name(row: LearningRecord) { return row.type === 'DAILY' ? '每日单词学习' : row.type === 'DICTATION' ? '独立默写' : names[row.source ?? ''] ?? '句子练习'; }
function typeName(row: LearningRecord) { return row.type === 'DAILY' ? '每日学习' : row.type === 'DICTATION' ? '单词默写' : '句子练习'; }
function dateLabel(date: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date); return match ? `${match[1]} 年 ${Number(match[2])} 月 ${Number(match[3])} 日` : date; }
function timeLabel(value: string) { return /[T ](\d{2}:\d{2})/.exec(value)?.[1] ?? '—'; }
function destination(row: LearningRecord): string | null {
  if (row.type === 'DAILY') return row.canContinue ? `/learn/${row.businessId}` : row.rawStatus === 'ABANDONED' ? null : `/records/${row.businessId}`;
  if (row.type === 'DICTATION') return row.canContinue ? `/dictation/${row.businessId}` : `/dictation/${row.businessId}/result`;
  if (row.canContinue) return `/sentences/sessions/${row.businessId}`;
  return row.rawStatus === 'COMPLETED' ? `/sentences/sessions/${row.businessId}/result` : null;
}
</script>
<template>
  <div class="records-page unified-records">
    <div class="records-filters">
      <div class="records-types" role="group" aria-label="记录类型"><button v-for="entry in types" :key="entry.value" type="button" :class="{ active: type === entry.value }" :aria-pressed="type === entry.value" @click="type = entry.value">{{ entry.label }}</button></div>
      <div class="records-filter-actions"><AppSelect v-model="status" :options="statuses" label="记录状态" hide-label /><button class="records-refresh" type="button" :disabled="loading" aria-label="刷新记录" title="刷新记录" @click="refresh"><RotateCcw :size="17" aria-hidden="true" /></button></div>
    </div>
    <StatePanel :loading="loading" :error="error" :empty="!!data && data.records.length === 0" message="暂无符合条件的学习记录。" @retry="refresh" />
    <div v-if="data && !loading && !error" class="records-groups">
      <section v-for="(group, index) in groups" :key="`${group.date}-${index}`" class="records-date-group" :aria-label="dateLabel(group.date)">
        <h2>{{ dateLabel(group.date) }}</h2>
        <article v-for="row in group.rows" :key="`${row.type}-${row.businessId}`" class="unified-record-row">
          <span class="record-type">{{ typeName(row) }}</span>
          <div class="record-name"><strong>{{ name(row) }}</strong><p v-if="row.type === 'DAILY' && row.newCount !== null && row.reviewCount !== null">新词 {{ row.newCount }} 词 · 复习 {{ row.reviewCount }} 词</p></div>
          <time class="record-time" :datetime="row.createdAt">{{ timeLabel(row.createdAt) }}</time>
          <span class="record-progress">{{ row.completedCount }} / {{ row.totalCount }} {{ row.type === 'SENTENCE' ? '句' : '词' }}</span>
          <span :class="['record-status', `status-${row.displayStatus.toLowerCase()}`]"><i aria-hidden="true" />{{ statusNames[row.displayStatus] }}</span>
          <RouterLink v-if="destination(row)" :to="destination(row)!" class="record-action">{{ row.canContinue ? '继续练习' : '查看详情' }} <ArrowRight :size="17" aria-hidden="true" /></RouterLink>
          <span v-else class="record-unavailable">{{ row.rawStatus === 'ABANDONED' ? '已放弃' : '暂无详情' }}</span>
        </article>
      </section>
    </div>
    <AppPagination v-if="data && !loading && !error" :page="page" :size="size" :total="data.total" :disabled="loading" numbered @change="page = $event" />
  </div>
</template>
<style scoped>
.records-page.unified-records { width: min(calc(100% - var(--s5) * 2), var(--content-library-width)); padding: var(--s6) 0 var(--s12); }
.records-filters { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--s4); }
.records-types, .records-filter-actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s2); }
.records-types button { min-height: var(--control); padding: var(--s2) var(--s5); border: 1px solid var(--line); border-radius: var(--radius-pill); background: var(--surface); color: var(--control-text); white-space: nowrap; }
.records-types button.active { color: var(--surface); background: var(--accent-strong); border-color: var(--accent-strong); }
.records-filter-actions :deep(.app-select) { min-width: 150px; }
.records-refresh { display: grid; place-items: center; width: var(--control); height: var(--control); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); color: var(--muted); }
.records-groups { margin-top: var(--s8); }
.records-date-group + .records-date-group { margin-top: var(--s8); }
.records-date-group h2 { padding-bottom: var(--s3); border-bottom: 1px solid var(--line); font-size: var(--text-lg); font-weight: 500; }
.unified-record-row { display: grid; grid-template-columns: 110px minmax(180px, 1fr) 90px 120px 110px 115px; align-items: center; gap: var(--s4); min-height: 80px; padding: var(--s4) var(--s2); border-bottom: 1px solid var(--line); }
.record-type, .record-action { color: var(--accent-strong); }
.record-name { min-width: 0; overflow-wrap: anywhere; }
.record-name strong { font-size: var(--text-base); font-weight: 500; }
.record-name p { margin: var(--s1) 0 0; color: var(--muted); font-size: var(--text-sm); }
.record-time, .record-progress { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.record-status { display: inline-flex; align-items: center; gap: var(--s2); white-space: nowrap; color: var(--muted); }
.record-status i { width: 9px; height: 9px; flex: none; border-radius: 50%; background: var(--muted); }
.record-status.status-in_progress i { background: #73aeee; }
.record-status.status-completed i { background: #69bd88; }
.record-status.status-incomplete i, .record-status.status-abandoned i { background: var(--error); }
.record-action { display: inline-flex; align-items: center; justify-content: flex-end; gap: var(--s2); white-space: nowrap; }
.record-action:hover { color: var(--accent); }
.record-unavailable { color: var(--muted); text-align: right; font-size: var(--text-sm); }
.unified-records :deep(.pagination) { margin-top: var(--s5); }
@media (max-width: 760px) {
  .records-filters { align-items: stretch; }
  .records-types { width: 100%; }
  .records-types button { padding-inline: var(--s3); font-size: var(--text-sm); }
  .records-filter-actions { width: 100%; justify-content: flex-end; }
  .unified-record-row { grid-template-columns: minmax(0, 1fr) auto; gap: var(--s2) var(--s3); padding: var(--s4) var(--s1); }
  .record-type { grid-column: 1; font-size: var(--text-sm); }
  .record-name { grid-column: 1; }
  .record-time { grid-column: 2; grid-row: 1; text-align: right; }
  .record-progress { grid-column: 1; font-size: var(--text-sm); }
  .record-status { grid-column: 1; font-size: var(--text-sm); }
  .record-action, .record-unavailable { grid-column: 2; grid-row: 3 / span 2; align-self: end; font-size: var(--text-sm); }
}
</style>
