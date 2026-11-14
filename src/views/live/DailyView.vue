<script setup lang="ts">
import { computed, onMounted, onActivated, onDeactivated, ref, watch, watchEffect, nextTick } from 'vue';
import { CircleX, Volume2 } from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth';
import { useDailyTraining } from '../../composables/useDailyTraining';
import { useLearningKeys } from '../../composables/useLearningKeys';
import { useRevealShortcut } from '../../composables/useRevealShortcut';
import { useStudySurface } from '../../composables/useStudySurface';
import { dailyModeLabels, type DailyStudyMode, type TrainingScope } from '../../types/dailyTraining';
import ReviewHeader from '../../components/learning/ReviewHeader.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
import WordLearningDetails from '../../components/learning/WordLearningDetails.vue';
import { useAudioPlayer } from '../../composables/useAudioPlayer';
import { usePronunciation } from '../../stores/pronunciation';
import { ordinaryAudioUrl } from '../../api/learningMedia';
import { wordsApi } from '../../api/words';
import { consolidationApi } from '../../api/consolidation';
import { errorMessage } from '../../api/http';
import { useStudyPreferences } from '../../stores/studyPreferences';
import LetterInput from '../../components/learning/LetterInput.vue';
import TrainingItems from '../../components/learning/TrainingItems.vue';
import { trainingStatusLabel } from '../../utils/trainingStatus';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppButton from '../../components/ui/AppButton.vue';
import { useStudyWorkspace } from '../../stores/studyWorkspace';
import { useDailyGoal } from '../../composables/useDailyGoal';

const props = defineProps<{ requestedBatchId?: number; scope?: TrainingScope }>();
const emit = defineEmits<{ mode: [mode: DailyStudyMode]; blocked: [value: boolean] }>();
const surface = useStudySurface(), workspace = useStudyWorkspace();
const session = useDailyTraining(useAuthStore().user!.id, props.scope);
const { task, today, question, mode, busy, error, notice, pending, expired, historical, input, definition,
  receipt, showingFeedback, canRate, canCorrect, extraItemId } = session;
