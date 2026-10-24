<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { sentencesApi } from '../../api/sentences';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { SentenceProgress, SentenceSessionStatus } from '../../types/sentences';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
const { data, loading, error, load } = useResource<Page<SentenceProgress>>();
const status = ref<SentenceSessionStatus>('IN_PROGRESS');
const page = ref(1);
const size = 10;
const sourceNames = { BANK: '题库', FAVORITES: '收藏', REVIEW: '待巩固', DUE: '到期复习' };
const refresh = () => load(() => sentencesApi.sessions({ page: page.value, size, status: status.value }));
watch(status, () => { if (page.value !== 1) page.value = 1; else void refresh(); });
watch(page, refresh);
onMounted(refresh);
</script>
<template>
  <div class="wordlist-page sentence-records"><header class="library-heading"><h1>句子练习记录</h1><button class="muted-link" :disabled="loading" @click="refresh">刷新练习</button></header><div class="category-tabs" role="group" aria-label="句子练习状态"><button :class="{ active: status === 'IN_PROGRESS' }" :aria-pressed="status === 'IN_PROGRESS'" @click="status = 'IN_PROGRESS'">进行中</button><button :class="{ active: status === 'COMPLETED' }" :aria-pressed="status === 'COMPLETED'" @click="status = 'COMPLETED'">已完成</button></div><StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="暂无这个状态的句子练习。" @retry="refresh" /><article v-for="session in !loading && !error ? data?.records : []" :key="session.sessionId" class="sentence-session-row"><div><h2>{{ sourceNames[session.selectionSource] }}练习</h2><p class="subtle-copy">{{ session.createdAt.replace('T', ' ') }}</p><p>完成 {{ session.completedCount }} / {{ session.totalCount }} 句 · 已提交 {{ session.submissionCount }} · 已自评 {{ session.selfReviewCount }}</p></div><RouterLink :to="`/sentences/sessions/${session.sessionId}${session.status === 'COMPLETED' ? '/result' : ''}`" class="btn btn-secondary">{{ session.status === 'COMPLETED' ? '查看本轮结果' : '继续练习' }}</RouterLink></article><AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" noun="轮" @change="page = $event" /></div>
</template>
