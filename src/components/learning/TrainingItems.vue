<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue';
import { dailyTrainingApi } from '../../api/dailyTraining';
import { errorMessage } from '../../api/http';
import type { Page } from '../../types/api';
import type { TrainingItem } from '../../types/dailyTraining';
import { trainingStatusLabel } from '../../utils/trainingStatus';
import StatePanel from '../ui/StatePanel.vue';
import AppPagination from '../ui/AppPagination.vue';
import WordMeaning from '../word/WordMeaning.vue';

const props = defineProps<{ batchId: number; revision?: number; allowExtra?: boolean }>();
defineEmits<{ extra: [itemId: number] }>();
const data = ref<Page<TrainingItem>>(), loading = ref(false), error = ref(''), page = ref(1);
let generation = 0;
onScopeDispose(() => { generation++; });
async function load(value = page.value) {
  const token = ++generation; loading.value = true; error.value = ''; page.value = value;
  try { const result = await dailyTrainingApi.items(props.batchId, value); if (token === generation) data.value = result; }
  catch (e) { if (token === generation) error.value = errorMessage(e); }
  finally { if (token === generation) loading.value = false; }
}
watch(() => props.batchId, () => { data.value = undefined; void load(1); }, { immediate: true });
watch(() => [props.revision, props.allowExtra], () => { void load(); });
</script>
<template>
  <section class="training-items" aria-label="本组词项">
    <StatePanel :loading="loading" :error="error" @retry="load()" />
    <template v-if="data && !loading && !error">
      <p class="subtle-copy">按本组顺序展示；完成原因表示本轮状态，回忆完成不等于永久掌握。</p>
      <p v-if="!data.records.length" class="subtle-copy">本组暂无词项。</p>
      <article v-for="row in data.records" :key="row.itemId" :class="['training-item-row', { 'is-current': row.current }]" :data-item-id="row.itemId">
        <header><span class="training-item-order">{{ row.sortOrder }}</span><strong v-if="row.itemStatus === 'DONE' && row.word" lang="en">{{ row.word }}</strong><strong v-else>第 {{ row.sortOrder }} 词</strong><span v-if="row.current" class="training-item-current">当前队列词</span><span>{{ trainingStatusLabel(row) }}</span></header>
        <template v-if="row.itemStatus === 'DONE'"><p v-if="row.phonetic" class="subtle-copy">{{ row.phonetic }}</p><WordMeaning :translation="row.translation" :translation-groups="row.translationGroups" /></template>
        <p v-else class="subtle-copy">{{ row.itemStatus === 'SKIPPED' ? '已跳过，答案保持隐藏。' : '答案保持隐藏，请在当前练习中作答。' }}</p>
        <div class="training-item-footer"><span class="subtle-copy">训练 {{ row.trainingCount }} 次 · 有效反馈 {{ row.answerCount }} 次</span><button v-if="row.canExtraTrain && row.itemStatus === 'DONE'" class="muted-link" :disabled="!allowExtra" @click="$emit('extra', row.itemId)">追加训练此词</button></div>
      </article>
      <AppPagination :page="data.page" :size="data.size" :total="data.total" :disabled="loading" @change="load" />
    </template>
  </section>
</template>