const preferences = useStudyPreferences();
const viewActive = ref(true);
const { goal, refresh: refreshGoal } = useDailyGoal(() => today.value?.learningDate, () => task.value?.batchId);
const needsWords = computed(() => today.value?.needsMoreWords || session.noWords.value);
const outstanding = ref<boolean>(), outstandingError = ref(''), outstandingLoading = ref(false);
let outstandingToken = 0;
async function refreshOutstanding() {
  const token = ++outstandingToken; outstandingLoading.value = true; outstandingError.value = '';
  try { const result = await consolidationApi.issues({ page: 1, size: 1, category: 'ERROR' }); if (token === outstandingToken) outstanding.value = result.total > 0; }
  catch (e) { if (token === outstandingToken) { outstanding.value = undefined; outstandingError.value = errorMessage(e); } }
  finally { if (token === outstandingToken) outstandingLoading.value = false; }
}
watch([() => task.value?.status, () => task.value?.batchId], ([status]) => { if (props.scope === 'CONSOLIDATION' && status === 'COMPLETED') void refreshOutstanding(); }, { immediate: true });
watch([() => today.value?.learningDate, () => task.value?.batchId, () => task.value?.completedCount, () => task.value?.status, busy, viewActive, () => surface?.active.value], () => {
  if ((!props.scope || props.scope === 'DAILY') && today.value && !busy.value && !historical.value && viewActive.value && surface?.active.value !== false) void refreshGoal();
});
onActivated(() => { viewActive.value = true; });
onDeactivated(() => { viewActive.value = false; });
const pronunciation = usePronunciation();
const audioSettings = computed(() => pronunciation.loaded ? pronunciation.value : question.value?.pronunciation || pronunciation.value);
const { play, stop, speaking, loading: audioLoading, error: speechError } = useAudioPlayer(() => { void session.recoverPresentation(); });
const listeningHidden = computed(() => question.value?.mode === 'LISTEN_DICTATION' && !question.value.answerRevealed);
const audioSource = computed(() => {
  if (showingFeedback.value) return receipt.value?.wordId ? ordinaryAudioUrl(receipt.value.wordId) : undefined;
  const q = question.value;
  return q?.audioUrl || (q?.wordId && !listeningHidden.value ? ordinaryAudioUrl(q.wordId) : undefined);
});
const canPronounce = computed(() => viewActive.value && !!audioSource.value && !session.blocked.value && surface?.active.value !== false);
const canToggleMeaning = computed(() => !!question.value && !listeningHidden.value && !showingFeedback.value && !session.blocked.value);
const recognitionMeaningHidden = ref(false);
const meaningVisible = computed(() => !listeningHidden.value && preferences.showChinese && !!question.value && (question.value.mode !== 'RECOGNITION' || (!!definition.value && !recognitionMeaningHidden.value)));
let recognitionItemId: number | undefined;
watch(() => question.value?.itemId, id => { if (id !== undefined && id !== recognitionItemId) { recognitionItemId = id; recognitionMeaningHidden.value = false; } }, { flush: 'sync' });
const field = ref<InstanceType<typeof LetterInput>>();
const dictationNext = ref<HTMLButtonElement>();
const recognitionNext = ref<HTMLButtonElement>();
const ratings = [{ result: 3 as const, label: '不认识', key: 1 }, { result: 2 as const, label: '模糊', key: 2 }, { result: 1 as const, label: '认识', key: 3 }];
const recognitionPhonetics = ref<Record<number, string>>({});
watch(question, value => { if (value?.mode === 'RECOGNITION' && value.wordId) recognitionPhonetics.value[value.wordId] = value.phonetic || ''; }, { flush: 'sync' });
const recognitionPhonetic = computed(() => receipt.value?.wordId ? recognitionPhonetics.value[receipt.value.wordId] || '' : '');
const incorrect = computed(() => receipt.value?.verdict === 'INCORRECT');
const dictationFeedback = computed(() => showingFeedback.value && receipt.value?.mode === 'DICTATION' && receipt.value.input !== null);
const recognitionFeedback = computed(() => showingFeedback.value && receipt.value?.mode === 'RECOGNITION');
const feedbackPhonetic = ref('');
watch([dictationFeedback, () => receipt.value?.trainingId, () => receipt.value?.wordId], async ([visible, trainingId, wordId], _old, onCleanup) => {
  feedbackPhonetic.value = '';
  if (!visible || !trainingId || !wordId) return;
  let current = true;
  onCleanup(() => { current = false; });
  try { const word = await wordsApi.detail(wordId); if (current) feedbackPhonetic.value = word.phonetic || ''; }
  catch { /* Pronunciation details are optional and must not block the exercise. */ }
});
watch([dictationFeedback, busy, viewActive, () => surface?.active.value], ([show, saving, active, surfaceActive]) => {
  if (show && !saving && active && surfaceActive !== false) void nextTick(() => dictationNext.value?.focus({ preventScroll: true }));
}, { flush: 'post' });
watch([recognitionFeedback, busy, viewActive, () => surface?.active.value], ([show, saving, active, surfaceActive]) => {
  if (show && !saving && active && surfaceActive !== false) void nextTick(() => recognitionNext.value?.focus({ preventScroll: true }));
}, { flush: 'post' });
const inputReady = computed(() => !!question.value && question.value.mode !== 'RECOGNITION' && !showingFeedback.value && !session.blocked.value && viewActive.value && surface?.active.value !== false);
watch(inputReady, ready => { if (ready) field.value?.focus(); }, { flush: 'post' });
const correction = ref(false), itemsOpen = ref(false), itemsRevision = ref(0);
const feedbackLabel = computed(() => {
  const answer = receipt.value;
  if (!answer) return '';
  if (answer.mode === 'FOLLOW_TYPING' && answer.verdict === 'INCORRECT') return '跟拼输入有误，请对照单词继续练习';
  const action = answer.mode === 'RECOGNITION' ? ({ 1: '已记录：认识', 2: '已记录：模糊', 3: '已记录：不认识' })[answer.selfAssessment!]
    : answer.verdict === 'INCORRECT' ? '拼写错误' : '输入正确';
  return `${action} · ${answer.extraTraining ? '追加训练 · 原词项' : ''}${trainingStatusLabel(answer)}`;
});
let syncPending = false;
async function sync() {
  if (busy.value) { syncPending = true; return; }
  syncPending = false;
  await session.open(props.requestedBatchId);
  emit('mode', mode.value);
  if (props.scope !== 'CONSOLIDATION' && workspace.extraDailyItemId && !busy.value && !pending.value) {
    const itemId = workspace.extraDailyItemId; workspace.extraDailyItemId = undefined;
    await session.extra(itemId);
  }
}
function reveal() { preferences.showChinese = true; recognitionMeaningHidden.value = false; if (!showingFeedback.value && question.value && !question.value.answerRevealed) return session.action('REVEAL'); }
useRevealShortcut(reveal, () => !session.blocked.value && !showingFeedback.value && !!question.value && (!question.value.answerRevealed || (question.value.mode === 'RECOGNITION' && recognitionMeaningHidden.value)));
function toggleMeaning() {
  if (!canToggleMeaning.value) return;
  if (question.value?.mode === 'RECOGNITION' && (!definition.value || recognitionMeaningHidden.value)) return reveal();
  preferences.showChinese = !preferences.showChinese;
}
function next() { if (showingFeedback.value) session.continueTraining(); }
function pronounce() {
  if (!canPronounce.value || !audioSource.value || audioLoading.value) return;
  void play(audioSource.value, audioSettings.value);
}
let autoAttempt = '';
watch([() => question.value?.presentationId, showingFeedback, busy, viewActive, () => surface?.active.value,
  () => audioSettings.value.autoPlay, () => audioSettings.value.accent, () => audioSettings.value.playbackRate, () => audioSettings.value.repeatCount], () => {
  stop(); speechError.value = '';
  const settings = audioSettings.value;
  const key = `${question.value?.presentationId}:${settings?.accent}:${settings?.playbackRate}:${settings?.repeatCount}`;
  if (settings?.autoPlay && !showingFeedback.value && canPronounce.value && key !== autoAttempt) { autoAttempt = key; pronounce(); }
}, { flush: 'sync' });
onMounted(() => { void pronunciation.load().catch(e => { speechError.value = errorMessage(e); }); });
let spokenAnswer = '';
watch([busy, receipt, showingFeedback, viewActive, () => surface?.active.value], () => {
  const answer = receipt.value;
  if (busy.value || !showingFeedback.value || answer?.action !== 'ANSWER' || !answer.wordId || !viewActive.value || surface?.active.value === false) return;
  const key = `${task.value?.batchId}:${answer.trainingId}`;
  if (spokenAnswer === key) return;
  spokenAnswer = key;
  void play(ordinaryAudioUrl(answer.wordId), { ...audioSettings.value, repeatCount: 1 });
}, { flush: 'post' });
useLearningKeys({ reveal, pronounce, rate: result => recognitionFeedback.value ? session.correct(result) : session.action('ANSWER', result), previous: session.previous, next,
  correct: () => { if (canCorrect.value) correction.value = true; }, cancelCorrection: () => { correction.value = false; } });
