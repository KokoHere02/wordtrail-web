<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowRight, Search, X } from 'lucide-vue-next';
import { useRoute, useRouter } from 'vue-router';
import { dailyApi } from '../../api/daily';
import { useResource } from '../../composables/useResource';
import { useSelection } from '../../composables/useSelection';
import { useDictationLaunch } from '../../composables/useDictationLaunch';
import type { Page } from '../../types/api';
import type { PlanWord } from '../../types/daily';
import AppPagination from '../../components/ui/AppPagination.vue';
import AppButton from '../../components/ui/AppButton.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import SearchField from '../../components/ui/SearchField.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
import DictationTasks from '../../components/learning/DictationTasks.vue';
import DictationLaunchNotice from '../../components/learning/DictationLaunchNotice.vue';
import { useStudySurface } from '../../composables/useStudySurface';
defineProps<{ embedded?: boolean }>();
const surface = useStudySurface();
const route = useRoute(), router = useRouter();
const resource = useResource<Page<PlanWord>>();
const { data, loading, error } = resource;
const { selected, count, toggle, clear, togglePage } = useSelection();
const creation = useDictationLaunch();
const { busy, error: createError, uncertain, created } = creation;
if (surface) watch(() => surface.state.settings, open => { if (open && created.value && !busy.value && !uncertain.value) { created.value = undefined; createError.value = ''; } });
const locked = computed(() => busy.value || uncertain.value || !!created.value);
const keyword = ref('');
const applied = ref('');
const page = ref(1);
const size = 10;
const roundCount = ref(20);
const validation = ref('');
const tasks = ref<InstanceType<typeof DictationTasks>>();
function eligible(word: PlanWord) { return word.planStatus === 'ACTIVE' && !!word.firstLearnedAt && (!!word.translation?.trim() || word.translationGroups?.some(group => !!group.meaning.trim())); }
const pageIds = computed(() => data.value?.records.filter(eligible).map(word => word.wordId) || []);
const pageSelected = computed(() => !!pageIds.value.length && pageIds.value.every(id => selected.value.has(id)));
const refresh = () => resource.load(() => dailyApi.plan({ page: page.value, size, status: 'ACTIVE', learningStatus: 'LEARNED', sortBy: 'joined_at', direction: 'DESC', ...(applied.value ? { keyword: applied.value } : {}) }));
watch(() => route.path, path => { if (surface && path === '/dictation') { if (created.value && !busy.value && !uncertain.value) { created.value = undefined; createError.value = ''; } void refresh(); } });
function refreshRecords() { if (surface) void router.push('/records/dictation'); else void tasks.value?.refresh(); }
function search() { applied.value = keyword.value.trim(); if (page.value !== 1) page.value = 1; else void refresh(); }
watch(page, refresh);
async function start(manual: boolean) {
  if (locked.value || loading.value || error.value) return;
  validation.value = '';
  if (manual && (count.value < 1 || count.value > 100)) { validation.value = '请选择 1～100 个不同单词。'; return; }
  if (!manual && (!Number.isInteger(roundCount.value) || roundCount.value < 1 || roundCount.value > 100)) { validation.value = '本轮数量须为 1～100 的整数。'; return; }
  await creation.launch(manual ? { source: 'PLAN', wordIds: [...selected.value] } : { source: 'PLAN', count: roundCount.value });
}
onMounted(refresh);
</script>
<template>
  <div class="wordlist-page dictation-home">
    <header class="library-heading"><div><h1>单词默写</h1><p class="subtle-copy">每词一次作答，整轮结束后公布成绩</p></div><div class="live-actions"><RouterLink to="/dictation/mistakes" class="btn btn-secondary">默写错词重练</RouterLink></div></header>
    <section class="wordlist-sheet" aria-labelledby="dictation-plan-heading">
      <h2 id="dictation-plan-heading" class="sr-only">计划选词</h2>
      <div class="dictation-picker-toolbar">
        <form role="search" class="dictation-search" @submit.prevent="search"><SearchField v-model="keyword" label="搜索默写计划词" placeholder="搜索计划中的单词…" :disabled="locked" :maxlength="255" /><button type="submit" :disabled="locked || loading"><Search :size="16" aria-hidden="true" /><span>搜索</span></button></form>
        <div class="dictation-auto-controls"><label for="dictation-count">本轮词数<input id="dictation-count" v-model.number="roundCount" type="number" min="1" max="100" step="1" :disabled="locked" /></label><AppButton :busy="busy" :disabled="locked || loading || !!error" @click="start(false)">从计划开始测验<ArrowRight :size="16" aria-hidden="true" /></AppButton></div>
      </div>
      <div class="wordlist-selection dictation-selection"><label><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pageIds.some(id => selected.has(id))" :disabled="locked || loading || !!error || !pageIds.length" @change="togglePage(pageIds, !pageSelected)" />选择当前页</label><span class="dictation-selection-count">已选 {{ count }} 词</span><button class="dictation-clear-button" :disabled="locked || !count" @click="clear"><X :size="14" aria-hidden="true" />清空选择</button><AppButton v-if="count" :busy="busy" :disabled="locked || loading || !!error || count > 100" @click="start(true)">测验所选 {{ count }} 词<ArrowRight :size="16" aria-hidden="true" /></AppButton></div>
      <p v-if="validation || count > 100" class="inline-error" role="alert">{{ validation || '每轮最多 100 个不同单词，请减少选择。' }}</p>
      <DictationLaunchNotice :error="createError" :uncertain="uncertain" :batch-id="created?.batchId" @refresh="refreshRecords" />
      <StatePanel :loading="loading" :error="error" :empty="data?.total === 0" :message="applied ? '没有符合搜索条件的计划词，试试其他关键词。' : '暂无符合条件的计划词，先完成计划中的首次学习。'" @retry="refresh" />
      <div v-if="!loading && !error"><label v-for="word in data?.records" :key="word.wordId" :class="['dictation-plan-row', { 'is-selected': selected.has(word.wordId) }]"><input type="checkbox" :checked="selected.has(word.wordId)" :disabled="locked || !eligible(word)" :aria-label="`默写选词 ${word.word}`" @change="toggle(word.wordId, !selected.has(word.wordId))" /><strong lang="en">{{ word.word }}</strong><WordMeaning :translation="word.translation" :translation-groups="word.translationGroups" /><span v-if="!eligible(word)" class="subtle-copy">暂不符合出题条件</span></label></div>
      <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading || locked" @change="page = $event" />
    </section>
    <DictationTasks v-if="!embedded" ref="tasks" />
  </div>
</template>
