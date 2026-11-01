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
import { sentencePracticeApi, type SentencePracticeRecord } from '../../api/sentencePractice';

const route = useRoute();
const mode = ref<'word' | 'sentence'>(route.query.type === 'SENTENCE' ? 'sentence' : 'word');
const sentencePage = ref(1);
const sentenceRecords = useResource<Page<SentencePracticeRecord>>();
const loadSentences = () => sentenceRecords.load(() => sentencePracticeApi.records(undefined, sentencePage.value));
const types: { value: LearningRecordFilter; label: string }[] = [
  { value: 'WORD', label: '全部单词' }, { value: 'DAILY', label: '每日学习' },
  { value: 'DICTATION', label: '单词默写' },
];
const statuses: { value: 'ALL' | LearningRecordStatus; label: string }[] = [
  { value: 'ALL', label: '全部状态' }, { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'COMPLETED', label: '已完成' }, { value: 'INCOMPLETE', label: '未完成' }, { value: 'ABANDONED', label: '已放弃' },
];
const type = ref<LearningRecordFilter>(types.find(entry => entry.value === route.query.type)?.value ?? 'WORD');
const status = ref<'ALL' | LearningRecordStatus>('ALL');
const page = ref(1), size = 20;
const { data, loading, error, load } = useResource<Page<LearningRecord>>();
const refresh = () => load(() => learningRecordsApi.list({ type: type.value, status: status.value, page: page.value, size }));
watch([type, status], () => { if (page.value !== 1) page.value = 1; else void refresh(); });
watch(page, refresh);
watch(sentencePage, loadSentences);
watch(mode, value => { if (value === 'sentence') void loadSentences(); else void refresh(); });
onMounted(() => { if (mode.value === 'sentence') void loadSentences(); else void refresh(); });

