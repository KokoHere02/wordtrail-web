<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, ChartNoAxesCombined, History, Keyboard, ListOrdered, X } from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth';
import { useFollowTyping } from '../../composables/useFollowTyping';
import { useAudioPlayer } from '../../composables/useAudioPlayer';
import { useLearningKeys } from '../../composables/useLearningKeys';
import { usePronunciation } from '../../stores/pronunciation';
import { followTypingApi } from '../../api/followTyping';
import { errorMessage } from '../../api/http';
import { useResource } from '../../composables/useResource';
import type { Page, Status } from '../../types/api';
import type { TrainingQuestion, TrainingTask } from '../../types/dailyTraining';
import LetterInput from '../../components/learning/LetterInput.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
import AppButton from '../../components/ui/AppButton.vue';
import AppSelect from '../../components/ui/AppSelect.vue';
import AppDialog from '../../components/ui/AppDialog.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import ReviewHeader from '../../components/learning/ReviewHeader.vue';
import TrainingItems from '../../components/learning/TrainingItems.vue';
import TrainingHistory from '../../components/learning/TrainingHistory.vue';
import FollowTypingStatistics from '../../components/learning/FollowTypingStatistics.vue';
import { useStudySurface } from '../../composables/useStudySurface';
import { useStudyPreferences } from '../../stores/studyPreferences';

