<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '../../api';
import { ApiError, errorMessage } from '../../api/http';
import { sentenceLinksApi } from '../../api/sentenceLinks';
import { useResource } from '../../composables/useResource';
import type { Book, Page } from '../../types/api';
import AppDialog from '../ui/AppDialog.vue';
import AppPagination from '../ui/AppPagination.vue';
import StatePanel from '../ui/StatePanel.vue';
const props = defineProps<{ modelValue: boolean; sessionId: number; itemId: number; wordId: number; word: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const { data, loading, error, load } = useResource<Page<Book>>();
const page = ref(1), size = 10;
const bookId = ref<number>();
const joinPlan = ref(false), busy = ref(false), blocked = ref(false);
const saveError = ref(''), notice = ref('');
const refresh = () => load(() => api.books({ scope: 'PERSONAL', page: page.value, size }));
watch(() => props.modelValue, open => { if (open) { page.value = 1; bookId.value = undefined; joinPlan.value = false; saveError.value = ''; notice.value = ''; blocked.value = false; void refresh(); } }, { immediate: true });
async function collect() {
  if (busy.value || loading.value || !bookId.value || blocked.value || notice.value) return;
  const chosen = data.value?.records.find(row => row.id === bookId.value);
  if (!chosen?.editable || chosen.bookType !== 'PERSONAL') { saveError.value = '请选择本人可编辑的个人词本。'; return; }
  busy.value = true; saveError.value = '';
  try {
    const result = await sentenceLinksApi.collect(props.sessionId, props.itemId, props.wordId, chosen.id, joinPlan.value);
    notice.value = `收词：新增 ${result.collection.changedCount}，原已收录 ${result.collection.unchangedCount}。`;
    if (result.plan) notice.value += ` 计划：新增 ${result.plan.addedCount}，恢复 ${result.plan.reactivatedCount}，保留 ${result.plan.unchangedCount}。`;
  } catch (value) {
    saveError.value = errorMessage(value);
    if (value instanceof ApiError && ['SENTENCE_WORD_NOT_LINKED', 'SENTENCE_SESSION_NOT_FOUND', 'WORD_NOT_FOUND'].includes(value.code)) blocked.value = true;
    if (value instanceof ApiError && ['BOOK_READ_ONLY', 'BOOK_NOT_FOUND'].includes(value.code)) { bookId.value = undefined; await refresh(); }
  } finally { busy.value = false; }
}
</script>
<template>
  <AppDialog :model-value="modelValue" title="收录关联单词" :description="word" @update:model-value="!busy && emit('update:modelValue', $event)"><StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="暂无个人词本，请先在词库创建个人词本。" @retry="refresh" /><form class="sentence-collect-form" @submit.prevent="collect"><fieldset :disabled="busy || blocked || !!notice"><legend>选择个人词本</legend><label v-for="book in !loading && !error ? data?.records : []" :key="book.id"><input v-model="bookId" type="radio" :value="book.id" name="sentence-collection-book" :disabled="!book.editable || book.bookType !== 'PERSONAL'" />{{ book.name }}<span v-if="!book.editable">（不可编辑）</span></label><AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading || busy" @change="page = $event; bookId = undefined; refresh()" /><label class="sentence-join-choice"><input v-model="joinPlan" type="checkbox" />同时加入长期学习计划</label><button class="btn btn-primary" :disabled="!bookId || loading || !!error">{{ busy ? '收录中…' : '确认收词' }}</button></fieldset></form><p v-if="saveError" class="inline-error" role="alert">{{ saveError }}</p><p v-if="notice" class="sentence-notice" role="status">{{ notice }}</p></AppDialog>
</template>
