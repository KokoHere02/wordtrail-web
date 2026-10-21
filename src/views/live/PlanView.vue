<script setup lang="ts">
import { ref } from 'vue';
import { ArrowRight, Search } from 'lucide-vue-next';
import { usePlan } from '../../composables/usePlan';
import type { PlanWord, PlanStatus, PlanLearningStatus } from '../../types/daily';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppDialog from '../../components/ui/AppDialog.vue';
import WordHistoryDialog from '../../components/learning/WordHistoryDialog.vue';
const plan = usePlan();
const { data, loading, error, selected, count, status, learningStatus, keyword, sortOptions, sort, page, size, busy, saveError, notice, pageIds, pageSelected } = plan;
const statuses: { value: PlanStatus; label: string }[] = [{ value: 'ACTIVE', label: '启用中' }, { value: 'PAUSED', label: '已暂停' }, { value: 'REMOVED', label: '已移出' }];
const learningStatuses: { value: PlanLearningStatus; label: string }[] = [{ value: 'ALL', label: '全部' }, { value: 'NEW', label: '未学' }, { value: 'LEARNED', label: '已学' }, { value: 'DUE', label: '到期' }];
const historyWord = ref<PlanWord>();
const historyOpen = ref(false);
const confirmOpen = ref(false);
const removeIds = ref<number[]>([]);
const removeBulk = ref(false);
function askRemove(ids: number[], bulk = false) { removeIds.value = ids; removeBulk.value = bulk; confirmOpen.value = true; }
async function remove() { if (await plan.change(removeIds.value, 'REMOVED', removeBulk.value)) confirmOpen.value = false; }
function history(word: PlanWord) { historyWord.value = word; historyOpen.value = true; }
</script>
<template>
  <div class="wordlist-page">
    <header class="library-heading"><div><h1>学习计划</h1></div><RouterLink to="/books" class="btn btn-primary">去词库选词<ArrowRight :size="18" /></RouterLink></header>
    <section class="wordlist-sheet">
      <div class="wordlist-tools"><div class="category-tabs" role="group" aria-label="计划状态"><button v-for="entry in statuses" :key="entry.value" :class="{ active: status === entry.value }" :aria-pressed="status === entry.value" :disabled="busy" @click="status = entry.value">{{ entry.label }}</button></div><form class="library-search" role="search" @submit.prevent="plan.search"><Search :size="19" /><input v-model="keyword" type="search" maxlength="255" placeholder="英文前缀搜索" aria-label="搜索计划单词" :disabled="busy" /><button class="violet-link" type="submit" :disabled="busy">搜索</button></form></div>
      <div class="plan-filters"><label class="live-filter">学习状态<select v-model="learningStatus" :disabled="busy"><option v-for="entry in learningStatuses" :key="entry.value" :value="entry.value">{{ entry.label }}</option></select></label><label class="live-filter">排序<select v-model="sort" :disabled="busy"><option v-for="entry in sortOptions" :key="entry.value" :value="entry.value">{{ entry.label }}</option></select></label></div>
      <div v-if="status !== 'REMOVED'" class="wordlist-selection plan-selection"><label><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pageIds.some(id => selected.has(id))" :disabled="busy || loading || !pageIds.length" @change="plan.togglePage(pageIds, !pageSelected)" />选择当前页</label><span>已选 {{ count }} 词</span><button class="muted-link" :disabled="busy || !count" @click="plan.clear">清空选择</button><div class="live-actions"><button v-if="status === 'ACTIVE'" class="violet-link" :disabled="busy || !count || count > 100" @click="plan.change([...selected], 'PAUSED', true)">批量暂停</button><button v-if="status === 'PAUSED'" class="violet-link" :disabled="busy || !count || count > 100" @click="plan.change([...selected], 'ACTIVE', true)">批量恢复</button><button class="muted-link" :disabled="busy || !count || count > 100" @click="askRemove([...selected], true)">批量移出</button></div></div>
      <p class="subtle-copy plan-selection-help">{{ status === 'REMOVED' ? '请从词书重新加入，不能在这里直接恢复。' : '跨页保留 · 切换状态清空 · 每批最多 100 词' }}</p>
      <p v-if="count > 100" class="inline-error" role="alert">已选超过 100 词，请减少选择后再提交。</p>
      <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" message="这里还没有符合条件的计划单词。" @retry="plan.refresh" />
      <template v-if="!loading && !error"><article v-for="word in data?.records" :key="word.wordId" class="live-plan-row"><div class="plan-word-copy"><input v-if="status !== 'REMOVED'" type="checkbox" :checked="selected.has(word.wordId)" :disabled="busy" :aria-label="`选择计划单词 ${word.word}`" @change="plan.toggle(word.wordId, !selected.has(word.wordId))" /><div><strong lang="en">{{ word.word }}</strong><small>{{ word.phonetic }}</small><p>{{ word.translation || '暂无释义' }}</p></div></div><div class="live-plan-schedule"><span>{{ word.firstLearnedAt ? `复习等级 ${word.reviewLevel}` : '尚未开始' }}</span><small>{{ word.nextReviewAt ? `下次复习 ${word.nextReviewAt.replace('T', ' ')}（北京时间）` : '等待学习安排' }}</small></div><div class="live-actions"><button v-if="status !== 'REMOVED'" class="violet-link" :disabled="busy" @click="plan.change([word.wordId], status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')">{{ status === 'ACTIVE' ? '暂停' : '重新启用' }}</button><button v-if="status !== 'REMOVED'" class="muted-link" :disabled="busy" @click="askRemove([word.wordId])">移出</button><button class="muted-link" @click="history(word)">学习历史</button></div></article></template>
      <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading || busy" @change="page = $event" />
    </section>
    <p v-if="notice" class="live-notice" role="status">{{ notice }}</p><p v-if="saveError" class="inline-error" role="alert">{{ saveError }}</p>
    <div class="wordlist-bottom"><RouterLink to="/learn" class="btn btn-primary">进入今日学习<ArrowRight :size="18" /></RouterLink></div>
    <AppDialog v-model="confirmOpen" title="移出学习计划？" :description="`移出 ${removeIds.length} 词，并跳过今日安排。历史保留，之后可从词书重新加入。`"><p v-if="saveError" class="inline-error" role="alert">{{ saveError }}</p><button class="btn btn-primary dialog-confirm" :disabled="busy" @click="remove">{{ busy ? '正在移出…' : '确认移出' }}</button></AppDialog>
    <WordHistoryDialog v-model="historyOpen" :word-id="historyWord?.wordId ?? null" :word="historyWord?.word || ''" />
  </div>
</template>
