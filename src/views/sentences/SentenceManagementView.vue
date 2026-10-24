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
  <div class="wordlist-page sentence-management"><header class="library-heading"><h1>句子题库维护</h1></header><SentenceNav active="MANAGEMENT" />
    <SentenceManagementGate @authorized="refresh">
      <div class="live-actions sentence-manage-actions"><RouterLink class="btn btn-primary" to="/sentences/manage/new">新建题目</RouterLink><RouterLink class="btn btn-secondary" to="/sentences/manage/import">CSV 导入</RouterLink><button class="muted-link" :disabled="loading" @click="refresh">刷新</button></div>
      <form class="sentence-filters sentence-management-filters" role="search" @submit.prevent="search">
        <label>英文前缀<input v-model="keyword" maxlength="100" placeholder="搜索英文句子" /></label>
        <label>状态<select v-model="status"><option value="">全部</option><option value="ACTIVE">启用</option><option value="INACTIVE">停用</option></select></label>
        <label>难度<select v-model="difficulty"><option value="">全部</option><option :value="1">基础</option><option :value="2">进阶</option><option :value="3">挑战</option></select></label>
        <button type="button" class="btn btn-secondary" @click="picker = true">{{ word ? `关联：${word.word}` : '关联单词' }}</button><button v-if="word" type="button" class="muted-link" @click="word = undefined">清除单词筛选</button><button class="btn btn-secondary" :disabled="loading">筛选</button>
      </form>
      <StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="没有符合条件的题目。" @retry="refresh" />
      <article v-for="question in !loading && !error ? data?.records : []" :key="question.sentenceId" class="sentence-managed-row"><div><p class="sentence-english" lang="en">{{ question.englishText }}</p><p class="subtle-copy">{{ question.status === 'ACTIVE' ? '启用' : '已停用' }} · 难度 {{ question.difficulty }} · 版本 {{ question.version }}</p><p class="sentence-source">{{ question.source }}<span v-if="question.sourceReference"> · {{ question.sourceReference }}</span></p><p v-if="question.linkedWords.length" class="subtle-copy">{{ question.linkedWords.map(item => item.word).join(' · ') }}</p></div><RouterLink class="btn btn-secondary" :to="`/sentences/manage/${question.sentenceId}/edit`">编辑 / {{ question.status === 'ACTIVE' ? '停用' : '恢复' }}</RouterLink></article>
      <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" noun="句" @change="page = $event; refresh()" />
      <SentenceWordPicker v-model="picker" @select="word = $event" />
    </SentenceManagementGate>
  </div>
</template>