const props = defineProps<{ requestedBatchId?: number }>();
const emit = defineEmits<{ batch: [id: number] }>();
const router = useRouter(), surface = useStudySurface(), preferences = useStudyPreferences();
const active = computed(() => surface?.active.value !== false);
const id = computed(() => props.requestedBatchId);
const batchLink = (value: number) => ({ path: '/learn', query: { mode: 'follow', followBatchId: String(value) } });
const follow = useFollowTyping(useAuthStore().user!.id, async value => {
  emit('batch', value);
  if (active.value) await router.replace(batchLink(value));
});
const { session, count, busy, blocked, error, pendingCreate, abandonPending, knownBatch } = follow;
const { task, question, receipt, input, pending, notice } = session;
// Keep the exercise visible while saving; only the live question can be submitted.
const lastQuestion = shallowRef<TrainingQuestion>();
watch(question, value => { if (value) lastQuestion.value = value; }, { flush: 'sync' });
const abandonDialog = ref(false);
type Panel = 'items' | 'attempts' | 'statistics' | 'rounds';
const activePanel = ref<Panel>();
const panels = [
  { id: 'items' as const, label: '本轮词单', icon: ListOrdered },
  { id: 'attempts' as const, label: '作答历史', icon: Keyboard },
  { id: 'statistics' as const, label: '学习统计', icon: ChartNoAxesCombined },
  { id: 'rounds' as const, label: '历史轮次', icon: History },
];
const roundsOpen = computed(() => activePanel.value === 'rounds');
const field = ref<InstanceType<typeof LetterInput>>();
const toolButtons = ref<HTMLButtonElement[]>([]);
const pronunciation = usePronunciation();
const audioSettings = computed(() => pronunciation.loaded ? pronunciation.value : question.value?.pronunciation || pronunciation.value);
const audio = useAudioPlayer(() => { void session.recoverPresentation(); });
const overallBusy = computed(() => busy.value || session.busy.value);
const displayedQuestion = computed(() => question.value || (overallBusy.value ? lastQuestion.value : undefined));
const ready = computed(() => active.value && !!question.value && !blocked.value && !abandonDialog.value);
const canPronounce = computed(() => active.value && !blocked.value && !!question.value?.audioUrl && !audio.loading.value);
const settingsBlocked = computed(() => overallBusy.value || !!pendingCreate.value);
const countValue = computed({ get: () => String(count.value), set: value => { count.value = Number(value); } });
const countOptions = Array.from({ length: 11 }, (_, index) => ({ value: String(index + 10), label: `${index + 10} 词` }));
const revision = computed(() => receipt.value?.trainingId || 0);
watch(ready, value => { if (value) field.value?.focus(); }, { flush: 'post' });
watch(() => question.value?.presentationId, () => { if (ready.value) field.value?.focus(); }, { flush: 'post' });
function play() {
  if (canPronounce.value && question.value?.audioUrl) void audio.play(question.value.audioUrl, audioSettings.value);
}
function toggleWord() { preferences.showFollowWord = !preferences.showFollowWord; activePanel.value = undefined; }
function toggleMeaning() { preferences.showFollowChinese = !preferences.showFollowChinese; activePanel.value = undefined; }
watch(() => [preferences.showFollowWord, preferences.showFollowChinese], () => { if (ready.value) field.value?.focus(); }, { flush: 'post' });
function submit() { if (ready.value) void session.action('ANSWER'); }
function closePanel() { const index = panels.findIndex(panel => panel.id === activePanel.value); activePanel.value = undefined; toolButtons.value[index]?.focus(); }
function playShortcut() { if (!abandonDialog.value) play(); }
async function extra(itemId?: number) { activePanel.value = undefined; await session.extra(itemId); }
let autoAttempt = '';
watch([() => question.value?.presentationId, overallBusy, blocked, active, () => audioSettings.value.autoPlay,
  () => audioSettings.value.accent, () => audioSettings.value.playbackRate, () => audioSettings.value.repeatCount], () => {
  audio.stop(); audio.error.value = '';
  const key = `${question.value?.presentationId}:${audioSettings.value.accent}:${audioSettings.value.playbackRate}:${audioSettings.value.repeatCount}`;
  if (canPronounce.value && audioSettings.value.autoPlay && autoAttempt !== key) { autoAttempt = key; play(); }
}, { flush: 'sync' });
useLearningKeys({ reveal: () => {}, rate: () => {}, previous: () => {}, next: () => {}, pronounce: play, correct: () => {}, cancelCorrection: () => {} });
const rounds = useResource<Page<TrainingTask>>(), roundPage = ref(1), roundStatus = ref<Status>('COMPLETED');
const statusOptions = [{ value: 'IN_PROGRESS', label: '进行中' }, { value: 'COMPLETED', label: '已完成' }, { value: 'ABANDONED', label: '已放弃' }];
const statusLabel = { IN_PROGRESS: '继续跟拼', COMPLETED: '查看本轮', ABANDONED: '已放弃 · 查看' };
function loadRounds(page = roundPage.value) { roundPage.value = page; return rounds.load(() => followTypingApi.batches({ page, size: 8, status: roundStatus.value })); }
watch(roundsOpen, open => { if (open) void loadRounds(); });
watch(roundStatus, () => { if (roundsOpen.value) void loadRounds(1); });
async function confirmAbandon() { abandonDialog.value = false; await follow.abandon(); if (roundsOpen.value) await loadRounds(); }
function requestAbandon() { abandonDialog.value = true; }
function setCount(value: number) { if (!settingsBlocked.value && Number.isInteger(value) && value >= 10 && value <= 20) count.value = value; }
let syncPending = false;
async function sync() {
  if (!active.value || overallBusy.value) { syncPending = true; return; }
  syncPending = false;
  await follow.open(id.value);
}
watch(id, () => { void sync(); });
watch(overallBusy, value => { if (!value && syncPending && active.value) void sync(); });
watch(active, value => {
  if (value) void sync();
  else { audio.stop(); abandonDialog.value = false; }
});
onMounted(() => {
  void sync();
  void pronunciation.load().catch(e => { audio.error.value = errorMessage(e); });
});
defineExpose({ toggleWord, toggleMeaning, play, canPronounce, speaking: audio.speaking, count, countOptions, task, settingsBlocked, setCount, requestAbandon });
</script>
<template>
  <div class="review-page learning-page unified-follow-page" @keydown.alt.p.prevent="playShortcut">
    <ReviewHeader :completed="task?.completedCount || 0" :total="task?.totalCount || 0" :skipped="task?.skippedCount || 0" back-to="/learn" label="单词练习" />
    <div class="daily-training-main" :aria-busy="overallBusy">

      <StatePanel :loading="overallBusy && !displayedQuestion" />
      <p v-if="notice" class="learning-notice" role="status">{{ notice }}</p>
      <div v-if="error || session.error.value || pending || abandonPending === task?.batchId && !!task" class="learning-error" role="alert">
        <p>{{ error || session.error.value || (pending ? '有一次输入结果尚未确认，请重试原请求。' : '放弃结果尚未确认，请先同步或重试。') }}</p>
        <button v-if="pendingCreate" class="muted-link" :disabled="overallBusy" @click="follow.retryCreate">重试原创建请求</button>
        <button v-else-if="pending" class="muted-link" :disabled="overallBusy" @click="session.retry">重试原输入请求</button>
        <button v-else-if="abandonPending === task?.batchId && task" class="muted-link" :disabled="overallBusy" @click="follow.abandon">重试放弃</button>
        <button class="muted-link" :disabled="overallBusy" @click="sync">重新同步</button>
        <RouterLink v-if="knownBatch && knownBatch !== id" :to="batchLink(knownBatch)" class="muted-link">进入已创建轮次</RouterLink>
      </div>

      <section v-if="displayedQuestion" class="daily-training-card learning-card follow-exercise" data-mode="FOLLOW_TYPING" :data-item-id="displayedQuestion.itemId">
        <p v-if="displayedQuestion.extraTraining" class="subtle-copy follow-extra-note">追加练习 <button class="muted-link" :disabled="blocked" @click="extra()">返回本轮</button></p>
        <h1 v-if="preferences.showFollowWord" lang="en" class="learning-word">{{ displayedQuestion.word }}</h1>
        <button v-else type="button" class="daily-recall-prompt" @click="toggleWord">显示英文</button>
        <p v-if="preferences.showFollowWord && preferences.showPhonetic && displayedQuestion.phonetic" class="daily-word-phonetic follow-pronunciation" lang="en">{{ displayedQuestion.phonetic }}</p>
        <button v-if="displayedQuestion.audioUrl" type="button" class="btn btn-secondary training-play" :disabled="!canPronounce" @click="play">播放发音</button>
        <p v-if="audio.error.value" class="speech-error" role="status">{{ audio.error.value }} <button class="muted-link" :disabled="!canPronounce" @click="play">重试播放</button></p>
        <form class="daily-typing-form" @submit.prevent="submit">
          <WordMeaning v-if="preferences.showFollowChinese" :translation="displayedQuestion.translation" :translation-groups="displayedQuestion.translationGroups" layout="study" :word-key="displayedQuestion.itemId" />
          <button v-else type="button" class="daily-recall-prompt" @click="toggleMeaning">显示释义</button>
          <LetterInput id="follow-typing-input" ref="field" v-model="input" :length="Array.from(displayedQuestion.word || '').length" :disabled="blocked || !active" :described-by="receipt?.verdict === 'INCORRECT' ? 'follow-input-feedback' : undefined" @submit="submit" />
          <p v-if="receipt?.verdict === 'INCORRECT'" id="follow-input-feedback" class="inline-error follow-input-feedback is-error" role="status">拼写错误</p>
          <div class="workspace-answer-actions"><span aria-hidden="true" /><AppButton type="submit" :busy="session.busy.value" :disabled="!ready || !input.trim() || input.length > 255">提交 <kbd>Enter</kbd></AppButton></div>
        </form>
      </section>

      <section v-else-if="!overallBusy && !pending && !pendingCreate && (!task || abandonPending !== task.batchId)" class="library-empty learning-empty follow-completion">
        <h2>{{ task?.status === 'COMPLETED' ? '本轮跟拼完成' : task?.status === 'ABANDONED' ? '本轮已放弃' : task ? '暂无可输入词项' : '准备开始跟拼' }}</h2>
        <p v-if="task">完成 {{ task.completedCount }} / {{ task.totalCount }} 词<span v-if="task.skippedCount"> · 跳过 {{ task.skippedCount }} 词</span> · 输入 {{ task.trainingCount }} 次</p>
        <div v-if="task?.status !== 'IN_PROGRESS'" class="follow-next-round"><AppSelect v-model="countValue" :options="countOptions" :label="task ? '下一轮词数' : '练习词数'" :disabled="overallBusy || !!pendingCreate" hide-label /><AppButton :disabled="overallBusy" @click="follow.open()">{{ task ? '开始新一轮' : '开始跟拼' }}<ArrowRight :size="17" aria-hidden="true" /></AppButton></div>
        <RouterLink to="/plan" class="muted-link">查看学习计划</RouterLink>
      </section>

    <div class="follow-tools" role="group" aria-label="跟拼练习详情">
      <button v-for="panel in panels" :key="panel.id" ref="toolButtons" :disabled="!task && (panel.id === 'items' || panel.id === 'attempts')" :aria-expanded="activePanel === panel.id" :aria-controls="activePanel === panel.id ? 'follow-detail-panel' : undefined" @click="activePanel = activePanel === panel.id ? undefined : panel.id"><component :is="panel.icon" :size="17" aria-hidden="true" /><span>{{ panel.label }}</span></button>
    </div>
    <section v-if="activePanel" id="follow-detail-panel" class="follow-detail-panel" :aria-label="panels.find(panel => panel.id === activePanel)?.label">
      <header class="follow-detail-heading"><h2>{{ panels.find(panel => panel.id === activePanel)?.label }}</h2><button class="workspace-icon-button" aria-label="收起练习详情" @click="closePanel"><X :size="18" /></button></header>
      <TrainingItems v-if="activePanel === 'items' && task" :batch-id="task.batchId" scope="FOLLOW_TYPING" :revision="revision" :allow-extra="!blocked && task.status !== 'ABANDONED'" @extra="extra" />
      <TrainingHistory v-if="activePanel === 'attempts' && task" :batch-id="task.batchId" scope="FOLLOW_TYPING" :revision="revision" />
      <FollowTypingStatistics v-if="activePanel === 'statistics'" :revision="revision" />
      <div v-if="activePanel === 'rounds'" class="follow-round-history">
        <AppSelect v-model="roundStatus" :options="statusOptions" label="轮次状态" />
        <StatePanel :loading="rounds.loading.value" :error="rounds.error.value" @retry="loadRounds()" />
        <template v-if="rounds.data.value && !rounds.loading.value && !rounds.error.value"><p v-if="!rounds.data.value.records.length" class="subtle-copy">暂无此状态的轮次。</p><RouterLink v-for="row in rounds.data.value.records" :key="row.batchId" :to="batchLink(row.batchId)" class="consolidation-batch-link"><span>跟拼 #{{ row.batchId }} · {{ row.completedCount }} / {{ row.totalCount }} 词</span><span>{{ statusLabel[row.status] }}</span></RouterLink><AppPagination :page="roundPage" :size="8" :total="rounds.data.value.total" :disabled="rounds.loading.value" @change="loadRounds" /></template>
      </div>
    </section>

    </div>
    <AppDialog v-model="abandonDialog" title="放弃本轮跟拼？" description="保留词单和输入记录；放弃也计入词项的入选次数。"><AppButton :busy="overallBusy" @click="confirmAbandon">放弃本轮</AppButton></AppDialog>
  </div>
</template>
