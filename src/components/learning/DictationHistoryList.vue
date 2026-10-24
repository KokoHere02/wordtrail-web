<script setup lang="ts">
import { ref, watch } from 'vue';
import { dictationApi } from '../../api/dictation';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { DictationHistory } from '../../types/dictation';
import AppPagination from '../ui/AppPagination.vue';
import StatePanel from '../ui/StatePanel.vue';
const props = defineProps<{ wordId: number }>();
const { data, loading, error, load } = useResource<Page<DictationHistory>>();
const page = ref(1);
const size = 10;
const labels = { CORRECT: '拼写命中', INCORRECT: '未命中本题目标词', REVEALED: '查看答案' };
const refresh = () => load(() => dictationApi.history(props.wordId, { page: page.value, size }));
watch(() => props.wordId, () => { page.value = 1; void refresh(); }, { immediate: true });
function changePage(value: number) { page.value = value; void refresh(); }
</script>
<template>
  <section class="dictation-history-list" aria-label="默写事件">
    <StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="暂无已记录的默写事件，不能据此推算其他学习历史。" @retry="refresh" />
    <template v-if="!loading && !error"><article v-for="event in data?.records" :key="event.logId" class="history-event dictation-history-event"><div class="live-actions"><span class="learning-badge">单词默写</span><strong>{{ labels[event.verdict] }}</strong></div><p>{{ event.answeredAt.replace('T', ' ') }} · 第 {{ event.attemptNo }} 次尝试</p><p>目标词：<span lang="en">{{ event.expectedWord }}</span></p><p>{{ event.action === 'REVEAL' ? '本次查看答案' : `输入：${event.input ?? ''}` }}</p><p>连续命中 {{ event.correctStreakBefore }} → {{ event.correctStreakAfter }}</p><p v-if="event.completionReason === 'LIMIT_REACHED'">本轮结束，仍需巩固。</p><details class="copy-note"><summary>事件详情</summary><p>事件 #{{ event.logId }} · 批次 #{{ event.batchId }} · 学习日 {{ event.learningDate }}</p><p>不影响每日目标或长期安排</p></details></article></template>
    <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="changePage" />
  </section>
</template>
