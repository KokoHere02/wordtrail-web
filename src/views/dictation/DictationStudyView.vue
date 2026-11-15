<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dictationApi } from '../../api/dictation';
import { errorMessage } from '../../api/http';
import { useStudyWorkspace } from '../../stores/studyWorkspace';
import AppDialog from '../../components/ui/AppDialog.vue';
import AppAlert from '../../components/ui/AppAlert.vue';
import { useAuthStore } from '../../stores/auth';
import { useDictationSession } from '../../composables/useDictationSession';
import { useRevealShortcut } from '../../composables/useRevealShortcut';
import ReviewHeader from '../../components/learning/ReviewHeader.vue';
import AppButton from '../../components/ui/AppButton.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
import LetterInput from '../../components/learning/LetterInput.vue';
import { useStudySurface } from '../../composables/useStudySurface';
import { useAudioPlayer } from '../../composables/useAudioPlayer';
import { usePronunciation } from '../../stores/pronunciation';
import { ArrowRight, Clock3, Volume2 } from 'lucide-vue-next';
const props = withDefaults(defineProps<{ requestedBatchId?: number; active?: boolean }>(), { active: true });
const surface = useStudySurface();
const router = useRouter();
const workspace = surface ? useStudyWorkspace() : undefined;
const batchId = props.requestedBatchId ?? Number(useRoute().params.batchId);
const session = useDictationSession(useAuthStore().user!.id, batchId);
const { progress, question, answer, pending, input, loading, saving, busy, error, validation, recoverable, blocked, readOnly, notice, canAnswer, canNext } = session;
const inputElement = ref<InstanceType<typeof LetterInput>>();
const nextButton = ref<HTMLButtonElement>();
const abandonOpen = ref(false), abandoning = ref(false), abandonError = ref('');
const remaining = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;
let deadlineTick = 0, expiryChecked = false;
const countdown = computed(() => `${String(Math.floor(remaining.value / 60)).padStart(2, '0')}:${String(remaining.value % 60).padStart(2, '0')}`);
watch(progress, value => {
  if (!value?.deadlineAt || value.status !== 'IN_PROGRESS') return;
  deadlineTick = Date.now() + value.remainingSeconds * 1000; expiryChecked = false;
  remaining.value = value.remainingSeconds;
});
async function abandon() {
  if (abandoning.value) return;
  abandoning.value = true; abandonError.value = '';
  try {
    const result = await dictationApi.abandon(batchId);
    abandonOpen.value = false;
    if (workspace) workspace.dictationId = undefined;
    await router.replace(result.status === 'COMPLETED' ? `/dictation/${result.batchId}/result` : '/dictation');
  } catch (value) { abandonError.value = errorMessage(value); }
  finally { abandoning.value = false; }
}
const pronunciation = usePronunciation();
const { play, stop, loading: audioLoading, speaking, error: audioError } = useAudioPlayer();
function pronounce() { if (question.value?.audioUrl && canAnswer.value && props.active && surface?.active.value !== false && !audioLoading.value) void play(question.value.audioUrl, pronunciation.value); }
function audioShortcut(event: KeyboardEvent) {
  if (!props.active || surface?.active.value === false || !canAnswer.value || !question.value?.audioUrl || event.repeat || event.isComposing || event.defaultPrevented || document.querySelector('[role="dialog"]')) return;
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); pronounce(); }
}
watch([() => question.value?.presentationId, () => props.active, () => surface?.active.value], () => { stop(); audioError.value = ''; });
onMounted(() => { document.addEventListener('keydown', audioShortcut); void pronunciation.load().catch(() => {}); timer = setInterval(() => { if (!deadlineTick || progress.value?.status !== 'IN_PROGRESS') return; remaining.value = Math.max(0, Math.ceil((deadlineTick - Date.now()) / 1000)); if (!remaining.value && !expiryChecked && !busy.value) { expiryChecked = true; void session.load(); } }, 1000); });
onBeforeUnmount(() => { document.removeEventListener('keydown', audioShortcut); if (timer) clearInterval(timer); });
useRevealShortcut(() => session.submit('REVEAL'), () => props.active && canAnswer.value);
watch([question, answer, busy, () => props.active], async () => {
  await nextTick();
  if (busy.value || !props.active || surface && !surface.active.value) return;
  if (answer.value) nextButton.value?.focus();
  else if (question.value && !pending.value) inputElement.value?.focus();
});
let initialized = false;
onMounted(async () => { await session.load(); initialized = true; });
watch(() => props.active && surface?.active.value !== false, active => { if (active && initialized && !busy.value) void session.load(); });
watchEffect(() => { if (surface) surface.state.source = progress.value ? `默写任务 #${progress.value.batchId}` : '计划词默写'; });
</script>
<template>
  <div class="review-page learning-page dictation-study">
    <ReviewHeader :completed="progress?.completedCount || 0" :total="progress?.totalCount || 0" back-to="/dictation" label="独立默写测验" />
    <div v-if="progress?.status === 'IN_PROGRESS'" class="dictation-round-controls"><span v-if="progress.deadlineAt" class="dictation-timer" role="timer"><Clock3 :size="17" aria-hidden="true" /><span>剩余时间</span><strong>{{ countdown }}</strong></span><button type="button" class="dictation-abandon-button" :disabled="busy" @click="abandonOpen = true">放弃本轮</button></div>
    <AppDialog v-model="abandonOpen" title="放弃本轮默写？" description="放弃后本轮不能继续，也不会作为完成的测验公布成绩。"><p v-if="abandonError" class="inline-error" role="alert">{{ abandonError }}</p><div class="live-actions"><button class="btn btn-secondary" :disabled="abandoning" @click="abandonOpen = false">继续默写</button><button class="btn btn-primary" :disabled="abandoning" @click="abandon">确认放弃</button></div></AppDialog>
    <div class="learning-main">
      <StatePanel :loading="loading" />
      <div v-if="progress?.status === 'COMPLETED' && !question && !answer && !readOnly && !pending" class="workspace-start"><h2>本轮已完成</h2><RouterLink :to="`/dictation/${progress.batchId}/result`" class="btn btn-secondary">查看结果</RouterLink></div>
      <div v-if="readOnly" class="workspace-start dictation-readonly"><h2>旧版默写记录</h2><p class="subtle-copy">仅供回顾，请新建测验。</p><div class="live-actions"><RouterLink :to="`/dictation/${progress?.batchId ?? requestedBatchId}/result`" class="btn btn-secondary">查看历史记录</RouterLink><RouterLink to="/dictation" class="btn btn-primary">新建测验</RouterLink></div></div>
      <p v-if="notice && !readOnly" class="dictation-submit-notice" role="status">{{ notice }}</p>
      <AppAlert v-if="error && !readOnly" class="learning-error dictation-error" :message="error"><template #actions><button v-if="pending && !blocked" class="violet-link" :disabled="busy" @click="session.retry">重试原请求</button><button v-else-if="recoverable && !blocked" class="violet-link" :disabled="busy" @click="session.load">重新获取题目</button><RouterLink to="/dictation" class="violet-link">返回默写记录</RouterLink></template></AppAlert>
      <section v-if="question || answer" class="learning-card dictation-card" :aria-busy="busy">
        <template v-if="!answer && question"><button v-if="question.audioUrl" type="button" class="btn btn-secondary dictation-audio" aria-keyshortcuts="Alt+P" title="播放发音（Alt + P）" :disabled="!canAnswer || audioLoading" :aria-pressed="speaking" @click="pronounce"><Volume2 :size="17" aria-hidden="true" />{{ audioLoading ? '音频加载中…' : speaking ? '重新播放' : '播放发音' }} <kbd aria-hidden="true">Alt + P</kbd></button>
          <WordMeaning class="dictation-prompt" layout="study" :word-key="question.presentationId" :translation="question.prompt" :translation-groups="question.promptGroups" full />
          <p v-if="audioError" class="inline-error" role="status">{{ audioError }}</p>
          <form class="dictation-answer-form" @submit.prevent="session.submit('ANSWER')"><LetterInput id="dictation-input" ref="inputElement" v-model="input" :pattern="question.answerPattern" label="英文拼写" :disabled="!canAnswer" :invalid="!!validation" described-by="dictation-validation" @submit="session.submit('ANSWER')" /><p v-if="question.answerPattern && /[^_]/.test(question.answerPattern)" class="subtle-copy">请同时输入空格和标点。</p><p v-if="validation" id="dictation-validation" class="inline-error" role="alert">{{ validation }}</p><div class="live-actions dictation-answer-actions"><AppButton variant="secondary" :disabled="!canAnswer" aria-keyshortcuts="F2" title="不会／看答案（F2）" @click="session.submit('REVEAL')">不会／看答案<kbd aria-hidden="true">F2</kbd></AppButton><AppButton type="submit" :busy="saving" :disabled="!canAnswer">提交答案<ArrowRight :size="17" aria-hidden="true" /></AppButton></div></form>
        </template>
        <div v-else-if="answer?.action === 'REVEAL'" class="dictation-feedback" aria-live="polite"><p class="dictation-verdict">未答 · 已查看答案</p><h1 v-if="answer.expectedWord" class="dictation-expected" lang="en">{{ answer.expectedWord }}</h1><WordMeaning layout="study" :word-key="answer.logId" :translation="answer.translation" :translation-groups="answer.translationGroups" full /><button ref="nextButton" type="button" class="btn btn-primary dictation-next" :disabled="!canNext" @click="session.next">{{ progress?.status === 'COMPLETED' ? '查看测验结果' : '下一题' }}</button></div>
      </section>
    </div>
  </div>
</template>
