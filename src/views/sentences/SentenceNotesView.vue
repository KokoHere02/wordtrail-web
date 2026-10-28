<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { sentenceLinksApi } from '../../api/sentenceLinks';
import { sentenceServiceError } from '../../api/sentenceManagement';
import { useResource } from '../../composables/useResource';
import { sentenceErrorTags, type SentenceErrorTag, type SentenceNoteRow, type SentenceNotesQuery } from '../../types/sentenceLinks';
import type { Page } from '../../types/api';
import type { SentenceDifficulty } from '../../types/sentences';
import SentenceNav from '../../components/learning/SentenceNav.vue';
import SentenceNotePanel from '../../components/learning/SentenceNotePanel.vue';
import SentenceWordPicker from '../../components/learning/SentenceWordPicker.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppSelect from '../../components/ui/AppSelect.vue';
import { sentenceDifficultyOptions } from '../../utils/sentenceOptions';
const { data, loading, error, load } = useResource<Page<SentenceNoteRow>>();
const tag = ref<SentenceErrorTag | ''>(''), difficulty = ref<SentenceDifficulty | ''>('');
const word = ref<{ id: number; word: string }>(), picker = ref(false);
const page = ref(1), size = 10;
const tagOptions: { value: SentenceErrorTag | ''; label: string }[] = [{ value: '', label: '全部错因' }, ...sentenceErrorTags];
let filters: Omit<SentenceNotesQuery, 'page' | 'size'> = {};
function refresh() { return load(async () => { try { return await sentenceLinksApi.notes({ page: page.value, size, ...filters }); } catch (value) { throw new Error(sentenceServiceError(value)); } }); }
function search() { filters = { errorTag: tag.value || undefined, difficulty: difficulty.value || undefined, wordId: word.value?.id }; page.value = 1; void refresh(); }
onMounted(refresh);
</script>
<template>
  <div class="sentence-library-page sentence-notes" aria-label="个人句子笔记">
    <SentenceNav active="NOTES" />
    <section class="sentence-filter-sheet"><form class="sentence-filters" @submit.prevent="search">
      <AppSelect v-model="tag" :options="tagOptions" label="错因" :disabled="loading" />
      <AppSelect v-model="difficulty" :options="sentenceDifficultyOptions" label="难度" :disabled="loading" />
      <div class="sentence-filter-field"><span>关联单词</span><div class="sentence-word-filter"><button type="button" class="btn btn-secondary" @click="picker = true">{{ word?.word || '关联单词' }}</button><button v-if="word" type="button" class="muted-link" @click="word = undefined">清除单词筛选</button></div></div>
      <button class="btn btn-primary" :disabled="loading">筛选笔记</button><button type="button" class="muted-link" :disabled="loading" @click="refresh">刷新笔记</button>
    </form></section>
    <StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="暂无符合条件的笔记或错因标记。" @retry="refresh" />
    <div class="sentence-notes-list"><article v-for="row in !loading && !error ? data?.records : []" :key="row.sentenceId" class="sentence-note-row"><p class="sentence-english" lang="en">{{ row.englishText }}</p><div class="sentence-row-meta"><span :class="['sentence-status', { 'is-inactive': !row.available }]">{{ row.available ? '启用题目' : '已停用' }}</span><time v-if="row.note.updatedAt">{{ row.note.updatedAt.replace('T', ' ') }}</time></div><SentenceNotePanel :sentence-id="row.sentenceId" :personal-note="row.note" @saved="refresh" /></article></div>
    <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="page = $event; refresh()" />
    <SentenceWordPicker v-model="picker" @select="word = $event" />
  </div>
</template>
