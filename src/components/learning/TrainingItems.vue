<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue';
import { followTypingApi } from '../../api/followTyping';
import { consolidationApi } from '../../api/consolidation';
import { dailyTrainingApi } from '../../api/dailyTraining';
import { errorMessage } from '../../api/http';
import type { Page } from '../../types/api';
import type { TrainingItem } from '../../types/dailyTraining';
import { trainingStatusLabel } from '../../utils/trainingStatus';
import StatePanel from '../ui/StatePanel.vue';
import AppPagination from '../ui/AppPagination.vue';
import WordMeaning from '../word/WordMeaning.vue';

const props = defineProps<{ batchId: number; scope?: 'DAILY' | 'CONSOLIDATION' | 'FOLLOW_TYPING'; revision?: number; allowExtra?: boolean }>();
defineEmits<{ extra: [itemId: number] }>();
const data = ref<Page<TrainingItem>>(), loading = ref(false), error = ref(''), page = ref(1);
let generation = 0;
onScopeDispose(() => { generation++; });
async function load(value = page.value) {
  const token = ++generation; loading.value = true; error.value = ''; page.value = value;
  try { const result = await (props.scope === 'FOLLOW_TYPING' ? followTypingApi : props.scope === 'CONSOLIDATION' ? consolidationApi : dailyTrainingApi).items(props.batchId, value); if (token === generation) data.value = result; }
  catch (e) { if (token === generation) error.value = errorMessage(e); }
  finally { if (token === generation) loading.value = false; }
}
watch(() => props.batchId, () => { data.value = undefined; void load(1); }, { immediate: true });
watch(() => [props.revision, props.allowExtra], () => { void load(); });
</script>
<template>
  <section class="training-items" aria-label="练习词项">
    <StatePanel :loading="loading" :error="error" @retry="load()" />
    <template v-if="data && !loading && !error">
      <p v-if="!data.records.length" class="training-list-empty">暂无单词</p>
      <article v-for="row in data.records" :key="row.itemId" :class="['training-item-row', { 'is-current': row.current }]" :data-item-id="row.itemId">
        <header><span class="training-item-order">{{ row.sortOrder }}</span><strong v-if="(scope === 'FOLLOW_TYPING' || row.itemStatus === 'DONE') && row.word" lang="en">{{ row.word }}</strong><strong v-else>第 {{ row.sortOrder }} 词</strong><span v-if="row.current" class="training-item-current">正在学习</span><span>{{ trainingStatusLabel(row) }}</span></header>
        <template v-if="scope === 'FOLLOW_TYPING' || row.itemStatus === 'DONE'"><p v-if="row.phonetic" class="subtle-copy">{{ row.phonetic }}</p><WordMeaning :translation="row.translation" :translation-groups="row.translationGroups" /></template>
        <div class="training-item-footer"><span class="subtle-copy">练习 {{ row.trainingCount }} 次</span><button v-if="row.canExtraTrain && row.itemStatus === 'DONE'" class="muted-link" :disabled="!allowExtra" @click="$emit('extra', row.itemId)">追加练习</button></div>
      </article>
      <AppPagination :page="data.page" :size="data.size" :total="data.total" :disabled="loading" @change="load" />
    </template>
  </section>
</template>
<style scoped>
.training-list-empty { padding: var(--s10) var(--s4); text-align: center; color: var(--muted); }
</style>
