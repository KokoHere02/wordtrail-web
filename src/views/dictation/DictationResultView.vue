<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { dictationApi } from '../../api/dictation';
import { ApiError } from '../../api/http';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { DictationTask, DictationWord } from '../../types/dictation';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import DictationStats from '../../components/learning/DictationStats.vue';
import DictationWordRows from '../../components/learning/DictationWordRows.vue';
const id = Number(useRoute().params.batchId);
const summary = useResource<DictationTask>();
const words = useResource<Page<DictationWord>>();
const page = ref(1);
const size = 10;
async function loadWords() {
  if (summary.data.value?.status !== 'COMPLETED') return;
  await words.load(async () => {
    try { return await dictationApi.resultWords(id, { page: page.value, size }); }
    catch (value) { if (value instanceof ApiError && value.code === 'DICTATION_NOT_COMPLETED') await summary.load(() => dictationApi.task(id)); throw value; }
  });
}
async function refresh() {
  await summary.load(() => dictationApi.task(id));
  if (!summary.error.value && summary.data.value?.status === 'COMPLETED') await loadWords();
}
function changePage(value: number) { page.value = value; void loadWords(); }
onMounted(refresh);
</script>
<template>
  <div class="wordlist-page dictation-result"><header class="library-heading"><div><h1>默写结果</h1></div><RouterLink to="/dictation" class="muted-link">默写记录</RouterLink></header><StatePanel :loading="summary.loading.value" :error="summary.error.value" @retry="refresh" />
    <template v-if="summary.data.value && !summary.loading.value && !summary.error.value"><template v-if="summary.data.value.status === 'COMPLETED'"><DictationStats :task="summary.data.value" /><p class="subtle-copy">完成指本轮流程结束；尝试包含拼写提交与查看答案。</p><div class="live-actions dictation-result-actions"><RouterLink to="/dictation/mistakes" class="btn btn-primary">去默写错词重练</RouterLink><RouterLink to="/dictation" class="btn btn-secondary">继续选题</RouterLink></div><h2>本轮单词</h2><StatePanel :loading="words.loading.value" :error="words.error.value" :empty="words.data.value?.total === 0" message="本轮暂无可回顾的单词。" @retry="loadWords" /><DictationWordRows v-if="words.data.value && !words.loading.value && !words.error.value" :records="words.data.value.records" /><AppPagination v-if="words.data.value" :page="page" :size="size" :total="words.data.value.total" :disabled="words.loading.value" @change="changePage" /></template><div v-else class="library-empty"><h2>{{ summary.data.value.status === 'ABANDONED' ? '本轮已放弃' : '本轮尚未结束' }}</h2><RouterLink v-if="summary.data.value.status === 'IN_PROGRESS'" :to="`/dictation/${id}`" class="btn btn-primary">继续默写</RouterLink></div></template>
  </div>
</template>
