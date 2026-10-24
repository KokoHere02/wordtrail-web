<script setup lang="ts">
import { computed, onMounted, ref, watchEffect, watch, nextTick } from 'vue';
import { dailyApi } from '../../../api/daily';
import { useResource } from '../../../composables/useResource';
import { useStudySurface } from '../../../composables/useStudySurface';
import type { Page } from '../../../types/api';
import type { PlanWord } from '../../../types/daily';
import LetterInput from '../../../components/learning/LetterInput.vue';
import WordMeaning from '../../../components/word/WordMeaning.vue';
import WordPronunciation from '../../../components/word/WordPronunciation.vue';
import StatePanel from '../../../components/ui/StatePanel.vue';
const surface = useStudySurface()!;
const { data, loading, error, load } = useResource<Page<PlanWord>>();
const count = ref(10), index = ref(0), input = ref(''), phase = ref<'COPY' | 'RECALL' | 'FEEDBACK'>('COPY');
const feedback = ref(''), started = ref(false), completed = ref(0);
const letterField = ref<InstanceType<typeof LetterInput>>();
const nextControl = ref<HTMLButtonElement>();
const current = computed(() => data.value?.records[index.value]);
const finished = computed(() => started.value && !!data.value?.records.length && index.value >= data.value.records.length);
const refresh = () => load(() => dailyApi.plan({ page: 1, size: count.value, status: 'ACTIVE', learningStatus: 'ALL', sortBy: 'joined_at', direction: 'DESC' }));
async function start() {
  if (loading.value || !Number.isInteger(count.value) || count.value < 1 || count.value > 100) { feedback.value = '本轮为 1～100 词。'; return; }
  await refresh(); if (!data.value || error.value) return;
  index.value = 0; completed.value = 0; input.value = ''; feedback.value = ''; phase.value = 'COPY'; started.value = true; surface.state.settings = data.value.records.length === 0;
}
function submit() {
  if (!current.value || !input.value || loading.value) return;
  if (input.value !== current.value.word) { feedback.value = '与原词拼写不同，请再检查一次。'; return; }
  feedback.value = '';
  if (phase.value === 'COPY') { phase.value = 'RECALL'; input.value = ''; }
  else if (phase.value === 'RECALL') { phase.value = 'FEEDBACK'; completed.value++; }
}
function next() { index.value++; input.value = ''; feedback.value = ''; phase.value = 'COPY'; }
watch([phase, index, started, current], async () => { await nextTick(); if (!surface.active.value) return; if (phase.value === 'FEEDBACK') nextControl.value?.focus(); else letterField.value?.focus(); });
watchEffect(() => Object.assign(surface.state, { source: '长期计划 · 本地跟练', completed: completed.value, total: started.value ? data.value?.records.length || 0 : 0, remaining: started.value ? Math.max(0, (data.value?.records.length || 0) - completed.value) : 0 }));
onMounted(() => { surface.state.settings = true; });
</script>
<template>
  <div class="guided-spelling"><form v-show="surface.state.settings" class="workspace-configuration workspace-setting-fields" novalidate @submit.prevent="start"><label>本轮词数<input v-model.number="count" type="number" min="1" max="100" /></label><span class="subtle-copy">启用的长期计划词 · 跟练仅保留在本次页面，不写入每日或默写统计</span><button class="btn btn-primary" :disabled="loading">开始跟练</button></form><p v-if="feedback &amp;&amp; (!current || !started)" class="inline-error" role="alert">{{ feedback }}</p><StatePanel :loading="loading" :error="error" :empty="started && data?.records.length === 0" message="计划中暂无可跟练的单词。" @retry="start" />
    <div v-if="current && started && !loading" class="guided-spelling-body"><div class="guided-stages"><span :class="{ active: phase === 'COPY' }">跟写单词</span><span aria-hidden="true">→</span><span :class="{ active: phase !== 'COPY' }">独立拼写</span></div><template v-if="phase === 'COPY' || phase === 'FEEDBACK'"><div class="guided-word-heading"><h2 class="guided-original" lang="en">{{ current.word }}</h2><WordPronunciation :word="current.word" /></div></template><h2 v-else class="guided-recall-title">再独立拼写一次</h2><WordMeaning :translation="current.translation" :translation-groups="current.translationGroups" /><form v-if="phase !== 'FEEDBACK'" @submit.prevent="submit"><LetterInput id="guided-spelling-input" ref="letterField" v-model="input" :length="Array.from(current.word).length" :label="phase === 'COPY' ? '照着上方单词拼写' : '不看原词，独立拼写'" @submit="submit" /><div class="workspace-answer-actions"><span class="subtle-copy">{{ phase === 'COPY' ? '完成跟写后，隐藏原词再默写一次' : 'Enter 检查拼写' }}</span><button class="btn btn-primary" :disabled="!input">{{ phase === 'COPY' ? '继续 →' : '检查拼写 →' }}</button></div></form><div v-else class="workspace-answer-actions"><span>已完成本词跟练</span><button ref="nextControl" class="btn btn-primary" @click="next">下一个 →</button></div><p v-if="feedback" class="inline-error" role="alert">{{ feedback }}</p></div><div v-else-if="finished" class="workspace-start"><h2>本轮跟练完成</h2><p>共 {{ completed }} 词。本地跟练不改变复习调度。</p><button class="btn btn-secondary" @click="surface.state.settings = true">重新选词</button></div>
  </div>
</template>
