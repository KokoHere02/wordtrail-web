<script setup lang="ts">
import { ref, watch } from 'vue';
import { dictationApi } from '../../api/dictation';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { DictationHistory } from '../../types/dictation';
import AppPagination from '../ui/AppPagination.vue';
import StatePanel from '../ui/StatePanel.vue';
import { Check, Eye, X } from 'lucide-vue-next';
const props = defineProps<{ wordId: number }>();
const { data, loading, error, load } = useResource<Page<DictationHistory>>();
const page = ref(1);
const size = 10;
const labels = { CORRECT: '正确', INCORRECT: '错误', REVEALED: '未答' };
const refresh = () => load(() => dictationApi.history(props.wordId, { page: page.value, size }));
watch(() => props.wordId, () => { page.value = 1; void refresh(); }, { immediate: true });
function changePage(value: number) { page.value = value; void refresh(); }
</script>
<template>
  <section class="dictation-history-list" aria-label="默写事件">
    <StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="暂无已记录的默写事件，不能据此推算其他学习历史。" @retry="refresh" />
    <template v-if="!loading && !error"><article v-for="event in data?.records" :key="event.logId" :class="['history-event', 'dictation-history-event', 'word-history-event', `is-${event.verdict.toLowerCase()}`]"><header class="word-history-event-heading"><span class="word-history-mark"><Check v-if="event.verdict === 'CORRECT'" :size="17" aria-hidden="true" /><X v-else-if="event.verdict === 'INCORRECT'" :size="17" aria-hidden="true" /><Eye v-else :size="17" aria-hidden="true" /></span><div><strong>{{ labels[event.verdict] }}</strong><span class="word-history-event-kind">独立默写</span></div><time :datetime="event.answeredAt">{{ event.answeredAt.replace('T', ' ') }}</time></header><dl class="dictation-history-input"><div><dt>正确拼写</dt><dd lang="en">{{ event.expectedWord }}</dd></div><div><dt>你的输入</dt><dd>{{ event.action === 'REVEAL' ? '未答，查看了答案' : event.input || '未输入' }}</dd></div></dl></article></template>
    <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="changePage" />
  </section>
</template>
