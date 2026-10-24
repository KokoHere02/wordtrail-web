<script setup lang="ts">
import { nextTick, onMounted, ref, watch, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useDictationSession } from '../../composables/useDictationSession';
import ReviewHeader from '../../components/learning/ReviewHeader.vue';
import AppButton from '../../components/ui/AppButton.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
import LetterInput from '../../components/learning/LetterInput.vue';
import { useStudySurface } from '../../composables/useStudySurface';
const props = defineProps<{ requestedBatchId?: number }>();
const surface = useStudySurface();
const session = useDictationSession(useAuthStore().user!.id, props.requestedBatchId ?? Number(useRoute().params.batchId));
const { progress, question, answer, pending, input, loading, saving, busy, error, validation, recoverable, blocked, canAnswer, canNext } = session;
const inputElement = ref<InstanceType<typeof LetterInput>>();
const nextButton = ref<HTMLButtonElement>();
watch([question, answer, busy], async () => {
  await nextTick();
  if (busy.value || surface && !surface.active.value) return;
  if (answer.value) nextButton.value?.focus();
  else if (question.value && !pending.value) inputElement.value?.focus();
});
onMounted(session.load);
watchEffect(() => { if (surface) surface.state.source = progress.value ? `默写任务 #${progress.value.batchId}` : '计划词默写'; });
</script>
<template>
  <div class="review-page learning-page dictation-study">
    <ReviewHeader :completed="progress?.completedCount || 0" :total="progress?.totalCount || 0" back-to="/dictation" label="单词默写" />
    <div class="learning-main">
      <StatePanel :loading="loading" />
      <div v-if="progress?.status === 'COMPLETED' && !question && !answer" class="workspace-start"><h2>本轮已完成</h2><RouterLink :to="`/dictation/${progress.batchId}/result`" class="btn btn-secondary">查看结果</RouterLink></div>
      <div v-if="error" class="learning-error dictation-error" role="alert"><p>{{ error }}</p><button v-if="pending && !blocked" class="violet-link" :disabled="busy" @click="session.retry">重试原请求</button><button v-else-if="recoverable && !blocked" class="violet-link" :disabled="busy" @click="session.load">重新获取题目</button><RouterLink to="/dictation" class="violet-link">返回默写记录</RouterLink></div>
      <section v-if="question || answer" class="learning-card dictation-card" :aria-busy="busy">
        <template v-if="!answer && question"><h1>根据释义拼写英文</h1><p class="subtle-copy">第 {{ question.nextAttemptNo }} 次 / 上限 {{ question.attemptLimit }} 次 · 连续命中 {{ question.correctStreak }} / {{ question.requiredCorrectStreak }} 次</p><WordMeaning class="dictation-prompt" layout="study" :word-key="question.presentationId" :translation="question.prompt" :translation-groups="question.promptGroups" />
          <form class="dictation-answer-form" @submit.prevent="session.submit('ANSWER')"><LetterInput id="dictation-input" ref="inputElement" v-model="input" label="英文拼写" :disabled="!canAnswer" :invalid="!!validation" described-by="dictation-validation" @submit="session.submit('ANSWER')" /><p v-if="validation" id="dictation-validation" class="inline-error" role="alert">{{ validation }}</p><div class="live-actions"><AppButton type="submit" :busy="saving" :disabled="!canAnswer">提交答案</AppButton><AppButton variant="secondary" :disabled="!canAnswer" @click="session.submit('REVEAL')">不会／看答案</AppButton></div></form>
        </template>
        <div v-else-if="answer" class="dictation-feedback" aria-live="polite"><p :class="['dictation-verdict', { 'is-match': answer.verdict === 'CORRECT' }]">{{ answer.verdict === 'CORRECT' ? '拼写命中' : answer.verdict === 'INCORRECT' ? '未命中本题目标词' : '已查看答案' }}</p><h1 class="dictation-expected" lang="en">{{ answer.expectedWord }}</h1><p v-if="answer.submittedAnswer !== null" class="dictation-submitted">你的输入：<span lang="en">{{ answer.submittedAnswer }}</span></p><WordMeaning layout="study" :word-key="answer.logId" :translation="answer.translation" :translation-groups="answer.translationGroups" /><p v-if="answer.completionReason === 'LIMIT_REACHED'" class="dictation-feedback-note">本轮结束，仍需巩固。</p><p v-else-if="answer.itemStatus === 'DONE' && answer.completionReason === 'RECALLED'" class="dictation-feedback-note">本词通过本轮验证。</p><p v-else class="dictation-feedback-note">仍需继续验证 · 本次后连续命中 {{ answer.correctStreak }} 次</p><p class="subtle-copy">本词第 {{ answer.attemptNo }} 次尝试 · 本轮共尝试 {{ progress?.attemptCount }} 次</p><button ref="nextButton" type="button" class="btn btn-primary dictation-next" :disabled="!canNext" @click="session.next">{{ progress?.status === 'COMPLETED' ? '查看默写结果' : '隐藏答案，下一题' }}</button></div>
      </section>
      <p class="dictation-scope-note subtle-copy">默写不抵扣每日目标，不影响长期复习安排。</p>
    </div>
  </div>
</template>