async function saveCorrection(result: 1 | 2 | 3) { if (result === 1) return; await session.correct(result); correction.value = false; }
watch(mode, value => {
  if (value === 'DICTATION') preferences.showChinese = true;
  emit('mode', value);
}, { immediate: true });
watch([busy, pending, expired, historical], () => emit('blocked', busy.value || !!pending.value || expired.value || historical.value), { immediate: true });
watch(() => receipt.value?.trainingId, () => { correction.value = false; itemsRevision.value++; });
watch(() => [question.value?.itemId, question.value?.modeVersion, question.value?.phase, question.value?.answerRevealed], () => {
  if (definition.value) preferences.showChinese = true;
});
watchEffect(() => { if (surface) surface.state.source = task.value ? `${props.scope === 'CONSOLIDATION' ? '集中巩固' : `每日单词 · ${task.value.learningDate}`} · ${dailyModeLabels[mode.value]}` : `每日单词 · ${dailyModeLabels[mode.value]}`; });
watch(() => props.requestedBatchId, () => { void sync(); });
watch(busy, value => { if (!value && syncPending) void sync(); });
let mounted = false;
let initializing: Promise<void> | undefined;
onMounted(() => { initializing = sync().then(() => { mounted = true; }); });
onActivated(() => { void nextTick(() => {
  if (!mounted || !surface?.active.value) return;
  if (busy.value) syncPending = true;
  else if (!pending.value) void sync();
}); });
defineExpose({ changeMode: async (value: DailyStudyMode) => { await initializing; const switchingToRecognition = value === 'RECOGNITION' && mode.value !== value; await session.changeMode(value); if (switchingToRecognition && mode.value === value && question.value) recognitionMeaningHidden.value = true; }, toggleMeaning, pronounce, meaningVisible, canToggleMeaning, canPronounce, speaking });
</script>
<template>
  <div class="review-page learning-page unified-daily-page">
    <ReviewHeader :completed="task?.completedCount || 0" :total="task?.totalCount || 0" :skipped="task?.skippedCount || 0" :back-to="scope === 'CONSOLIDATION' ? '/consolidation' : '/today'" :label="scope === 'CONSOLIDATION' ? '集中巩固' : '每日单词'" />
    <div class="daily-training-main">
      <p v-if="speechError" class="speech-error" role="status">{{ speechError }} <button class="muted-link" :disabled="!canPronounce || audioLoading" @click="pronounce">重试播放</button> · 可在练习设置中切换方式</p>
      <div v-if="session.legacyFollow.value && !historical" class="daily-follow-migration"><p>跟拼已移至独立练习。此每日任务的词单和进度已保留，请选择一种每日方式继续。</p><RouterLink to="/follow-typing" class="btn btn-primary">进入跟拼练习</RouterLink><RouterLink v-if="task" :to="`/records/${task.batchId}`" class="muted-link">查看原每日记录</RouterLink><div class="live-actions"><button v-for="entry in [{ mode: 'RECOGNITION' as const, label: '认识' }, { mode: 'DICTATION' as const, label: '单词默写' }, { mode: 'LISTEN_DICTATION' as const, label: '听音默写' }]" :key="entry.mode" class="btn btn-secondary" :disabled="busy || !!pending" @click="session.changeMode(entry.mode)">{{ entry.label }}</button></div></div>
      <StatePanel :loading="busy && !question && !receipt" />
      <p v-if="notice" class="learning-notice" role="status">{{ notice }}</p>
      <p v-if="busy && pending" class="subtle-copy" role="status">正在保存…</p>
      <div v-if="!busy && (error || pending)" class="live-error learning-error" role="alert"><p>{{ error || '有一次操作尚未确认，请重试原请求。' }}</p><button v-if="pending && !expired && !historical" class="muted-link" :disabled="busy" @click="session.retry">重试原请求</button><button v-else-if="!expired" class="muted-link" :disabled="busy" @click="sync">重新同步</button><RouterLink v-if="expired" to="/today" class="muted-link">进入今日任务</RouterLink></div>
      <p v-if="extraItemId" class="subtle-copy daily-extra-note">追加训练 · 不重复计入每日目标 <button class="muted-link" :disabled="busy || !!pending" @click="session.extra()">返回当前队列</button></p>
      <div v-if="session.canReturnPrevious.value" class="learning-controls"><button type="button" class="muted-link" aria-keyshortcuts="ArrowLeft" @click="session.previous">← 上一个单词</button></div>
      <section v-if="dictationFeedback && receipt" :class="['daily-training-card', 'learning-card', 'daily-training-feedback', 'dictation-answer-feedback', { 'is-incorrect': incorrect }]" aria-live="polite">
        <div class="dictation-feedback-heading">
          <button type="button" class="btn btn-secondary training-play" aria-keyshortcuts="Alt+P" title="播放发音（Alt + P）" :disabled="!canPronounce || audioLoading" @click="pronounce">{{ audioLoading ? '音频加载中…' : speaking ? '重新播放' : '播放发音' }} <kbd aria-hidden="true">Alt + P</kbd></button>
          <div class="dictation-feedback-answer"><h1 class="learning-word" lang="en">{{ receipt.word }}</h1><p v-if="preferences.showPhonetic" class="daily-word-phonetic dictation-feedback-phonetic" lang="en">{{ feedbackPhonetic }}</p></div>
        </div>
        <WordLearningDetails :translation="receipt.translation" :translation-groups="receipt.translationGroups" :word-id="receipt.wordId" :word="receipt.word" :word-key="receipt.trainingId" />
        <div class="dictation-submitted"><p class="letter-input-label">英文拼写</p><p :class="['dictation-submitted-word', incorrect ? 'is-incorrect' : 'is-correct']" lang="en">{{ receipt.input }}</p><p :class="['dictation-answer-verdict', incorrect ? 'is-incorrect' : 'is-correct']">{{ incorrect ? '拼写错误' : '拼写正确' }}</p></div>
        <div class="workspace-answer-actions dictation-feedback-actions"><button ref="dictationNext" type="button" class="btn btn-primary" :disabled="session.blocked.value" @click="next">下一个 <kbd>Enter</kbd></button></div>
      </section>
      <section v-else-if="recognitionFeedback && receipt" class="daily-training-card learning-card daily-training-feedback recognition-feedback" aria-live="polite">
        <h1 class="learning-word" lang="en">{{ receipt.word }}</h1>
        <div class="recognition-word-meta"><p v-if="preferences.showPhonetic && recognitionPhonetic" class="daily-word-phonetic" lang="en">{{ recognitionPhonetic }}</p><button v-if="receipt.wordId" type="button" class="recognition-audio" aria-label="播放发音" aria-keyshortcuts="Alt+P" title="播放发音（Alt + P）" :disabled="!canPronounce || audioLoading" @click="pronounce"><Volume2 :size="18" aria-hidden="true" /></button></div>
        <WordLearningDetails :translation="receipt.translation" :translation-groups="receipt.translationGroups" :word-id="receipt.wordId" :word="receipt.word" :word-key="receipt.trainingId" />
        <div class="recognition-feedback-actions"><div class="learning-rating daily-training-rating" role="group" aria-label="本次认读选择"><button v-for="entry in ratings" :key="entry.result" type="button" :class="['rating-button', { 'is-selected': receipt.selfAssessment === entry.result }]" :aria-pressed="receipt.selfAssessment === entry.result" :disabled="!canCorrect" @click="session.correct(entry.result)">{{ entry.label }}<kbd>{{ entry.key }}</kbd></button></div><button ref="recognitionNext" type="button" class="btn btn-primary recognition-next" :disabled="session.blocked.value" @click="next">下一个 <kbd>Enter</kbd></button></div>
        <p v-if="!receipt.reviewLogId || scope === 'CONSOLIDATION'" class="subtle-copy">本次练习暂不支持修改已保存的选择。</p>
      </section>
      <section v-else-if="showingFeedback && receipt" :class="['daily-training-feedback', { 'is-incorrect': incorrect }]" aria-live="polite">
        <div v-if="incorrect" class="daily-feedback-error">
          <p class="daily-feedback-error-heading"><CircleX :size="24" aria-hidden="true" /><span>{{ feedbackLabel }}</span></p>
          <p v-if="receipt.input !== null" class="daily-submitted is-incorrect">你的输入：<del lang="en">{{ receipt.input }}</del></p>
        </div>
        <p v-else class="learning-notice">{{ feedbackLabel }}</p>
        <p v-if="incorrect" class="daily-feedback-answer-label">正确拼写</p>
        <h1 class="learning-word">{{ receipt.word }}</h1>
        <p v-if="!incorrect && receipt.input !== null" class="daily-submitted">你的输入：<span lang="en">{{ receipt.input }}</span></p>
        <WordLearningDetails :translation="receipt.translation" :translation-groups="receipt.translationGroups" :word-id="receipt.wordId" :word="receipt.word" :word-key="receipt.trainingId" />
        <p v-if="receipt.extraTraining" class="subtle-copy">本次仅记录训练，不重复完成目标或改变复习安排。</p>
        <p v-else-if="task?.status === 'COMPLETED'" class="subtle-copy">练习完成不代表已经掌握。</p>
        <div v-if="canCorrect" class="daily-correction"><button class="muted-link" :aria-expanded="correction" @click="correction = !correction">记错了（R）</button><div v-if="correction" class="live-actions"><button class="btn btn-secondary" @click="saveCorrection(3)">改为不认识（1）</button><button class="btn btn-secondary" @click="saveCorrection(2)">改为模糊（2）</button></div></div>
        <AppButton :disabled="session.blocked.value" @click="next">{{ receipt.action === 'REVEAL' ? '继续输入' : receipt.extraTraining ? '再次训练此词' : question ? '下一个' : '查看完成状态' }} <span aria-hidden="true">→</span></AppButton>
      </section>
      <section v-else-if="question && !historical && !expired" class="daily-training-card learning-card" :data-mode="question.mode" :data-item-id="question.itemId">
        <template v-if="!['DICTATION', 'LISTEN_DICTATION'].includes(question.mode) || question.answerRevealed"><h1 class="learning-word" lang="en">{{ question.word }}</h1><div v-if="question.mode === 'RECOGNITION'" class="recognition-word-meta"><p v-if="preferences.showPhonetic && question.phonetic" class="daily-word-phonetic" lang="en">{{ question.phonetic }}</p><button v-if="question.audioUrl || canPronounce" type="button" class="recognition-audio" aria-label="播放发音" aria-keyshortcuts="Alt+P" title="播放发音（Alt + P）" :disabled="!canPronounce || audioLoading" @click="pronounce"><Volume2 :size="18" aria-hidden="true" /></button></div><p v-else-if="preferences.showPhonetic && question.phonetic" class="daily-word-phonetic" lang="en">{{ question.phonetic }}</p></template>
        <p v-if="question.extraTraining" class="subtle-copy">追加练习 · {{ trainingStatusLabel(question) }}</p>
        <template v-if="question.mode === 'RECOGNITION'">
          <WordLearningDetails v-if="definition && meaningVisible" :translation="definition.translation" :translation-groups="definition.translationGroups" :word-id="definition.wordId" :word="definition.word" :word-key="question.itemId" />
          <button v-else class="daily-recall-prompt" :disabled="session.blocked.value" @click="reveal">查看释义 <kbd>Space</kbd></button>
          <div class="learning-rating daily-training-rating"><button v-for="entry in ratings" :key="entry.result" class="rating-button" :disabled="!canRate" @click="session.action('ANSWER', entry.result)">{{ entry.label }}<kbd>{{ entry.key }}</kbd></button></div>
        </template>
        <form v-else class="daily-typing-form" @submit.prevent="session.action('ANSWER')">
          <button v-if="question.audioUrl || canPronounce" type="button" class="btn btn-secondary training-play daily-typing-audio" aria-keyshortcuts="Alt+P" title="播放发音（Alt + P）" :disabled="!canPronounce || audioLoading" @click="pronounce"><Volume2 :size="18" aria-hidden="true" />{{ audioLoading ? '音频加载中…' : speaking ? '重新播放' : '播放发音' }} <kbd aria-hidden="true">Alt + P</kbd></button>
          <div v-if="meaningVisible || !listeningHidden" class="daily-typing-clues">
            <WordMeaning v-if="meaningVisible" :translation="question.translation" :translation-groups="question.translationGroups" layout="study" :word-key="`${question.itemId}:${question.modeVersion}`" />
            <button v-else type="button" class="daily-recall-prompt" @click="preferences.showChinese = true">显示释义</button>
          </div>
          <LetterInput id="daily-training-input" ref="field" v-model="input" :length="question.word && !listeningHidden ? Array.from(question.word).length : undefined" :pattern="question.answerPattern" :disabled="session.blocked.value" @submit="session.action('ANSWER')" />
          <p v-if="question.answerPattern && /[^_]/.test(question.answerPattern)" class="subtle-copy daily-typing-note">请同时输入空格和标点。</p>
          <p v-if="['DICTATION', 'LISTEN_DICTATION'].includes(question.mode) && question.answerRevealed" class="subtle-copy daily-assisted-note daily-typing-note" role="status">已查看答案 · 辅助输入</p>
          <div class="workspace-answer-actions"><button type="button" class="btn btn-secondary" :disabled="session.blocked.value || question.answerRevealed" aria-keyshortcuts="F2" title="不会／看答案（F2）" @click="reveal">{{ question.answerRevealed ? '已查看答案' : '不会／看答案' }}<kbd v-if="!question.answerRevealed" aria-hidden="true">F2</kbd></button><AppButton type="submit" :disabled="session.blocked.value || !input.trim()" :busy="busy">提交 <kbd>Enter</kbd></AppButton></div>
        </form>
      </section>
      <div v-else-if="!busy && !error && !pending && !session.promptUnavailable.value && (!session.legacyFollow.value || historical)" class="library-empty learning-empty"><h1>{{ historical ? '历史任务仅供回顾' : task?.status === 'COMPLETED' ? (scope === 'CONSOLIDATION' ? (outstanding === false ? '暂无待巩固的错词' : '当前练习已完成') : '本组训练已结束') : task?.status === 'ABANDONED' ? '本轮已放弃' : !task ? '任选一种方式，开始今日单词' : '暂无可作答单词' }}</h1><p v-if="task">完成 {{ task.completedCount }} / {{ task.totalCount }} 词 · 跳过 {{ task.skippedCount }} 词</p><p v-if="scope === 'CONSOLIDATION' && task && outstanding">仍有待巩固的错词，可以继续练习。</p><p v-if="scope === 'CONSOLIDATION' && outstandingLoading">正在检查待巩固的错词…</p><p v-if="scope === 'CONSOLIDATION' && outstandingError" role="alert">{{ outstandingError }} <button class="muted-link" @click="refreshOutstanding">重试</button></p><RouterLink v-if="scope === 'CONSOLIDATION'" to="/consolidation/words" class="muted-link">查看错词与错因</RouterLink><p v-if="(!scope || scope === 'DAILY') && !historical && goal" class="daily-goal-status">{{ goal.reached ? '每日目标已达成' : `距每日目标还差 ${goal.remainingCount} 词` }}</p><p v-if="(!scope || scope === 'DAILY') && !historical && needsWords" class="daily-needs-words">添加单词到学习计划后可继续，收进词本还需点击“加入学习计划”。</p><RouterLink v-if="(!scope || scope === 'DAILY') && !historical && !expired && needsWords" to="/books" class="btn btn-primary">添加单词到学习计划</RouterLink><AppButton v-else-if="scope !== 'CONSOLIDATION' && !historical && !expired && (!task || today?.canAddMore)" :busy="busy" @click="session.start">{{ task ? '继续学习' : '开始今日学习' }}</AppButton><RouterLink v-if="task && scope !== 'CONSOLIDATION'" :to="`/records/${task.batchId}`" class="btn btn-secondary">查看本轮记录</RouterLink><RouterLink v-if="scope !== 'CONSOLIDATION' || outstanding" :to="scope === 'CONSOLIDATION' ? '/consolidation' : '/today'" class="muted-link">{{ scope === 'CONSOLIDATION' ? '继续巩固' : '返回今日' }}</RouterLink></div>
      <details v-if="task && scope === 'CONSOLIDATION'" class="workspace-notes workspace-items" :open="itemsOpen" @toggle="itemsOpen = ($event.target as HTMLDetailsElement).open"><summary>已练词项 · {{ task.completedCount }} / {{ task.totalCount }} 词完成</summary><TrainingItems v-if="itemsOpen" :batch-id="task.batchId" :scope="scope" :revision="itemsRevision" :allow-extra="!historical && !expired && !session.blocked.value" @extra="session.extra" /></details>
    </div>
  </div>
</template>
