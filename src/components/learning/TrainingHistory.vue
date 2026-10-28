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
const verdicts = { SELF_ASSESSED: '自评', CORRECT: '输入正确', INCORRECT: '输入错误', REVEALED: '查看答案' };
</script>
<template>
  <section class="training-history" aria-label="练习记录">
    <StatePanel :loading="loading" :error="error" @retry="load()" />
    <template v-if="data && !loading && !error">
      <p v-if="!data.records.length" class="training-list-empty">暂无练习记录</p>
      <article v-for="row in data.records" :key="row.trainingId" class="training-history-row">
        <header><strong>{{ row.word }}</strong><span>{{ dailyModeLabels[row.mode] }} · {{ verdicts[row.verdict] }}</span><time>{{ row.answeredAt.replace('T', ' ') }}</time></header>
        <p v-if="row.input !== null" class="daily-submitted">输入：{{ row.input }}</p>
        <p v-if="row.selfAssessment !== null">自评：{{ ({ 1: '认识', 2: '模糊', 3: '不认识' })[row.selfAssessment] }}</p>
        <WordMeaning :translation="row.translation" :translation-groups="row.translationGroups" />
        <footer class="training-history-meta"><span>当前状态：{{ trainingStatusLabel(row) }}</span><span v-if="row.hintUsed && scope !== 'FOLLOW_TYPING'">使用提示</span><span v-if="row.extraTraining">追加练习</span></footer>
      </article>
      <AppPagination :page="data.page" :size="data.size" :total="data.total" :disabled="loading" @change="load" />
    </template>
  </section>
</template>
<style scoped>
.training-list-empty { padding: var(--s10) var(--s4); text-align: center; color: var(--muted); }
.training-history-meta { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s4); margin-top: var(--s3); color: var(--muted); font-size: var(--text-sm); }
</style>
