<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { SentenceStatisticsDay } from '../../types/sentences';
const props = defineProps<{ records: SentenceStatisticsDay[] }>();
const selected = ref(0);
const plot = ref<SVGSVGElement>();
const width = 720, height = 208, inset = 10;
const ceiling = computed(() => Math.ceil(Math.max(2, ...props.records.flatMap(row => [row.submissionCount, row.selfReviewCount])) / 2) * 2);
const ticks = computed(() => [ceiling.value, ceiling.value / 2, 0]);
const active = computed(() => props.records[selected.value]);
const x = (index: number) => props.records.length <= 1 ? width / 2 : inset + index * (width - 2 * inset) / (props.records.length - 1);
const y = (value: number) => height - inset - value / ceiling.value * (height - 2 * inset);
const submissions = computed(() => props.records.map((row, index) => `${x(index)},${y(row.submissionCount)}`).join(' '));
const reviews = computed(() => props.records.map((row, index) => `${x(index)},${y(row.selfReviewCount)}`).join(' '));
const step = computed(() => props.records.length <= 1 ? width : (width - 2 * inset) / (props.records.length - 1));
const dateLabels = computed(() => props.records.filter((_, index) => props.records.length <= 7 || [0, Math.round((props.records.length - 1) / 2), props.records.length - 1].includes(index)));
const allZero = computed(() => props.records.length > 0 && props.records.every(row => row.submissionCount === 0 && row.selfReviewCount === 0));
watch(() => props.records, () => { selected.value = Math.max(0, props.records.length - 1); }, { immediate: true });
async function keyboard(event: KeyboardEvent, index: number) {
  let next = index;
  if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
  else if (event.key === 'ArrowRight') next = Math.min(props.records.length - 1, index + 1);
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = props.records.length - 1;
  else if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault(); selected.value = next; await nextTick();
  plot.value?.querySelectorAll<SVGElement>('[data-sentence-day]')[next]?.focus();
}
</script>
<template>
  <figure class="learning-trend-chart sentence-trend-chart"><figcaption class="trend-legend"><span><i class="trend-key completed" />提交数</span><span><i class="trend-key answers" />自评完成数</span></figcaption>
    <template v-if="records.length"><div class="trend-plot"><div class="trend-y-axis" aria-hidden="true"><span v-for="tick in ticks" :key="tick">{{ tick }}</span></div><svg ref="plot" :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none" role="group" aria-label="每日句子提交与自评趋势"><line v-for="tick in ticks" :key="tick" :x1="0" :x2="width" :y1="y(tick)" :y2="y(tick)" class="trend-grid-line" /><polyline :points="submissions" class="trend-series completed" /><polyline :points="reviews" class="trend-series answers" /><g v-for="(row, index) in records" :key="row.learningDate" :data-sentence-day="index" role="button" :tabindex="selected === index ? 0 : -1" :aria-pressed="selected === index" :aria-label="`${row.learningDate}，提交 ${row.submissionCount}，输入译文 ${row.answerCount}，直接查看解析 ${row.revealCount}，自评完成 ${row.selfReviewCount}`" @pointerenter="selected = index" @focus="selected = index" @click="selected = index" @keydown="keyboard($event, index)"><rect :x="Math.max(0, x(index) - step / 2)" :y="0" :width="Math.min(step, width)" :height="height" class="trend-hit-area" /><line v-if="selected === index" :x1="x(index)" :x2="x(index)" :y1="inset" :y2="height - inset" class="trend-selected-line" /><circle :cx="x(index)" :cy="y(row.submissionCount)" :r="selected === index ? 4 : 2" class="trend-point completed" /><circle :cx="x(index)" :cy="y(row.selfReviewCount)" :r="selected === index ? 4 : 2" class="trend-point answers" /></g></svg></div>
      <div class="sentence-date-labels" aria-hidden="true"><span v-for="row in dateLabels" :key="row.learningDate">{{ row.learningDate.slice(5) }}</span></div>
      <div v-if="active" class="trend-readout" aria-live="polite"><time :datetime="active.learningDate">{{ active.learningDate }}</time><span>提交 <strong>{{ active.submissionCount }}</strong></span><span>输入译文 <strong>{{ active.answerCount }}</strong></span><span>直接查看解析 <strong>{{ active.revealCount }}</strong></span><span>自评完成 <strong>{{ active.selfReviewCount }}</strong></span></div>
      <p v-if="allZero" class="trend-zero-note">本区间暂无提交或自评记录。</p><details class="trend-data-table"><summary>查看逐日数据</summary><div class="trend-table-scroll"><table><caption class="sr-only">句子练习逐日统计</caption><thead><tr><th scope="col">日期</th><th scope="col">提交</th><th scope="col">输入译文</th><th scope="col">直接查看解析</th><th scope="col">自评完成</th></tr></thead><tbody><tr v-for="row in records" :key="row.learningDate"><th scope="row">{{ row.learningDate }}</th><td>{{ row.submissionCount }}</td><td>{{ row.answerCount }}</td><td>{{ row.revealCount }}</td><td>{{ row.selfReviewCount }}</td></tr></tbody></table></div></details>
    </template><p v-else class="trend-empty" role="status">暂无趋势数据。</p>
  </figure>
</template>
