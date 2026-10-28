<script setup lang="ts">
import { ref } from 'vue';
import { sentenceLinksApi } from '../../api/sentenceLinks';
import { useSentenceLaunch } from '../../composables/useSentenceLaunch';
import type { SentenceDifficulty } from '../../types/sentences';
import SentenceLaunchNotice from './SentenceLaunchNotice.vue';
const props = defineProps<{ wordIds: number[]; disabled?: boolean }>();
const count = ref(10);
const difficulty = ref<SentenceDifficulty | ''>('');
const validation = ref('');
const creation = useSentenceLaunch();
const { busy, uncertain, created, error } = creation;
async function start() {
  if (props.disabled || busy.value || uncertain.value || created.value) return;
  const ids = [...new Set(props.wordIds)];
  if (!ids.length || ids.length > 100 || !Number.isInteger(count.value) || count.value < 1 || count.value > 50) { validation.value = '请选择 1～100 个不同单词，句子数量须为 1～50。'; return; }
  validation.value = '';
  const body = { wordIds: ids, count: count.value, ...(difficulty.value ? { difficulty: difficulty.value } : {}) };
  await creation.launch(() => sentenceLinksApi.practice(body));
}
</script>
<template>
  <div class="word-sentence-practice"><form class="sentence-launch-actions" @submit.prevent="start"><label>句子数量<input v-model.number="count" type="number" min="1" max="50" :disabled="disabled || busy || uncertain || !!created" /><span>句</span></label><label>难度<select v-model="difficulty" :disabled="disabled || busy || uncertain || !!created"><option value="">全部</option><option :value="1">基础</option><option :value="2">进阶</option><option :value="3">挑战</option></select></label><button class="btn btn-primary" :disabled="disabled || busy || uncertain || !!created || !wordIds.length || wordIds.length > 100">{{ busy ? '创建中…' : '练习关联句子' }}</button></form><p v-if="validation" class="inline-error" role="alert">{{ validation }}</p><SentenceLaunchNotice :error="error" :uncertain="uncertain" :session-id="created?.sessionId" /></div>
</template>
