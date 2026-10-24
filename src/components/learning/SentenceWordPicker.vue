<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../../api';
import { useResource } from '../../composables/useResource';
import type { DictionaryWord, Page } from '../../types/api';
import AppDialog from '../ui/AppDialog.vue';
import AppButton from '../ui/AppButton.vue';
import AppPagination from '../ui/AppPagination.vue';
import SearchField from '../ui/SearchField.vue';
import StatePanel from '../ui/StatePanel.vue';
import WordMeaning from '../word/WordMeaning.vue';
const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; select: [word: { id: number; word: string }] }>();
const { data, loading, error, load } = useResource<Page<DictionaryWord>>();
const keyword = ref('');
const applied = ref('');
const validation = ref('');
const page = ref(1);
const size = 10;
const refresh = () => load(() => api.dictionary({ keyword: applied.value, matchType: 'PREFIX', page: page.value, size }));
function search() {
  validation.value = '';
  if (!keyword.value.trim() || keyword.value.trim().length > 255) { validation.value = '请输入 1～255 个字符的单词。'; return; }
  applied.value = keyword.value.trim(); page.value = 1; void refresh();
}
function select(word: DictionaryWord) { emit('select', { id: word.id, word: word.word }); emit('update:modelValue', false); }
</script>
<template>
  <AppDialog :model-value="props.modelValue" title="选择关联单词" description="只筛选题库已明确关联的单词，不自动分析句子。" @update:model-value="emit('update:modelValue', $event)">
    <form class="live-actions sentence-word-search" role="search" @submit.prevent="search"><SearchField v-model="keyword" label="查找关联单词" placeholder="搜索词库单词" :maxlength="255" /><AppButton type="submit" variant="secondary" :disabled="loading">查找</AppButton></form><p v-if="validation" class="inline-error" role="alert">{{ validation }}</p><StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="没有找到该单词，试试其他拼写。" @retry="refresh" /><article v-for="word in !loading && !error ? data?.records : []" :key="word.id" class="sentence-word-option"><div><strong lang="en">{{ word.word }}</strong><small v-if="word.phonetic">{{ word.phonetic }}</small><WordMeaning :translation="word.translation" :translation-groups="word.translationGroups" /></div><AppButton variant="secondary" @click="select(word)">选用 {{ word.word }}</AppButton></article><AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="page = $event; refresh()" />
  </AppDialog>
</template>