const groups = computed(() => {
  const result: { date: string; rows: LearningRecord[] }[] = [];
  for (const row of data.value?.records ?? []) {
    const last = result[result.length - 1];
    if (last?.date === row.recordDate) last.rows.push(row);
    else result.push({ date: row.recordDate, rows: [row] });
  }
  return result;
});
const names: Record<string, string> = { LEARNING_LIST: '句子翻译', BANK: '句子题库练习', REVIEW: '薄弱句子练习', FAVORITES: '收藏句子练习', DUE: '到期句子复习' };
const statusNames: Record<LearningRecordStatus, string> = { IN_PROGRESS: '进行中', COMPLETED: '已完成', INCOMPLETE: '未完成', ABANDONED: '已放弃' };
function name(row: LearningRecord) { return row.type === 'DAILY' ? '每日单词学习' : row.type === 'DICTATION' ? '独立默写' : names[row.source ?? ''] ?? '句子练习'; }
function typeName(row: LearningRecord) { return row.type === 'DAILY' ? '每日学习' : row.type === 'DICTATION' ? '单词默写' : '句子练习'; }
function dateLabel(date: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date); return match ? `${match[1]} 年 ${Number(match[2])} 月 ${Number(match[3])} 日` : date; }
function timeLabel(value: string) { return /[T ](\d{2}:\d{2})/.exec(value)?.[1] ?? '—'; }
function destination(row: LearningRecord): string | null {
  if (row.type === 'DAILY') return row.canContinue ? `/learn/${row.businessId}` : row.rawStatus === 'ABANDONED' ? null : `/records/${row.businessId}`;
  if (row.type === 'DICTATION') return row.canContinue ? `/dictation/${row.businessId}` : `/dictation/${row.businessId}/result`;
  return null;
}
</script>
<template>
  <div class="records-page unified-records">
    <div class="record-modes" role="group" aria-label="记录分类"><button type="button" :class="{ active: mode === 'word' }" :aria-pressed="mode === 'word'" @click="mode = 'word'">单词记录</button><button type="button" :class="{ active: mode === 'sentence' }" :aria-pressed="mode === 'sentence'" @click="mode = 'sentence'">句子翻译</button></div>
    <div v-if="mode === 'word'" class="records-filters">
      <div class="records-types" role="group" aria-label="记录类型"><button v-for="entry in types" :key="entry.value" type="button" :class="{ active: type === entry.value }" :aria-pressed="type === entry.value" @click="type = entry.value">{{ entry.label }}</button></div>
      <div class="records-filter-actions"><AppSelect v-model="status" :options="statuses" label="记录状态" hide-label /><button class="records-refresh" type="button" :disabled="loading" aria-label="刷新记录" title="刷新记录" @click="refresh"><RotateCcw :size="17" aria-hidden="true" /></button></div>
    </div>
    <StatePanel v-if="mode === 'word'" :loading="loading" :error="error" :empty="!!data && data.records.length === 0" message="暂无符合条件的学习记录。" @retry="refresh" />
    <div v-if="mode === 'word' && data && !loading && !error" class="records-groups">
      <section v-for="(group, index) in groups" :key="`${group.date}-${index}`" class="records-date-group" :aria-label="dateLabel(group.date)">
        <h2>{{ dateLabel(group.date) }}</h2>
        <article v-for="row in group.rows" :key="`${row.type}-${row.source}-${row.businessId}`" class="unified-record-row">
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
    <template v-if="mode === 'sentence'">
      <div class="sentence-records-heading"><button class="records-refresh" type="button" :disabled="sentenceRecords.loading.value" aria-label="刷新句子翻译记录" title="刷新记录" @click="loadSentences"><RotateCcw :size="17" aria-hidden="true" /></button></div>
      <StatePanel :loading="sentenceRecords.loading.value" :error="sentenceRecords.error.value" :empty="!!sentenceRecords.data.value && sentenceRecords.data.value.records.length === 0" message="还没有翻译记录，完成句子翻译后会显示在这里。" @retry="loadSentences" />
      <div v-if="sentenceRecords.data.value && !sentenceRecords.loading.value && !sentenceRecords.error.value" class="sentence-record-list">
        <article v-for="entry in sentenceRecords.data.value.records" :key="entry.id" class="sentence-record-row">
          <div class="sentence-record-copy"><strong lang="en">{{ entry.englishText }}</strong><p class="sentence-record-translation"><span>我的翻译：</span>{{ entry.translation }}</p><p class="sentence-record-reference"><span>参考翻译：</span>{{ entry.referenceTranslation }}</p></div>
          <time :datetime="entry.createdAt">{{ entry.createdAt.replace('T', ' ').slice(0, 16) }}</time>
        </article>
      </div>
      <AppPagination v-if="sentenceRecords.data.value && !sentenceRecords.loading.value && !sentenceRecords.error.value" :page="sentencePage" :size="20" :total="sentenceRecords.data.value.total" numbered @change="sentencePage = $event" />
    </template>
    <AppPagination v-if="mode === 'word' && data && !loading && !error" :page="page" :size="size" :total="data.total" :disabled="loading" numbered @change="page = $event" />
  </div>
</template>
<style scoped>
.records-page.unified-records { width: min(calc(100% - var(--s5) * 2), var(--content-library-width)); padding: var(--s6) 0 var(--s12); }
.record-modes { display:flex; gap:32px; border-bottom:1px solid var(--line); margin-bottom:28px; }
.record-modes button { position:relative; border:0; padding:10px 2px 14px; background:transparent; color:var(--muted); font:inherit; cursor:pointer; }
.record-modes button.active { color:var(--ink); font-weight:600; }
.record-modes button.active::after { position:absolute; content:''; left:0; right:0; bottom:-1px; height:2px; background:var(--accent-strong); }
.sentence-records-heading { display:flex; justify-content:flex-end; margin:4px 0 12px; }
.sentence-record-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:28px; padding:24px 0; border-bottom:1px solid var(--line); }
.sentence-record-copy { min-width:0; overflow-wrap:anywhere; }
.sentence-record-copy strong { font:400 23px/1.45 var(--font-serif); }
.sentence-record-copy p { margin:9px 0 0; color:var(--muted); line-height:1.6; white-space:pre-wrap; }
.sentence-record-copy .sentence-record-reference { color:var(--accent-strong); }
.sentence-record-copy p > span { font-size:13px; font-weight:600; }
.sentence-record-row time { color:var(--muted); font-size:13px; white-space:nowrap; }
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
  .sentence-record-row { grid-template-columns:minmax(0,1fr) auto; gap:12px; }
  .sentence-record-copy { grid-column:1 / -1; }
  .sentence-record-copy strong { font-size:20px; }
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
