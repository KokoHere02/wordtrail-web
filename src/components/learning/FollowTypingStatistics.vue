<script setup lang="ts">
import { ref, watch } from 'vue';
import { followTypingApi, type FollowTypingStatistics } from '../../api/followTyping';
import { useResource } from '../../composables/useResource';
import StatePanel from '../ui/StatePanel.vue';
const props = defineProps<{ revision?: number }>();
const date = ref('');
const { data, loading, error, load } = useResource<FollowTypingStatistics>();
const refresh = () => load(() => followTypingApi.statistics(date.value || undefined));
watch([date, () => props.revision], refresh, { immediate: true });
</script>
<template>
  <section class="follow-date-statistics" aria-label="独立跟拼日期统计">
    <header><div><h2>独立跟拼统计</h2><p v-if="data">{{ data.learningDate }} · 当日所有跟拼轮次汇总</p></div><label>统计日期<input v-model="date" type="date" /></label></header>
    <StatePanel :loading="loading" :error="error" @retry="refresh" />
    <dl v-if="data && !loading && !error"><div><dt>输入次数</dt><dd>{{ data.answerCount }}</dd></div><div><dt>正确次数</dt><dd>{{ data.correctCount }}</dd></div><div><dt>输入正确率</dt><dd>{{ data.inputAccuracy === null ? '—' : `${(data.inputAccuracy * 100).toFixed(1)}%` }}</dd></div><div><dt>练习词数</dt><dd>{{ data.practicedWordCount }}</dd></div><div><dt>完成词数</dt><dd>{{ data.completedWordCount }}</dd></div></dl>
    <p v-if="data?.lastPracticedAt && !loading" class="subtle-copy">最近输入 {{ data.lastPracticedAt.replace('T', ' ') }}（北京时间）</p>
  </section>
</template>
