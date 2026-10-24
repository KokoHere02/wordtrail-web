<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { sentenceLinksApi } from '../../api/sentenceLinks';
import { sentenceServiceError } from '../../api/sentenceManagement';
import { useResource } from '../../composables/useResource';
import type { SentenceQuestion, SentenceDifficulty } from '../../types/sentences';
import type { Page } from '../../types/api';
import WordSentencePractice from './WordSentencePractice.vue';
import StatePanel from '../ui/StatePanel.vue';
import AppPagination from '../ui/AppPagination.vue';
const props = defineProps<{ wordId: number }>();
const { data, loading, error, load } = useResource<Page<SentenceQuestion>>();
const page = ref(1), size = 5;
const difficulty = ref<SentenceDifficulty | ''>('');
function refresh() { return load(async () => { try { return await sentenceLinksApi.wordSentences(props.wordId, { page: page.value, size, ...(difficulty.value ? { difficulty: difficulty.value } : {}) }); } catch (value) { throw new Error(sentenceServiceError(value)); } }); }
watch(difficulty, () => { page.value = 1; void refresh(); });
onMounted(refresh);
</script>
<template>
  <section class="word-detail-panel word-sentences" aria-labelledby="word-sentences-title"><div class="sentence-linked-heading"><h2 id="word-sentences-title">关联句子</h2><label class="live-filter">难度<select v-model="difficulty"><option value="">全部</option><option :value="1">基础</option><option :value="2">进阶</option><option :value="3">挑战</option></select></label></div><StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="这个单词暂无关联句子。" @retry="refresh" /><article v-for="row in !loading && !error ? data?.records : []" :key="row.sentenceId" class="word-sentence-row"><p class="sentence-english" lang="en">{{ row.englishText }}</p><p class="subtle-copy">难度 {{ row.difficulty }} · {{ row.source }}</p></article><AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" noun="句" @change="page = $event; refresh()" /><WordSentencePractice :word-ids="[wordId]" :disabled="loading || !!error || !data?.total" /></section>
</template>
