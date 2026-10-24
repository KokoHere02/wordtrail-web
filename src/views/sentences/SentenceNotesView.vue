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
const { data, loading, error, load } = useResource<Page<SentenceNoteRow>>();
const tag = ref<SentenceErrorTag | ''>(''), difficulty = ref<SentenceDifficulty | ''>('');
const word = ref<{ id: number; word: string }>(), picker = ref(false);
const page = ref(1), size = 10;
let filters: Omit<SentenceNotesQuery, 'page' | 'size'> = {};
function refresh() { return load(async () => { try { return await sentenceLinksApi.notes({ page: page.value, size, ...filters }); } catch (value) { throw new Error(sentenceServiceError(value)); } }); }
function search() { filters = { errorTag: tag.value || undefined, difficulty: difficulty.value || undefined, wordId: word.value?.id }; page.value = 1; void refresh(); }
onMounted(refresh);
</script>
<template>
  <div class="wordlist-page sentence-notes"><header class="library-heading"><h1>个人句子笔记</h1><button class="muted-link" :disabled="loading" @click="refresh">刷新笔记</button></header><SentenceNav active="NOTES" /><form class="sentence-filters" @submit.prevent="search"><label>错因<select v-model="tag"><option value="">全部</option><option v-for="item in sentenceErrorTags" :key="item.value" :value="item.value">{{ item.label }}</option></select></label><label>难度<select v-model="difficulty"><option value="">全部</option><option :value="1">基础</option><option :value="2">进阶</option><option :value="3">挑战</option></select></label><button type="button" class="btn btn-secondary" @click="picker = true">{{ word?.word || '关联单词' }}</button><button v-if="word" type="button" class="muted-link" @click="word = undefined">清除单词筛选</button><button class="btn btn-secondary" :disabled="loading">筛选笔记</button></form><StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="暂无符合条件的笔记或错因标记。" @retry="refresh" /><article v-for="row in !loading && !error ? data?.records : []" :key="row.sentenceId" class="sentence-note-row"><p class="sentence-english" lang="en">{{ row.englishText }}</p><p class="subtle-copy">{{ row.available ? '启用题目' : '题目已停用，笔记仍可编辑' }}<span v-if="row.note.updatedAt"> · {{ row.note.updatedAt.replace('T', ' ') }}（北京时间）</span></p><SentenceNotePanel :sentence-id="row.sentenceId" :personal-note="row.note" @saved="refresh" /></article><AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="page = $event; refresh()" /><SentenceWordPicker v-model="picker" @select="word = $event" /></div>
</template>
