<script setup lang="ts">
import { ref, watch } from 'vue';
import { dailyTrainingApi } from '../../api/dailyTraining';
import { errorMessage } from '../../api/http';
import { dailyModeLabels, type TrainingStatistics } from '../../types/dailyTraining';
import StatePanel from '../ui/StatePanel.vue';
const props = defineProps<{ initialDate?: string }>();
const date = ref(props.initialDate ?? ''), data = ref<TrainingStatistics>(), busy = ref(false), error = ref('');
let generation = 0;
async function load() {
  const token = ++generation; busy.value = true; error.value = '';
  try { const result = await dailyTrainingApi.statistics(date.value || undefined); if (token === generation) data.value = result; }
  catch (e) { if (token === generation) error.value = errorMessage(e); }
  finally { if (token === generation) busy.value = false; }
}
watch(date, load, { immediate: true });
</script>
<template>
  <section class="training-statistics insights-trend-panel" aria-label="每日分方式训练统计">
    <header class="insights-trend-heading"><div><h2>每日训练方式</h2><p v-if="data">{{ data.learningDate }} · 共完成 {{ data.completedWordCount }} 个不同单词</p></div><label>学习日期 <input v-model="date" type="date" aria-label="训练统计日期" /></label></header>
    <StatePanel :loading="busy" :error="error" @retry="load" />
    <div v-if="data && !busy && !error" class="training-mode-statistics"><article v-for="row in data.modes" :key="row.mode"><h3>{{ dailyModeLabels[row.mode] }}</h3><dl><div><dt>训练事件</dt><dd>{{ row.trainingCount }}</dd></div><div><dt>作答</dt><dd>{{ row.answerCount }}</dd></div><div><dt>查看答案</dt><dd>{{ row.revealCount }}</dd></div><template v-if="row.mode === 'RECOGNITION'"><div><dt>自评认识</dt><dd>{{ row.recognizedCount }}</dd></div><div><dt>自评模糊</dt><dd>{{ row.uncertainCount }}</dd></div><div><dt>自评不认识</dt><dd>{{ row.unknownCount }}</dd></div></template><template v-else><div><dt>输入正确</dt><dd>{{ row.correctCount }}</dd></div><div><dt>输入正确率</dt><dd>{{ row.inputAccuracy === null ? '—' : `${(row.inputAccuracy * 100).toFixed(1)}%` }}</dd></div></template><div><dt>带提示作答</dt><dd>{{ row.hintedAnswerCount }}</dd></div></dl><p v-if="!row.trainingCount" class="subtle-copy">当日暂无该方式训练记录。</p></article></div>
    <p class="subtle-copy">训练事件包含作答、看答案和追加训练；完成词数共用且去重。输入正确率与认识自评不表示掌握程度，独立专项和句子练习另计。</p>
  </section>
</template>
