<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { api } from '../../api';
import { errorMessage } from '../../api/http';
import type { DictionaryWord, Page } from '../../types/api';
import type { BookImportRow } from '../../types/bookTransfer';
import AppPagination from '../ui/AppPagination.vue';
import StatePanel from '../ui/StatePanel.vue';
import WordMeaning from './WordMeaning.vue';
const props = defineProps<{ bookId: number; row: BookImportRow; selected?: DictionaryWord; disabled: boolean }>();
const emit = defineEmits<{ select: [word: DictionaryWord]; unavailable: [error: unknown] }>();
const expanded = ref(false);
const page = ref(1);
const size = 20;
const data = shallowRef<Page<DictionaryWord>>();
const loading = ref(false);
const error = ref('');
let generation = 0;
const candidates = computed(() => page.value === 1 ? props.row.candidates : data.value?.records || []);
const total = computed(() => data.value?.total ?? props.row.candidateCount);
watch(() => props.row, () => { generation++; page.value = 1; data.value = undefined; error.value = ''; loading.value = false; expanded.value = false; });
onScopeDispose(() => { generation++; });
async function changePage(value: number) {
  if (loading.value || props.disabled) return;
  page.value = value;
  error.value = '';
  if (value === 1) return;
  const current = ++generation;
  loading.value = true;
  try {
    const result = await api.dictionary({ keyword: props.row.word || '', matchType: 'EXACT', bookId: props.bookId, page: value, size });
    if (current === generation) data.value = result;
  } catch (value) {
    if (current === generation) { error.value = errorMessage(value); emit('unavailable', value); }
  } finally { if (current === generation) loading.value = false; }
}
</script>
<template>
  <div class="import-candidates">
    <p v-if="selected" class="import-selected">已选 {{ selected.word }} #{{ selected.id }} · {{ selected.inBook === true ? '已收录' : selected.inBook === false ? '未收录' : '收录状态未知' }}</p>
    <details @toggle="expanded = ($event.target as HTMLDetailsElement).open">
      <summary>{{ selected ? '更换候选' : '选择候选' }} · 共 {{ row.candidateCount }} 个</summary>
      <div v-if="expanded">
        <StatePanel :loading="loading" :error="error" :empty="!loading && !error && !candidates.length" message="没有可选候选，请重新预览。" @retry="changePage(page)" />
        <div v-if="!loading && !error" class="import-candidate-list">
          <label v-for="word in candidates" :key="word.id" class="import-candidate">
            <input type="radio" :name="`import-row-${row.rowNumber}`" :checked="selected?.id === word.id" :disabled="disabled" :aria-label="`选用 ${word.word} #${word.id}`" @change="emit('select', word)" />
            <span><strong lang="en">{{ word.word }}</strong><span class="subtle-copy"> #{{ word.id }} · {{ word.inBook === true ? '已收录' : word.inBook === false ? '未收录' : '收录状态未知' }}</span><small>{{ word.phonetic }}</small><WordMeaning :translation="word.translation" :translation-groups="word.translationGroups" /></span>
          </label>
        </div>
        <AppPagination v-if="row.hasMoreCandidates || total > size" :page="page" :size="size" :total="total" :disabled="disabled || loading" noun="个候选" @change="changePage" />
      </div>
    </details>
  </div>
</template>
