<script setup lang="ts">
import { ref, watch } from 'vue';
import { Plus, Search } from 'lucide-vue-next';
import { usePlan } from '../../composables/usePlan';
import type { PlanWord, PlanStatus, PlanLearningStatus } from '../../types/daily';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppDialog from '../../components/ui/AppDialog.vue';
import PlanWordRow from '../../components/learning/PlanWordRow.vue';
import WordHistoryDialog from '../../components/learning/WordHistoryDialog.vue';
const plan = usePlan();
const { data, loading, error, totals, totalsError, selected, count, status, learningStatus, keyword, sortOptions, sort, page, size, busy, saveError, notice, pageIds, pageSelected } = plan;
const statuses: { value: PlanStatus; label: string }[] = [{ value: 'ACTIVE', label: '学习中' }, { value: 'PAUSED', label: '已暂停' }, { value: 'REMOVED', label: '已移出' }];
const learningStatuses: { value: PlanLearningStatus; label: string }[] = [{ value: 'ALL', label: '全部单词' }, { value: 'DUE', label: '待复习' }, { value: 'NEW', label: '新加入' }, { value: 'LEARNED', label: '已开始' }];
const historyWord = ref<PlanWord>();
const historyOpen = ref(false);
const expandedId = ref<number>();
const confirmOpen = ref(false);
const removeIds = ref<number[]>([]);
const removeBulk = ref(false);
watch(data, value => { if (!value?.records.some(word => word.wordId === expandedId.value)) expandedId.value = value?.records[0]?.wordId; });
function askRemove(ids: number[], bulk = false) { removeIds.value = ids; removeBulk.value = bulk; confirmOpen.value = true; }
async function remove() { if (await plan.change(removeIds.value, 'REMOVED', removeBulk.value)) confirmOpen.value = false; }
function history(word: PlanWord) { historyWord.value = word; historyOpen.value = true; }
</script>
<template>
  <div class="plan-page">
    <header class="content-page-actions" aria-label="学习计划操作"><RouterLink to="/books" class="btn btn-primary"><Plus :size="20" />添加单词</RouterLink></header>
    <section class="plan-sheet" aria-label="学习计划单词">
      <div class="plan-topbar"><div class="plan-status-tabs" role="group" aria-label="计划状态"><button v-for="entry in statuses" :key="entry.value" :class="{ active: status === entry.value }" :aria-pressed="status === entry.value" :aria-label="entry.label" :disabled="busy" @click="status = entry.value"><span>{{ entry.label }}</span><span class="plan-tab-count">{{ totals?.[entry.value] ?? '—' }}</span></button></div><form class="plan-search" role="search" @submit.prevent="plan.search"><Search :size="19" /><input v-model="keyword" type="search" maxlength="255" placeholder="搜索英文前缀" aria-label="搜索计划单词" :disabled="busy" /><button type="submit" aria-label="搜索计划" :disabled="busy">搜索</button></form></div>
      <div class="plan-filterbar"><div class="plan-learning-tabs" role="group" aria-label="学习状态"><button v-for="entry in learningStatuses" :key="entry.value" :class="{ active: learningStatus === entry.value }" :aria-pressed="learningStatus === entry.value" :disabled="busy" @click="learningStatus = entry.value">{{ entry.label }}</button></div><label class="plan-sort"><span class="sr-only">排序</span><select v-model="sort" aria-label="计划排序" :disabled="busy"><option v-for="entry in sortOptions" :key="entry.value" :value="entry.value">{{ entry.label }}</option></select></label></div>
      <div v-if="count && status !== 'REMOVED'" class="plan-bulkbar" role="status"><span>已选 {{ count }} 词</span><button class="muted-link" :disabled="busy" @click="plan.clear">清空选择</button><div class="live-actions"><button v-if="status === 'ACTIVE'" class="violet-link" :disabled="busy || count > 100" @click="plan.change([...selected], 'PAUSED', true)">批量暂停</button><button v-if="status === 'PAUSED'" class="violet-link" :disabled="busy || count > 100" @click="plan.change([...selected], 'ACTIVE', true)">批量恢复</button><button class="muted-link" :disabled="busy || count > 100" @click="askRemove([...selected], true)">批量移出</button></div></div>
      <p v-if="count > 100" class="inline-error plan-message" role="alert">每批最多操作 100 词，请减少选择。</p>
      <div class="plan-table" role="table" aria-label="计划词表"><div class="plan-table-header" role="row"><div class="plan-check-cell" role="columnheader"><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pageIds.some(id => selected.has(id))" :disabled="status === 'REMOVED' || busy || loading || !pageIds.length" aria-label="选择当前页计划单词" title="选择当前页" @change="plan.togglePage(pageIds, !pageSelected)" /></div><span role="columnheader">单词 / 释义</span><span role="columnheader">复习进度</span><span role="columnheader">下次复习</span><span class="plan-operation-heading" role="columnheader">操作</span></div>
        <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" message="这里还没有符合条件的计划单词。" @retry="plan.refresh" />
        <template v-if="!loading && !error"><PlanWordRow v-for="word in data?.records" :key="word.wordId" :word="word" :selected="selected.has(word.wordId)" :expanded="expandedId === word.wordId" :busy="busy" @select="plan.toggle(word.wordId, $event)" @expand="expandedId = expandedId === word.wordId ? undefined : word.wordId" @history="history(word)" @change="(id, target) => plan.change([id], target)" @remove="askRemove([word.wordId])" /></template>
      </div>
      <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading || busy" numbered noun="个单词" @change="page = $event" />
    </section>
    <p v-if="status === 'REMOVED'" class="subtle-copy plan-selection-help">请从词书重新加入，不能在这里直接恢复。</p>
    <p v-if="totalsError" class="subtle-copy plan-count-error" role="status">分类数量暂未同步。<button class="muted-link" @click="plan.refreshSummary">重新同步</button></p>
    <p v-if="notice" class="live-notice" role="status">{{ notice }}</p><p v-if="saveError" class="inline-error" role="alert">{{ saveError }}</p>
    <AppDialog v-model="confirmOpen" title="移出学习计划？" :description="`移出 ${removeIds.length} 词，并跳过今日安排。历史保留，之后可从词书重新加入。`"><p v-if="saveError" class="inline-error" role="alert">{{ saveError }}</p><button class="btn btn-primary dialog-confirm" :disabled="busy" @click="remove">{{ busy ? '正在移出…' : '确认移出' }}</button></AppDialog>
    <WordHistoryDialog v-model="historyOpen" :word-id="historyWord?.wordId ?? null" :word="historyWord?.word || ''" />
  </div>
</template>
