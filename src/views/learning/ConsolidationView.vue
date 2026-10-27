<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, ArrowRight, CheckCheck, Clock3, Layers3, ListFilter, Target } from 'lucide-vue-next';
import { consolidationApi, issueReasons, isIssueFilter, isIssueReason, type Issue, type IssueReason, type CreateConsolidation } from '../../api/consolidation';
import { ApiError, errorMessage } from '../../api/http';
import { useAuthStore } from '../../stores/auth';
import type { Page, Status } from '../../types/api';
import { dailyModeLabels, type DailyStudyMode, type TrainingTask } from '../../types/dailyTraining';
import AppButton from '../../components/ui/AppButton.vue';
import AppSelect from '../../components/ui/AppSelect.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
const router = useRouter(), userId = useAuthStore().user!.id;
const reason = ref<IssueReason | ''>(''), page = ref(1);
const data = ref<Page<Issue>>(), summary = ref<Awaited<ReturnType<typeof consolidationApi.summary>>>([]);
const selected = ref<number[]>([]), count = ref(20), mode = ref<DailyStudyMode>('DICTATION');
const loading = ref(false), error = ref(''), creating = ref(false), createError = ref('');
const pending = ref<CreateConsolidation>(), created = ref<number>();
const batches = ref<Page<TrainingTask>>(), batchStatus = ref<Status>('IN_PROGRESS'), batchPage = ref(1), batchLoading = ref(false), batchError = ref('');
const key = `wordtrail.consolidation.create.${userId}`;
let generation = 0, batchGeneration = 0, alive = true;
onScopeDispose(() => { alive = false; generation++; batchGeneration++; });
const reasonOptions = [{ value: '', label: '全部原因' }, ...Object.entries(issueReasons).map(([value, label]) => ({ value, label }))];
const reasonSummary = computed(() => summary.value.filter(row => isIssueReason(row.reason)));
const modeOptions = Object.entries(dailyModeLabels).map(([value, label]) => ({ value, label }));
const batchOptions = [{ value: 'IN_PROGRESS', label: '进行中' }, { value: 'COMPLETED', label: '已完成' }];
const locked = computed(() => creating.value || !!pending.value || !!created.value);
function choose(wordId: number, checked: boolean) { selected.value = checked ? [...new Set([...selected.value, wordId])] : selected.value.filter(id => id !== wordId); }
async function load(value = page.value) {
  const token = ++generation; loading.value = true; error.value = ''; page.value = value;
  try {
    const [items, counts] = await Promise.all([consolidationApi.issues({ page: value, size: 20, category: 'ERROR', reason: reason.value || undefined }), consolidationApi.summary()]);
    if (token === generation) { data.value = items; summary.value = counts; }
  } catch (e) { if (token === generation) error.value = errorMessage(e); }
  finally { if (token === generation) loading.value = false; }
}
async function loadBatches(value = batchPage.value) {
  const token = ++batchGeneration; batchPage.value = value; batchLoading.value = true; batchError.value = '';
  try { const result = await consolidationApi.batches({ page: value, size: 10, status: batchStatus.value }); if (token === batchGeneration) batches.value = result; }
  catch (e) { if (token === batchGeneration) batchError.value = errorMessage(e); }
  finally { if (token === batchGeneration) batchLoading.value = false; }
}
async function create() {
  if (creating.value) return;
  if (created.value) { await router.push(`/consolidation/batches/${created.value}`); return; }
  createError.value = '';
  if (!pending.value) {
    if (selected.value.length > 100 || (!selected.value.length && (!Number.isInteger(count.value) || count.value < 1 || count.value > 100))) { createError.value = '每轮可选择 1～100 个词。'; return; }
    const body: CreateConsolidation = { requestId: crypto.randomUUID(), mode: mode.value, category: 'ERROR', ...(reason.value ? { reason: reason.value } : {}), ...(selected.value.length ? { wordIds: [...selected.value] } : { count: count.value }) };
    try { sessionStorage.setItem(key, JSON.stringify(body)); pending.value = body; }
    catch { createError.value = '无法保存重试凭据，请允许会话存储后重试。'; return; }
  }
  creating.value = true;
  try {
    const result = await consolidationApi.create(pending.value!);
    if (!alive) return;
    created.value = result.batchId; sessionStorage.removeItem(key); pending.value = undefined;
    await router.push(`/consolidation/batches/${result.batchId}`);
  } catch (e) {
    if (!alive) return;
    const definitive = e instanceof ApiError && !['NETWORK_ERROR', 'TRAINING_DEPLOYMENT_REQUIRED', 'IDENTITY_CHANGED'].includes(e.code) && (e.status === undefined || e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status));
    if (definitive) { pending.value = undefined; sessionStorage.removeItem(key); }
    createError.value = pending.value ? '创建结果尚未确认，请重试原请求。原筛选、方式与选词已保留。' : errorMessage(e);
  } finally { if (alive) creating.value = false; }
}
watch(reason, () => { if (!pending.value) selected.value = []; void load(1); });
watch(batchStatus, () => { void loadBatches(1); });
onMounted(() => {
  const saved = sessionStorage.getItem(key);
  if (saved) {
    try {
      const body = JSON.parse(saved) as CreateConsolidation;
      if (!isIssueFilter(body)) {
        // Keep the old receipt intact; never rewrite its body/requestId or resend a retired filter.
        createError.value = '旧筛选已停用，请在巩固批次中核对并恢复已有练习。';
      } else {
        if (!body.requestId || !dailyModeLabels[body.mode] || (!!body.wordIds === (body.count !== undefined))) throw new Error();
        pending.value = body; reason.value = body.reason || ''; mode.value = body.mode;
        selected.value = body.wordIds ? [...body.wordIds] : []; count.value = body.count ?? 20;
        createError.value = '有一次创建结果尚未确认，请重试原请求。';
      }
    } catch { createError.value = '创建凭据无法读取，请先核对下方批次记录。'; }
  }
  void load(); void loadBatches();
});
</script>
<template>
  <div class="wordlist-page consolidation-page">
    <div class="consolidation-topbar">
      <span class="consolidation-section-label"><ListFilter :size="17" aria-hidden="true" />错因清单</span>
      <RouterLink to="/learn" class="consolidation-back"><ArrowLeft :size="16" aria-hidden="true" /><span>返回学习</span></RouterLink>
    </div>

    <div class="consolidation-layout">
      <section id="consolidation-list" class="consolidation-list" aria-label="待巩固清单">
        <div class="consolidation-summary">
          <div v-for="row in reasonSummary" :key="row.reason"><span>{{ issueReasons[row.reason] }}</span><strong>{{ row.wordCount }}<small>词</small></strong></div>
        </div>
        <div class="consolidation-list-toolbar">
          <div><h2>待巩固词项</h2><span v-if="data && !loading && !error">{{ data.total }} 条记录</span></div>
          <AppSelect v-model="reason" :options="reasonOptions" label="筛选原因" hide-label :disabled="locked" class="consolidation-reason-select" />
        </div>
        <StatePanel :loading="loading" :error="error" @retry="load()" />
        <section v-if="data && !loading && !error" aria-label="巩固词项">
          <div v-if="!data.records.length" class="consolidation-empty"><CheckCheck :size="30" :stroke-width="1.4" aria-hidden="true" /><p>这个分类暂无待巩固记录</p></div>
          <article v-for="row in data.records" :key="`${row.wordId}:${row.reason}`" :class="['consolidation-issue', { 'is-selected': selected.includes(row.wordId) }]">
            <header>
              <label class="consolidation-word-choice"><input type="checkbox" :aria-label="`选择 ${row.word}`" :checked="selected.includes(row.wordId)" :disabled="locked || (!selected.includes(row.wordId) && selected.length >= 100)" @change="choose(row.wordId, ($event.target as HTMLInputElement).checked)" /><strong lang="en">{{ row.word }}</strong></label>
              <span class="consolidation-reason-tag">{{ issueReasons[row.reason] }}</span>
            </header>
            <div class="consolidation-word-details">
              <WordMeaning :translation="row.translation" :translation-groups="row.translationGroups" />
              <p v-if="row.lastInput !== null" class="consolidation-last-input"><span>最近输入</span><span lang="en">{{ row.lastInput || '（空）' }}</span></p>
              <footer class="consolidation-issue-meta"><span>{{ dailyModeLabels[row.mode] }}</span><time><Clock3 :size="13" aria-hidden="true" />{{ row.lastOccurredAt.replace('T', ' ') }}</time><span class="consolidation-occurrences">发生 {{ row.occurrenceCount }} 次</span></footer>
            </div>
          </article>
          <AppPagination :page="data.page" :size="data.size" :total="data.total" :disabled="loading || locked" @change="load" />
        </section>
      </section>

      <aside class="consolidation-sidebar" aria-label="巩固练习">
        <form class="consolidation-controls" @submit.prevent="create">
          <header class="consolidation-panel-heading"><span class="consolidation-panel-icon"><Target :size="19" :stroke-width="1.7" aria-hidden="true" /></span><h2>开始巩固</h2></header>
          <fieldset :disabled="locked">
            <AppSelect v-model="mode" :options="modeOptions" label="练习方式" :disabled="locked" />
            <label v-if="!selected.length" class="consolidation-count-label">本轮词数<div class="consolidation-count-input"><input v-model.number="count" type="number" min="1" max="100" aria-label="本轮词数" /><span>词</span></div></label>
            <div v-else class="consolidation-selection"><p>已选 <strong>{{ selected.length }}</strong> 个不同单词</p><button type="button" class="muted-link" @click="selected = []">清空选择</button></div>
          </fieldset>
          <AppButton type="submit" :busy="creating" :disabled="loading && !pending && !created">{{ created ? '进入已创建批次' : pending ? '重试原创建请求' : selected.length ? '巩固所选单词' : '按原因开始巩固' }}<ArrowRight v-if="!creating" :size="17" aria-hidden="true" /></AppButton>
          <p class="consolidation-practice-note">独立练习 · 不计入每日目标</p>
          <p v-if="createError" class="inline-error" role="alert">{{ createError }}</p>
          <RouterLink v-if="created" :to="`/consolidation/batches/${created}`" class="muted-link">进入已创建的巩固批次 #{{ created }}</RouterLink>
        </form>

        <section class="consolidation-batches" aria-label="巩固批次">
          <header class="consolidation-batches-heading"><h2><Layers3 :size="17" aria-hidden="true" />巩固批次</h2><AppSelect v-model="batchStatus" :options="batchOptions" label="批次状态" hide-label /></header>
          <StatePanel :loading="batchLoading" :error="batchError" @retry="loadBatches()" />
          <template v-if="batches && !batchLoading && !batchError">
            <p v-if="!batches.records.length" class="consolidation-batches-empty">暂无{{ batchStatus === 'IN_PROGRESS' ? '进行中' : '已完成' }}的练习</p>
            <RouterLink v-for="batch in batches.records" :key="batch.batchId" :to="`/consolidation/batches/${batch.batchId}`" class="consolidation-batch-link">
              <div class="consolidation-batch-title"><strong>{{ batch.studyMode ? dailyModeLabels[batch.studyMode] : '单词巩固' }}</strong><span>#{{ batch.batchId }}</span></div>
              <div class="consolidation-batch-progress"><span>{{ batch.completedCount }} / {{ batch.totalCount }} 词</span><span>{{ batchStatus === 'IN_PROGRESS' ? '继续练习' : '查看词项' }}<ArrowRight :size="14" aria-hidden="true" /></span></div>
              <div class="consolidation-batch-track" aria-hidden="true"><span :style="{ width: `${batch.totalCount ? Math.min(100, batch.completedCount / batch.totalCount * 100) : 0}%` }" /></div>
            </RouterLink>
            <AppPagination v-if="batches.total > batches.size" :page="batches.page" :size="batches.size" :total="batches.total" :disabled="batchLoading" @change="loadBatches" />
          </template>
        </section>
      </aside>
    </div>
  </div>
</template>
