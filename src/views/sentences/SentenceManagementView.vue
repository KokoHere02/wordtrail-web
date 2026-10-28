<script setup lang="ts">
import { ref } from 'vue';
import { ApiError } from '../../api/http';
import { sentenceManagementApi, sentenceServiceError } from '../../api/sentenceManagement';
import { useSentenceManagementAccess } from '../../stores/sentenceManagementAccess';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { ManagedSentence, SentenceManagementQuery, SentenceQuestionStatus } from '../../types/sentenceManagement';
import type { SentenceDifficulty } from '../../types/sentences';
import SentenceNav from '../../components/learning/SentenceNav.vue';
import SentenceManagementGate from '../../components/learning/SentenceManagementGate.vue';
import SentenceWordPicker from '../../components/learning/SentenceWordPicker.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppSelect from '../../components/ui/AppSelect.vue';
import SearchField from '../../components/ui/SearchField.vue';
import { sentenceDifficultyOptions, sentenceDifficultyLabel, sentenceStatusFilterOptions } from '../../utils/sentenceOptions';
const access = useSentenceManagementAccess();
const { data, loading, error, load } = useResource<Page<ManagedSentence>>();
const keyword = ref('');
const status = ref<SentenceQuestionStatus | ''>('');
const difficulty = ref<SentenceDifficulty | ''>('');
const word = ref<{ id: number; word: string }>();
const picker = ref(false);
const page = ref(1);
const size = 10;
let applied: Omit<SentenceManagementQuery, 'page' | 'size'> = {};
function refresh() {
  if (!access.canManage) return;
  return load(async () => {
    try { return await sentenceManagementApi.questions({ ...applied, page: page.value, size }); }
    catch (value) { if (value instanceof ApiError && value.status === 403) access.deny(); throw new Error(sentenceServiceError(value)); }
  });
}
function search() { applied = { keyword: keyword.value.trim() || undefined, status: status.value || undefined, difficulty: difficulty.value || undefined, wordId: word.value?.id }; page.value = 1; void refresh(); }
</script>
<template>
  <div class="sentence-library-page sentence-management" aria-label="句子题库维护"><SentenceNav active="MANAGEMENT" />
    <SentenceManagementGate @authorized="refresh">
      <section class="sentence-filter-sheet"><form class="sentence-filters sentence-management-filters" role="search" @submit.prevent="search">
        <div class="sentence-filter-field sentence-keyword-filter"><span>英文前缀</span><SearchField v-model="keyword" label="搜索英文句子" placeholder="输入英文前缀" :maxlength="100" :disabled="loading" /></div>
        <AppSelect v-model="status" :options="sentenceStatusFilterOptions" label="状态" :disabled="loading" />
        <AppSelect v-model="difficulty" :options="sentenceDifficultyOptions" label="难度" :disabled="loading" />
        <div class="sentence-filter-field"><span>关联单词</span><button type="button" class="btn btn-secondary" @click="picker = true">{{ word ? `关联：${word.word}` : '关联单词' }}</button></div><button v-if="word" type="button" class="muted-link" @click="word = undefined">清除单词筛选</button><button class="btn btn-primary" :disabled="loading">筛选</button>
      </form></section>
      <section class="sentence-library-sheet sentence-management-table" role="table" aria-label="句子题库列表">
        <div class="sentence-management-toolbar"><span v-if="data" class="subtle-copy">{{ data.total }} 道题目</span><div class="live-actions"><RouterLink class="btn btn-primary" to="/sentences/manage/new">新建题目</RouterLink><RouterLink class="btn btn-secondary" to="/sentences/manage/import">CSV 导入</RouterLink><button class="muted-link" :disabled="loading" @click="refresh">刷新</button></div></div>
        <div class="sentence-table-heading" role="row"><span role="columnheader">句子 / 来源</span><span role="columnheader">状态 / 难度</span><span role="columnheader">操作</span></div>
        <StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="没有符合条件的题目。" @retry="refresh" />
        <article v-for="question in !loading && !error ? data?.records : []" :key="question.sentenceId" class="sentence-managed-row" role="row"><div role="cell"><p class="sentence-english" lang="en">{{ question.englishText }}</p><p class="sentence-row-meta">{{ question.source }}<span v-if="question.sourceReference"> · {{ question.sourceReference }}</span></p><div v-if="question.linkedWords.length" class="sentence-word-pills"><span v-for="item in question.linkedWords" :key="item.wordId">{{ item.word }}</span></div></div><div class="sentence-managed-meta" role="cell"><span :class="['sentence-status', { 'is-inactive': question.status === 'INACTIVE' }]">{{ question.status === 'ACTIVE' ? '启用' : '已停用' }}</span><span class="sentence-level">{{ sentenceDifficultyLabel(question.difficulty) }}</span></div><div role="cell" class="sentence-managed-action"><RouterLink class="btn btn-secondary" :to="`/sentences/manage/${question.sentenceId}/edit`">编辑 / {{ question.status === 'ACTIVE' ? '停用' : '恢复' }}</RouterLink></div></article>
        <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" noun="句" @change="page = $event; refresh()" />
      </section>
      <SentenceWordPicker v-model="picker" @select="word = $event" />
    </SentenceManagementGate>
  </div>
</template>
