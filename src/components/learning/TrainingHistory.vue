<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue';
import { followTypingApi } from '../../api/followTyping';
import { consolidationApi } from '../../api/consolidation';
import { dailyTrainingApi } from '../../api/dailyTraining';
import { errorMessage } from '../../api/http';
import { dailyModeLabels, type TrainingHistory } from '../../types/dailyTraining';
import { trainingStatusLabel } from '../../utils/trainingStatus';
import StatePanel from '../ui/StatePanel.vue';
import AppPagination from '../ui/AppPagination.vue';
import WordMeaning from '../word/WordMeaning.vue';
const props = defineProps<{ batchId: number; scope?: 'DAILY' | 'CONSOLIDATION' | 'FOLLOW_TYPING'; revision?: number }>();
const data = ref<TrainingHistory>(), loading = ref(false), error = ref(''), page = ref(1);
let generation = 0;
onScopeDispose(() => { generation++; });
async function load(value = page.value) {
  const token = ++generation; loading.value = true; error.value = ''; page.value = value;
  try {
    const result = await (props.scope === 'FOLLOW_TYPING' ? followTypingApi : props.scope === 'CONSOLIDATION' ? consolidationApi : dailyTrainingApi).history(props.batchId, value);
    if (token !== generation) return;
    data.value = result;
  }
  catch (e) { if (token === generation) error.value = errorMessage(e); }
  finally { if (token === generation) loading.value = false; }
}
watch(() => props.batchId, () => { void load(1); }, { immediate: true });
watch(() => props.revision, () => { void load(); });
const verdicts = { SELF_ASSESSED: '认识自评', CORRECT: '输入正确', INCORRECT: '输入未匹配', REVEALED: '查看答案' };
</script>
<template>
  <section class="training-history" :aria-label="scope === 'FOLLOW_TYPING' ? '跟拼作答历史' : '统一每日训练历史'">
    <StatePanel :loading="loading" :error="error" @retry="load()" />
    <template v-if="data && !loading && !error"><p class="subtle-copy">下列词项状态为查询时的当前状态，动作、输入、自评和时间保留当次记录。追加练习请使用本组词项列表。</p><p v-if="!data.records.length" class="subtle-copy">暂无本轮训练记录。</p><article v-for="row in data.records" :key="row.trainingId" class="training-history-row"><header><strong>{{ row.word }}</strong><span>{{ dailyModeLabels[row.mode] }} · {{ verdicts[row.verdict] }}</span><time>{{ row.answeredAt.replace('T', ' ') }}</time></header><p v-if="row.input !== null" class="daily-submitted">输入：{{ row.input }}</p><p v-if="row.selfAssessment !== null">自评：{{ ({ 1: '认识', 2: '模糊', 3: '不认识' })[row.selfAssessment] }}</p><WordMeaning :translation="row.translation" :translation-groups="row.translationGroups" /><p class="subtle-copy">第 {{ row.attemptNo }} 次训练事件<span v-if="row.hintUsed && scope !== 'FOLLOW_TYPING'"> · 已使用提示／展示过拼写</span><span v-if="row.extraTraining"> · 追加训练，不重复增加本轮完成词数</span></p><p class="training-current-status">词项当前状态：{{ trainingStatusLabel(row) }}</p></article><AppPagination :page="data.page" :size="data.size" :total="data.total" :disabled="loading" @change="load" /></template>
  </section>
</template>
