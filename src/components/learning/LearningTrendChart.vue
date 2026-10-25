<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { LearningTrendDay } from '../../types/insights';
const props = withDefaults(defineProps<{ records: LearningTrendDay[]; showRecalled?: boolean }>(), { showRecalled: true });
const selected = ref(0);
const plot = ref<SVGSVGElement>();
const width = 720, height = 208, inset = 10;
const series = computed(() => [
  { key: 'trainingCount' as const, label: '训练次数', className: 'training' },
  { key: 'answerCount' as const, label: '作答次数', className: 'answers' },
  { key: 'completedCount' as const, label: '完成词数', className: 'completed' },
  ...(props.showRecalled ? [{ key: 'recalledCount' as const, label: '回忆完成', className: 'recalled' }] : []),
]);
const ceiling = computed(() => Math.ceil(Math.max(2, ...props.records.flatMap(record => series.value.map(entry => record[entry.key] ?? 0))) / 2) * 2);
const ticks = computed(() => [ceiling.value, ceiling.value / 2, 0]);
const active = computed(() => props.records[selected.value]);
const x = (index: number) => props.records.length <= 1 ? width / 2 : inset + index * (width - inset * 2) / (props.records.length - 1);
const y = (value: number) => height - inset - value / ceiling.value * (height - inset * 2);
const points = (key: 'trainingCount' | 'answerCount' | 'completedCount' | 'recalledCount') => props.records.map((record, index) => `${x(index)},${y(record[key] ?? 0)}`).join(' ');
const step = computed(() => props.records.length <= 1 ? width : (width - inset * 2) / (props.records.length - 1));
const dateLabels = computed(() => {
  const count = props.records.length;
  const indices = count <= 7 ? props.records.map((_, index) => index) : Array.from({ length: 5 }, (_, index) => Math.round((count - 1) * index / 4));
  return indices.map(index => ({ record: props.records[index]!, index }));
});
const allZero = computed(() => props.records.length > 0 && props.records.every(record => !record.hasLearningActivity && series.value.every(entry => !record[entry.key])));
const dayLabel = (record: LearningTrendDay) => `${record.learningDate}，训练 ${record.trainingCount} 次，作答 ${record.answerCount} 次，完成 ${record.completedCount} 词，${props.showRecalled ? `回忆完成 ${record.recalledCount} 词，` : ''}学习 ${record.studiedCount} 词，${record.hasLearningActivity ? '有学习活动' : '无学习活动'}，${record.hasRecordedAnswers ? '有作答' : '无作答'}`;
watch(() => props.records, () => { selected.value = Math.max(0, props.records.length - 1); }, { immediate: true });
async function keyboard(event: KeyboardEvent, index: number) {
  let next = index;
  if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
  else if (event.key === 'ArrowRight') next = Math.min(props.records.length - 1, index + 1);
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = props.records.length - 1;
  else if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault(); selected.value = next;
  await nextTick();
  plot.value?.querySelectorAll<SVGElement>('[data-trend-index]')[next]?.focus();
}
</script>
<template>
  <figure class="learning-trend-chart">
    <figcaption class="trend-legend"><span v-for="entry in series" :key="entry.key"><i :class="['trend-key', entry.className]" />{{ entry.label }}</span></figcaption>
    <template v-if="records.length">
      <div class="trend-plot"><div class="trend-y-axis" aria-hidden="true"><span v-for="tick in ticks" :key="tick">{{ tick }}</span></div><svg ref="plot" :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none" role="group" aria-label="逐日训练、作答与完成趋势"><line v-for="tick in ticks" :key="tick" :x1="0" :x2="width" :y1="y(tick)" :y2="y(tick)" class="trend-grid-line" /><polyline v-for="entry in series" :key="entry.key" :points="points(entry.key)" :class="['trend-series', entry.className]" /><g v-for="(record, index) in records" :key="record.learningDate" :data-trend-index="index" role="button" :tabindex="index === selected ? 0 : -1" :aria-pressed="index === selected" :aria-label="dayLabel(record)" @pointerenter="selected = index" @focus="selected = index" @click="selected = index" @keydown="keyboard($event, index)"><rect :x="Math.max(0, x(index) - step / 2)" :y="0" :width="Math.min(width, step)" :height="height" class="trend-hit-area" /><line v-if="index === selected" :x1="x(index)" :x2="x(index)" :y1="inset" :y2="height - inset" class="trend-selected-line" /><circle v-for="entry in series" :key="entry.key" :cx="x(index)" :cy="y(record[entry.key] ?? 0)" :r="index === selected ? 4 : 2" :class="['trend-point', entry.className]" /></g></svg></div>
      <div class="trend-x-axis" aria-hidden="true"><span v-for="entry in dateLabels" :key="entry.record.learningDate" :style="{ left: `${x(entry.index) / width * 100}%`, transform: `translateX(${entry.index === 0 ? 0 : entry.index === records.length - 1 ? -100 : -50}%)` }">{{ entry.record.learningDate.slice(5) }}</span></div>
      <div v-if="active" class="trend-readout" aria-live="polite"><time :datetime="active.learningDate">{{ active.learningDate }}</time><span>训练 <strong>{{ active.trainingCount }}</strong> 次</span><span>作答 <strong>{{ active.answerCount }}</strong> 次</span><span>完成 <strong>{{ active.completedCount }}</strong> 词</span><span v-if="showRecalled">回忆完成 <strong>{{ active.recalledCount }}</strong> 词</span><span>学习 <strong>{{ active.studiedCount }}</strong> 词</span><span>{{ active.hasLearningActivity ? '有学习活动' : '无学习活动' }}</span></div>
      <p v-if="allZero" class="trend-zero-note">本窗口暂无已记录的学习活动或完成数据。</p>
      <details class="trend-data-table copy-note"><summary>查看逐日数据</summary><div class="trend-table-scroll"><table><caption class="sr-only">服务端返回的逐日学习数据</caption><thead><tr><th scope="col">日期</th><th scope="col">训练次数</th><th scope="col">作答次数</th><th scope="col">完成词数</th><th v-if="showRecalled" scope="col">回忆完成</th><th scope="col">学习词数</th><th scope="col">学习活动</th><th scope="col">存在作答</th></tr></thead><tbody><tr v-for="record in records" :key="record.learningDate"><th scope="row">{{ record.learningDate }}</th><td>{{ record.trainingCount }}</td><td>{{ record.answerCount }}</td><td>{{ record.completedCount }}</td><td v-if="showRecalled">{{ record.recalledCount }}</td><td>{{ record.studiedCount }}</td><td>{{ record.hasLearningActivity ? '有' : '无' }}</td><td>{{ record.hasRecordedAnswers ? '有' : '无' }}</td></tr></tbody></table></div></details>
    </template><p v-else class="trend-empty" role="status">暂无可展示的趋势数据。</p>
  </figure>
</template>
