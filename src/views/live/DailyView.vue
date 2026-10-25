<script setup lang="ts">
import { computed, onMounted, onActivated, ref, watch, watchEffect, nextTick } from 'vue';
import { CircleX } from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth';
import { useDailyTraining } from '../../composables/useDailyTraining';
import { useLearningKeys } from '../../composables/useLearningKeys';
import { useRevealShortcut } from '../../composables/useRevealShortcut';
import { useStudySurface } from '../../composables/useStudySurface';
import { dailyModeLabels, type DailyStudyMode } from '../../types/dailyTraining';
import ReviewHeader from '../../components/learning/ReviewHeader.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
import { useWordSpeech } from '../../composables/useWordSpeech';
import { useStudyPreferences } from '../../stores/studyPreferences';
import LetterInput from '../../components/learning/LetterInput.vue';
import TrainingHistory from '../../components/learning/TrainingHistory.vue';
import TrainingItems from '../../components/learning/TrainingItems.vue';
import { trainingStatusLabel } from '../../utils/trainingStatus';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppButton from '../../components/ui/AppButton.vue';
import { useStudyWorkspace } from '../../stores/studyWorkspace';

const props = defineProps<{ requestedBatchId?: number }>();
const emit = defineEmits<{ mode: [mode: DailyStudyMode]; blocked: [value: boolean] }>();
const surface = useStudySurface(), workspace = useStudyWorkspace();
const session = useDailyTraining(useAuthStore().user!.id);
const { task, today, question, mode, busy, error, notice, pending, expired, historical, input, definition,
  receipt, showingFeedback, canRate, canCorrect, extraItemId } = session;
const preferences = useStudyPreferences();
const { speak, stop, speaking, error: speechError } = useWordSpeech();
const spokenWord = computed(() => showingFeedback.value ? receipt.value?.word : question.value?.word);
const canPronounce = computed(() => !!spokenWord.value && !session.blocked.value);
const canToggleMeaning = computed(() => !!question.value && !showingFeedback.value && !session.blocked.value);
const meaningVisible = computed(() => preferences.showChinese && !!question.value && (question.value.mode !== 'RECOGNITION' || !!definition.value));
const field = ref<InstanceType<typeof LetterInput>>();
const incorrect = computed(() => receipt.value?.verdict === 'INCORRECT');
const inputReady = computed(() => !!question.value && question.value.mode !== 'RECOGNITION' && !showingFeedback.value && !session.blocked.value && surface?.active.value !== false);
watch(inputReady, ready => { if (ready) field.value?.focus(); }, { flush: 'post' });
const correction = ref(false), historyOpen = ref(false), itemsOpen = ref(false), historyRevision = ref(0);
const feedbackLabel = computed(() => {
  const answer = receipt.value;
  if (!answer) return '';
  const action = answer.mode === 'RECOGNITION' ? ({ 1: '已记录：认识', 2: '已记录：模糊', 3: '已记录：不认识' })[answer.selfAssessment!]
    : answer.verdict === 'INCORRECT' ? '拼写错误' : '输入正确';
  return `${action} · ${answer.extraTraining ? '追加训练 · 原词项' : ''}${trainingStatusLabel(answer)}`;
});
let syncPending = false;
async function sync() {
  if (busy.value) { syncPending = true; return; }
  syncPending = false;
  await session.open(props.requestedBatchId);
  if (workspace.extraDailyItemId && !busy.value && !pending.value) {
    const itemId = workspace.extraDailyItemId; workspace.extraDailyItemId = undefined;
    await session.extra(itemId);
  }
}
function reveal() { preferences.showChinese = true; if (!showingFeedback.value && question.value && !question.value.answerRevealed) return session.action('REVEAL'); }
useRevealShortcut(reveal, () => !session.blocked.value && !showingFeedback.value && !!question.value && !question.value.answerRevealed);
function toggleMeaning() {
  if (!canToggleMeaning.value) return;
  if (question.value?.mode === 'RECOGNITION' && !definition.value) return reveal();
  preferences.showChinese = !preferences.showChinese;
}
function next() { if (showingFeedback.value) session.continueTraining(); }
function pronounce() { if (canPronounce.value) speak(spokenWord.value!, preferences.accent); }
watch([() => question.value?.presentationId, showingFeedback, busy, () => surface?.active.value, () => preferences.accent, () => preferences.autoPronounce], () => {
  stop(); speechError.value = '';
  if (preferences.autoPronounce && !showingFeedback.value && surface?.active.value !== false) pronounce();
});
useLearningKeys({ reveal, pronounce, rate: result => correction.value ? saveCorrection(result) : session.action('ANSWER', result), previous: () => {}, next,
  correct: () => { if (canCorrect.value) correction.value = true; }, cancelCorrection: () => { correction.value = false; } });
