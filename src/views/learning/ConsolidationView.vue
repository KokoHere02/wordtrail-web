<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue';
import { CheckCheck, Clock3 } from 'lucide-vue-next';
import { consolidationApi, issueReasons, isIssueReason, type Issue, type IssueReason } from '../../api/consolidation';
import { errorMessage } from '../../api/http';
import type { Page } from '../../types/api';
import { dailyModeLabels } from '../../types/dailyTraining';
import AppSelect from '../../components/ui/AppSelect.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
const reason = ref<IssueReason | ''>(''), page = ref(1);
const data = ref<Page<Issue>>(), summary = ref<Awaited<ReturnType<typeof consolidationApi.summary>>>([]);
const loading = ref(false), error = ref('');
let generation = 0;
onScopeDispose(() => { generation++; });
const reasonOptions = [{ value: '', label: '全部原因' }, ...Object.entries(issueReasons).map(([value, label]) => ({ value, label }))];
const reasonSummary = computed(() => summary.value.filter(row => isIssueReason(row.reason)));
async function load(value = page.value) {
  const token = ++generation; loading.value = true; error.value = ''; page.value = value;
  try {
    const [items, counts] = await Promise.all([consolidationApi.issues({ page: value, size: 20, category: 'ERROR', reason: reason.value || undefined }), consolidationApi.summary()]);
    if (token === generation) { data.value = items; summary.value = counts; }
  } catch (e) { if (token === generation) error.value = errorMessage(e); }
  finally { if (token === generation) loading.value = false; }
}
watch(reason, () => { void load(1); });
onMounted(() => { void load(); });
</script>
<template>
  <div class="wordlist-page consolidation-page">
    <div class="consolidation-summary" aria-label="错因概览">
      <div v-for="row in reasonSummary" :key="row.reason"><span>{{ issueReasons[row.reason] }}</span><strong>{{ row.wordCount }}<small>词</small></strong></div>
    </div>
    <section id="consolidation-list" class="consolidation-list issue-sheet" aria-label="待巩固清单">
      <div class="consolidation-list-toolbar">
        <div><h2>待巩固词项</h2><span v-if="data && !loading && !error">{{ data.total }} 条记录</span></div>
        <AppSelect v-model="reason" :options="reasonOptions" label="筛选原因" hide-label class="consolidation-reason-select" />
      </div>
      <StatePanel :loading="loading" :error="error" @retry="load()" />
      <section v-if="data && !loading && !error" class="issue-rows" aria-label="巩固词项">
        <div v-if="!data.records.length" class="consolidation-empty"><CheckCheck :size="30" :stroke-width="1.4" aria-hidden="true" /><p>这个分类暂无待巩固记录</p></div>
        <article v-for="row in data.records" :key="`${row.wordId}:${row.reason}`" class="consolidation-issue">
          <header><strong class="issue-word" lang="en">{{ row.word }}</strong><span class="consolidation-reason-tag">{{ issueReasons[row.reason] }}</span></header>
          <div class="consolidation-word-details"><WordMeaning :translation="row.translation" :translation-groups="row.translationGroups" /><p v-if="row.lastInput !== null" class="consolidation-last-input"><span>最近输入</span><span lang="en">{{ row.lastInput || '（空）' }}</span></p><footer class="consolidation-issue-meta"><span>{{ dailyModeLabels[row.mode] }}</span><time><Clock3 :size="13" aria-hidden="true" />{{ row.lastOccurredAt.replace('T', ' ') }}</time><span class="consolidation-occurrences">发生 {{ row.occurrenceCount }} 次</span></footer></div>
        </article>
        <AppPagination :page="data.page" :size="data.size" :total="data.total" :disabled="loading" @change="load" />
      </section>
    </section>
  </div>
</template>
<style scoped>
.wordlist-page.consolidation-page { width: min(calc(100% - var(--s5) * 2), var(--content-library-width)); padding-block: var(--s6) var(--s12); }
.consolidation-summary { margin-bottom: var(--s5); }
.consolidation-summary > div { flex-direction: row; align-items: center; justify-content: space-between; gap: var(--s3); padding: var(--s4) var(--s5); }
.consolidation-summary strong { font-size: 24px; }
.issue-sheet { overflow: visible; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
.consolidation-list-toolbar { padding: var(--s5) var(--s5) var(--s3); margin: 0; }
.issue-selection-bar { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s3); padding: var(--s3) var(--s5) var(--s4); border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent; }
.issue-selection-bar fieldset { display: block; flex: 1 1 220px; }
.consolidation-selection { justify-content: flex-start; gap: var(--s4); padding: 0; border: 0; background: transparent; }
.issue-selection-bar > .btn { width: auto; min-height: 40px; }
.issue-selection-bar > .inline-error { flex-basis: 100%; }
.consolidation-list > .issue-rows { border: 0; border-radius: 0; background: transparent; }
.consolidation-issue:first-child { border-radius: 0; }
.consolidation-issue { padding: var(--s4) var(--s5); }
.issue-word { font: 400 22px/1.4 var(--font-serif); overflow-wrap: anywhere; }
.consolidation-word-details { margin-left: 0; }
.consolidation-word-details > .word-meaning { margin-block: var(--s1) var(--s2); }
.consolidation-last-input { margin-block: var(--s2); }
@media (max-width: 680px) {
  .consolidation-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .issue-selection-bar { align-items: stretch; }
  .issue-selection-bar > .btn { width: 100%; }
}
</style>
