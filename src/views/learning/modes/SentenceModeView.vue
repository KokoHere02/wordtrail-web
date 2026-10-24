<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { sentencesApi } from '../../../api/sentences';
import { useResource } from '../../../composables/useResource';
import { useSentenceLaunch } from '../../../composables/useSentenceLaunch';
import { useStudyWorkspace } from '../../../stores/studyWorkspace';
import { useStudySurface } from '../../../composables/useStudySurface';
import type { Page } from '../../../types/api';
import type { SentenceSource, SentenceDifficulty, SentenceProgress } from '../../../types/sentences';
import SentenceStudyView from '../../sentences/SentenceStudyView.vue';
import SentenceLaunchNotice from '../../../components/learning/SentenceLaunchNotice.vue';
import StatePanel from '../../../components/ui/StatePanel.vue';
const workspace = useStudyWorkspace(), surface = useStudySurface()!;
const source = ref<SentenceSource>('BANK'), count = ref(10), difficulty = ref<SentenceDifficulty | ''>('');
const validation = ref('');
const creation = useSentenceLaunch();
const { data, loading, error, load } = useResource<Page<SentenceProgress>>();
const refresh = () => load(() => sentencesApi.sessions({ page: 1, size: 10, status: 'IN_PROGRESS' }));
watch(() => surface.state.settings, open => { if (open && creation.created.value && !creation.busy.value && !creation.uncertain.value) { creation.created.value = undefined; creation.error.value = ''; } });
async function start() {
  if (creation.busy.value || creation.uncertain.value || creation.created.value) return;
  if (!Number.isInteger(count.value) || count.value < 1 || count.value > 50) { validation.value = '本轮为 1～50 句。'; return; }
  validation.value = '';
  await creation.launch({ source: source.value, count: count.value, ...(difficulty.value ? { difficulty: difficulty.value } : {}) });
  if (creation.created.value) surface.state.settings = false;
}
onMounted(() => { if (!workspace.sentenceId) void refresh(); });
</script>
<template>
  <div><form v-show="surface.state.settings" class="workspace-configuration workspace-setting-fields" @submit.prevent="start"><label>内容范围<select v-model="source" :disabled="creation.busy.value || creation.uncertain.value"><option value="BANK">句子题库</option><option value="FAVORITES">我的收藏</option><option value="REVIEW">待巩固句子</option><option value="DUE">到期复习</option></select></label><label>难度<select v-model="difficulty"><option value="">全部</option><option :value="1">入门</option><option :value="2">进阶</option><option :value="3">挑战</option></select></label><label>本轮句数<input v-model.number="count" type="number" min="1" max="50" /></label><button class="btn btn-primary" :disabled="creation.busy.value || creation.uncertain.value || !!creation.created.value">{{ creation.busy.value ? '创建中…' : '开始新一轮' }}</button><p v-if="validation" class="inline-error" role="alert">{{ validation }}</p><SentenceLaunchNotice :error="creation.error.value" :uncertain="creation.uncertain.value" :session-id="creation.created.value?.sessionId" /><RouterLink to="/sentences" class="muted-link">管理句子内容</RouterLink></form>
    <SentenceStudyView v-if="workspace.sentenceId" :key="workspace.sentenceId" :requested-session-id="workspace.sentenceId" /><div v-else class="workspace-start"><h2>读一句英文，写下你的理解</h2><button class="btn btn-secondary" @click="surface.state.settings = true">选择句子范围</button><StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="暂无进行中的句子练习。" @retry="refresh" /><article v-for="session in data?.records" :key="session.sessionId" class="workspace-resume-row"><span>{{ session.createdAt.replace('T', ' ') }} · {{ session.completedCount }} / {{ session.totalCount }} 句</span><RouterLink :to="`/sentences/sessions/${session.sessionId}`" class="muted-link">继续练习</RouterLink></article></div>
  </div>
</template>