async function saveCorrection(result: 1 | 2 | 3) { if (result === 1) return; await session.correct(result); correction.value = false; }
watch(mode, value => emit('mode', value), { immediate: true });
watch([busy, pending, expired, historical], () => emit('blocked', busy.value || !!pending.value || expired.value || historical.value), { immediate: true });
watch(() => receipt.value?.trainingId, () => { correction.value = false; historyRevision.value++; });
watch(() => [question.value?.itemId, question.value?.modeVersion, question.value?.phase, question.value?.answerRevealed], () => {
  if (definition.value) preferences.showChinese = true;
});
watchEffect(() => { if (surface) surface.state.source = task.value ? `每日单词 · ${task.value.learningDate} · ${dailyModeLabels[mode.value]}` : `每日单词 · ${dailyModeLabels[mode.value]}`; });
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
defineExpose({ changeMode: async (value: DailyStudyMode) => { await initializing; await session.changeMode(value); }, toggleMeaning, pronounce, meaningVisible, canToggleMeaning, canPronounce, speaking });
</script>
<template>
  <div class="review-page learning-page unified-daily-page">
    <ReviewHeader :completed="task?.completedCount || 0" :total="task?.totalCount || 0" :skipped="task?.skippedCount || 0" back-to="/today" label="每日单词" />
    <div v-if="surface?.state.settings" class="workspace-configuration live-actions"><RouterLink to="/plan" class="muted-link">学习计划</RouterLink><RouterLink to="/settings" class="muted-link">每日目标</RouterLink><button class="muted-link" :disabled="busy || !!pending" @click="sync">同步任务</button><RouterLink to="/dictation" class="muted-link">独立默写专项</RouterLink><RouterLink v-if="task" :to="`/records/${task.batchId}`" class="muted-link">本轮记录</RouterLink></div>
    <div class="daily-training-main">
      <p v-if="speechError" class="speech-error" role="status">{{ speechError }}</p>
      <StatePanel :loading="busy && !question && !receipt" />
      <p v-if="notice" class="learning-notice" role="status">{{ notice }}</p>
      <p v-if="busy && pending" class="subtle-copy" role="status">正在保存…</p>
      <div v-if="!busy && (error || pending)" class="live-error learning-error" role="alert"><p>{{ error || '有一次操作尚未确认，请重试原请求。' }}</p><button v-if="pending && !expired && !historical" class="muted-link" :disabled="busy" @click="session.retry">重试原请求</button><button v-else-if="!expired" class="muted-link" :disabled="busy" @click="sync">重新同步</button><RouterLink v-if="expired" to="/today" class="muted-link">进入今日任务</RouterLink></div>
      <p v-if="extraItemId" class="subtle-copy daily-extra-note">追加训练 · 不重复计入每日目标 <button class="muted-link" :disabled="busy || !!pending" @click="session.extra()">返回当前队列</button></p>
      <section v-if="showingFeedback && receipt" :class="['daily-training-feedback', { 'is-incorrect': incorrect }]" aria-live="polite">
        <div v-if="incorrect" class="daily-feedback-error">
          <p class="daily-feedback-error-heading"><CircleX :size="24" aria-hidden="true" /><span>{{ feedbackLabel }}</span></p>
          <p v-if="receipt.input !== null" class="daily-submitted is-incorrect">你的输入：<del lang="en">{{ receipt.input }}</del></p>
        </div>
        <p v-else class="learning-notice">{{ feedbackLabel }}</p>
        <p v-if="incorrect" class="daily-feedback-answer-label">正确拼写</p>
        <h1 class="learning-word">{{ receipt.word }}</h1>
        <p v-if="!incorrect && receipt.input !== null" class="daily-submitted">你的输入：<span lang="en">{{ receipt.input }}</span></p>
        <WordMeaning :translation="receipt.translation" :translation-groups="receipt.translationGroups" layout="study" :word-key="receipt.trainingId" />
        <p v-if="receipt.extraTraining" class="subtle-copy">本次仅记录训练，不重复完成目标或改变复习安排。</p>
        <p v-else-if="task?.status === 'COMPLETED'" class="subtle-copy">本组已结束。训练完成不代表已经掌握。</p>
        <div v-if="canCorrect" class="daily-correction"><button class="muted-link" :aria-expanded="correction" @click="correction = !correction">记错了（R）</button><div v-if="correction" class="live-actions"><button class="btn btn-secondary" @click="saveCorrection(3)">改为不认识（1）</button><button class="btn btn-secondary" @click="saveCorrection(2)">改为模糊（2）</button></div></div>
        <AppButton :disabled="session.blocked.value" @click="next">{{ receipt.action === 'REVEAL' ? '继续输入' : receipt.extraTraining ? '再次训练此词' : question ? '下一个' : '查看完成状态' }} <span aria-hidden="true">→</span></AppButton>
      </section>
      <section v-else-if="question && !historical && !expired" class="daily-training-card learning-card" :data-mode="question.mode" :data-item-id="question.itemId">
        <template v-if="question.mode !== 'DICTATION' || question.answerRevealed"><h1 class="learning-word" lang="en">{{ question.word }}</h1><p v-if="preferences.showPhonetic && question.phonetic" class="daily-word-phonetic" lang="en">{{ question.phonetic }}</p></template>
        <p v-else class="daily-mode-prompt">回想拼写，输入你记得的单词</p>
        <p v-if="question.extraTraining" class="subtle-copy">原词项：{{ trainingStatusLabel(question) }} · 本次追加训练不重复增加完成词数。</p>
        <template v-if="question.mode === 'RECOGNITION'">
          <WordMeaning v-if="definition && meaningVisible" :translation="definition.translation" :translation-groups="definition.translationGroups" layout="study" :word-key="question.itemId" />
          <button v-else class="daily-recall-prompt" :disabled="session.blocked.value" @click="reveal">回想中文含义，查看释义 <kbd>Space</kbd></button>
          <div class="learning-rating daily-training-rating"><button v-for="entry in [{ result: 3 as const, label: '不认识', key: 1 }, { result: 2 as const, label: '模糊', key: 2 }, { result: 1 as const, label: '认识', key: 3 }]" :key="entry.result" class="rating-button" :disabled="!canRate" @click="session.action('ANSWER', entry.result)">{{ entry.label }}<kbd>{{ entry.key }}</kbd></button></div>
        </template>
        <form v-else class="daily-typing-form" @submit.prevent="session.action('ANSWER')">
          <WordMeaning v-if="meaningVisible" :translation="question.translation" :translation-groups="question.translationGroups" layout="study" :word-key="`${question.itemId}:${question.modeVersion}`" />
          <button v-else type="button" class="daily-recall-prompt" @click="preferences.showChinese = true">中文释义已隐藏，点击显示</button>
          <LetterInput id="daily-training-input" ref="field" v-model="input" :length="question.word ? Array.from(question.word).length : undefined" :disabled="session.blocked.value" :label="question.mode === 'FOLLOW_TYPING' ? '照着输入英文' : '根据释义输入英文'" @submit="session.action('ANSWER')" />
          <p v-if="question.mode === 'DICTATION' && question.answerRevealed" class="subtle-copy daily-assisted-note" role="status">已查看答案 · 辅助输入。可对照英文继续练习，本次不能作为无提示回忆。</p>
          <p v-else-if="question.mode === 'DICTATION' && question.hintUsed" class="subtle-copy">本任务已展示过拼写，本次默写带提示标记。</p>
          <div class="workspace-answer-actions"><button type="button" class="btn btn-secondary" :disabled="session.blocked.value || question.answerRevealed" aria-keyshortcuts="F2" title="不会／看答案（F2）" @click="reveal">{{ question.answerRevealed ? '已查看答案' : '不会／看答案' }}<kbd v-if="!question.answerRevealed" aria-hidden="true">F2</kbd></button><AppButton type="submit" :disabled="session.blocked.value || !input.trim()" :busy="busy">提交 <kbd>Enter</kbd></AppButton></div>
        </form>
        <p class="learning-shortcuts">{{ question.mode === 'RECOGNITION' ? 'Space 查看释义 · 1 / 2 / 3 自评 · ' : 'Enter 提交 · ' }}{{ question.word ? 'P 发音 · ' : '' }}→ 继续</p>
      </section>
      <div v-else-if="!busy && !error && !pending && !session.promptUnavailable.value" class="library-empty learning-empty"><h1>{{ historical ? '历史任务仅供回顾' : task?.status === 'COMPLETED' ? '本组训练已结束' : task?.status === 'ABANDONED' ? '本轮已放弃' : !task ? '任选一种方式，开始今日单词' : '暂无可作答单词' }}</h1><p v-if="task">完成 {{ task.completedCount }} / {{ task.totalCount }} 词 · 跳过 {{ task.skippedCount }} 词</p><AppButton v-if="!historical && !expired && (!task || today?.canAddMore)" :busy="busy" @click="session.start">{{ task ? '继续学习' : '开始今日学习' }}</AppButton><RouterLink v-if="task" :to="`/records/${task.batchId}`" class="btn btn-secondary">查看本轮记录</RouterLink><RouterLink to="/today" class="muted-link">返回今日</RouterLink></div>
      <details v-if="task" class="workspace-notes workspace-items" :open="itemsOpen" @toggle="itemsOpen = ($event.target as HTMLDetailsElement).open"><summary>本组词项 · {{ task.completedCount }} / {{ task.totalCount }} 词完成</summary><TrainingItems v-if="itemsOpen" :batch-id="task.batchId" :revision="historyRevision" :allow-extra="!historical && !expired && !session.blocked.value" @extra="session.extra" /></details>
      <details v-if="task" class="workspace-notes workspace-history" :open="historyOpen" @toggle="historyOpen = ($event.target as HTMLDetailsElement).open"><summary>本轮训练记录</summary><TrainingHistory v-if="historyOpen" :batch-id="task.batchId" :revision="historyRevision" /></details>
    </div>
  </div>
</template>
