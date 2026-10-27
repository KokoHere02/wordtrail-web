<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { usePracticeSession } from '../../composables/usePracticeSession';
import { useLearningKeys } from '../../composables/useLearningKeys';
import LearningCard from '../../components/learning/LearningCard.vue';
import LearningControls from '../../components/learning/LearningControls.vue';
import ReviewHeader from '../../components/learning/ReviewHeader.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import { useStudySurface } from '../../composables/useStudySurface';
import type { Result } from '../../types/api';
const props = defineProps<{ requestedBatchId?: number }>();
const surface = useStudySurface();
const session = usePracticeSession(props.requestedBatchId ?? Number(useRoute().params.batchId));
const { progress, current, answer, bookName, loading, busy, loadError, error, pending, syncAvailable, isPast, reveal, canRate, canPrevious, canNext, canCorrect } = session;
const { visible, definition, loading: revealLoading, error: revealError } = reveal;
const card = ref<InstanceType<typeof LearningCard>>();
const displayKey = computed(() => isPast.value ? `past:${session.history.selected.value?.key}` : `live:${session.item.value?.itemId}`);
function revealMeaning() { if (current.value && !busy.value) return reveal.reveal(); }
function pronounce() { if (current.value && !busy.value) card.value?.pronounce(); }
watchEffect(() => { if (surface) surface.state.source = bookName.value; });
async function rate(result: Result) { await session.rate(result); if (surface?.active.value && !pending.value && !error.value && answer.value) await session.next(); }
async function retry() { await session.retry(); if (surface?.active.value && !pending.value && !error.value && answer.value) await session.next(); }
useLearningKeys({ reveal: revealMeaning, pronounce, rate: result => card.value?.rate(result), previous: session.previous, next: session.next, correct: () => card.value?.openCorrection(), cancelCorrection: () => card.value?.cancelCorrection() });
</script>
<template>
  <div class="review-page learning-page practice-review-page">
    <ReviewHeader :completed="progress?.answeredCount || 0" :total="progress?.wordCount || 0" back-to="/learning" label="认识专项" :description="bookName" />
    <div class="learning-main"><div v-if="surface?.state.settings" class="workspace-configuration live-actions"><RouterLink to="/learn?mode=recognition&amp;daily=1" class="muted-link">返回每日计划</RouterLink><RouterLink to="/weak-words" class="muted-link">专项选词</RouterLink></div>
      <StatePanel :loading="loading && !current" :error="loadError" @retry="session.load" />
      <div v-if="progress?.status === 'COMPLETED' && !current" class="workspace-start"><h2>本轮已完成</h2><RouterLink :to="`/learning/${progress.batchId}/result`" class="btn btn-secondary">查看结果</RouterLink></div>
      <p v-if="current" class="study-position sr-only">第 {{ current.sortOrder }} 个 / 共 {{ progress?.wordCount }} 个</p>
      <div v-if="error" class="learning-error form-error" role="alert"><p>{{ error }}</p><button v-if="pending && !syncAvailable" class="violet-link" :disabled="busy" @click="retry">重试原请求</button><button v-if="syncAvailable" class="violet-link" :disabled="busy" @click="session.load">按最新进度恢复</button></div>
      <template v-if="current && !loadError">
        <LearningCard ref="card" :word="current.word" :word-id="current.wordId" :phonetic="current.phonetic" :word-key="displayKey" variant="practice" :visible="visible" :definition="definition" :reveal-loading="revealLoading" :reveal-error="revealError" :busy="busy" :rate-disabled="!canRate || revealLoading" :result="answer?.result" :past="isPast" :can-correct="canCorrect" @reveal="revealMeaning" @rate="rate" @correct="session.correct" />
        <LearningControls :previous-disabled="!canPrevious" :next-disabled="!canNext" :final="!isPast && progress?.status === 'COMPLETED'" @previous="session.previous" @next="session.next" />
      </template>
    </div>
  </div>
</template>
