<script setup lang="ts">
import { computed, reactive, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStudyWorkspace } from '../../stores/studyWorkspace';
import { useAuthStore } from '../../stores/auth';
import type { StudyMode, StudySurfaceState } from '../../composables/useStudySurface';
import type { DailyStudyMode } from '../../types/dailyTraining';
import StudyModeHost from '../../components/learning/StudyModeHost.vue';
import StudyNavigation from '../../components/learning/StudyNavigation.vue';
import WordPracticeToolbar from '../../components/learning/WordPracticeToolbar.vue';
import UnifiedDailyView from '../live/DailyView.vue';
import DictationModeView from './modes/DictationModeView.vue';
import SentenceModeView from './modes/SentenceModeView.vue';
import FollowTypingView from './FollowTypingView.vue';
import { useStudyPreferences } from '../../stores/studyPreferences';
import AppSelect from '../../components/ui/AppSelect.vue';

defineOptions({ name: 'StudyWorkspaceView' });
const route = useRoute(), router = useRouter(), workspace = useStudyWorkspace(), auth = useAuthStore();
const dailyView = ref<InstanceType<typeof UnifiedDailyView>>(), dailyBlocked = ref(false);
const followView = ref<InstanceType<typeof FollowTypingView>>(), preferences = useStudyPreferences();
const navigationCollapsed = ref(false);
const wordToolbar = ref<InstanceType<typeof WordPracticeToolbar>>();
const exercise = ref<HTMLElement>();
const followCount = computed({ get: () => String(followView.value?.count ?? 20), set: value => { followView.value?.setCount(Number(value)); } });
const following = computed(() => workspace.lane === 'follow');
const lastWordMode = ref<StudyMode>('recognition');
const activeTab = computed(() => workspace.lane === 'sentences' ? 'sentences' : 'words');
const backendMode: Record<Exclude<StudyMode, 'sentences'>, DailyStudyMode> = { recognition: 'RECOGNITION', dictation: 'DICTATION', spelling: 'FOLLOW_TYPING', listen: 'LISTEN_DICTATION' };
const visited = reactive(new Set<string>());
const states = reactive<Record<string, StudySurfaceState>>({
  daily: { source: '每日单词', completed: 0, total: 0, remaining: 0, noun: '词', settings: false },
  follow: { source: '跟拼练习', completed: 0, total: 0, remaining: 0, noun: '词', settings: false },
  independent: { source: '独立默写专项', completed: 0, total: 0, remaining: 0, noun: '词', settings: false },
  sentences: { source: '句子翻译', completed: 0, total: 0, remaining: 0, noun: '句', settings: false },
});
const current = computed(() => states[workspace.lane]!);
let lastDailyMode: StudyMode = 'recognition';
function confirmedMode(value: DailyStudyMode) {
  const displayMode = ({ RECOGNITION: 'recognition', DICTATION: 'dictation', FOLLOW_TYPING: 'spelling', LISTEN_DICTATION: 'listen' } as const)[value];
  lastDailyMode = value === 'FOLLOW_TYPING' ? 'recognition' : displayMode;
  if (workspace.lane === 'daily') { workspace.mode = displayMode; lastWordMode.value = lastDailyMode; }
}
function routeState() {
  if (!auth.user || !route.meta.workspace) return;
  const id = Number(route.params.batchId);
  if (route.path.startsWith('/dictation')) { workspace.lane = 'independent'; workspace.mode = 'dictation'; if (id > 0) { workspace.dictationId = id; states.independent!.settings = false; } else states.independent!.settings = true; }
  else if (route.query.mode === 'follow') { workspace.lane = 'follow'; workspace.mode = 'spelling'; lastWordMode.value = 'spelling'; const followId = Number(route.query.followBatchId); workspace.followId = Number.isSafeInteger(followId) && followId > 0 ? followId : undefined; }
  else if (route.query.mode === 'sentences') { workspace.lane = 'sentences'; workspace.mode = 'sentences'; }
  else {
    workspace.lane = 'daily'; workspace.mode = lastDailyMode; lastWordMode.value = lastDailyMode;
    workspace.dailyId = id > 0 ? id : undefined;
  }
  visited.add(workspace.lane);
}
watch(() => route.fullPath, routeState, { immediate: true });
async function select(mode: StudyMode) {
  if (workspace.lane === 'daily' && dailyBlocked.value) return;
  if (mode === 'spelling') { await router.push({ path: '/learn', query: { mode: 'follow', ...(workspace.followId ? { followBatchId: String(workspace.followId) } : {}) } }); return; }
  if (mode === 'sentences') {
    await router.push('/learn?mode=sentences');
    workspace.lane = 'sentences'; workspace.mode = mode; visited.add('sentences'); return;
  }
  if (workspace.lane !== 'daily') {
    await router.push(workspace.dailyId ? `/learn/${workspace.dailyId}` : '/learn'); await nextTick();
  }
  workspace.lane = 'daily'; workspace.mode = lastDailyMode; visited.add('daily');
  // The single DAILY component owns both the queue and modeVersion. Tabs never create a separate practice.
  await nextTick();
  if (dailyView.value) await dailyView.value.changeMode(backendMode[mode]);
  else workspace.mode = lastDailyMode;
}
function selectTab(id: 'words' | 'sentences') {
  if (id === activeTab.value) return;
  if (id === 'words') {
    const lastRoute = sessionStorage.getItem('wordtrail.study.navigation.lastWordRoute');
    if (lastRoute?.startsWith('/dictation') || lastRoute?.startsWith('/consolidation')) return router.push(lastRoute);
  }
  return select(id === 'sentences' ? 'sentences' : lastWordMode.value);
}

// The status belongs beside the visible prompt, including when notices change its position.
let layoutFrame = 0;
let layoutResize: ResizeObserver | undefined;
let layoutMutations: MutationObserver | undefined;
let observedPrompt: Element | null = null;
let observedMeta: Element | null = null;
function scheduleExerciseLayout() {
  if (layoutFrame) return;
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = 0;
    const root = exercise.value;
    const meta = root?.querySelector<HTMLElement>(':scope > .workspace-meta');
    if (!root || !meta) return;
    if (observedMeta !== meta) {
      if (observedMeta) layoutResize?.unobserve(observedMeta);
      observedMeta = meta;
      layoutResize?.observe(meta);
    }
    const selector = workspace.lane === 'daily'
      ? '#mode-panel-daily .daily-training-card[data-mode="RECOGNITION"] > .learning-word, #mode-panel-daily .recognition-feedback > .learning-word'
      : workspace.lane === 'follow' ? '#mode-panel-follow .follow-exercise > .learning-word'
      : workspace.lane === 'sentences' ? '#mode-panel-sentences .sentence-workspace-card h1' : '';
    const prompt = window.innerWidth >= 1100 && selector ? root.querySelector<HTMLElement>(selector) : null;
    const visiblePrompt = prompt?.getClientRects().length ? prompt : null;
    if (observedPrompt !== visiblePrompt) {
      if (observedPrompt) layoutResize?.unobserve(observedPrompt);
      observedPrompt = visiblePrompt;
      if (visiblePrompt) layoutResize?.observe(visiblePrompt);
    }
    root.classList.toggle('has-aligned-prompt', !!visiblePrompt);
    if (!visiblePrompt) {
      root.style.removeProperty('--exercise-meta-top');
      return;
    }
    const heading = visiblePrompt.getBoundingClientRect();
    const top = heading.top - root.getBoundingClientRect().top + (heading.height - meta.getBoundingClientRect().height) / 2;
    const value = `${Math.max(0, top)}px`;
    if (root.style.getPropertyValue('--exercise-meta-top') !== value) root.style.setProperty('--exercise-meta-top', value);
  });
}
watch(exercise, (root, _previous, onCleanup) => {
  if (!root) return;
  layoutResize = new ResizeObserver(scheduleExerciseLayout);
  layoutResize.observe(root);
  layoutMutations = new MutationObserver(scheduleExerciseLayout);
  layoutMutations.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  scheduleExerciseLayout();
  onCleanup(() => { layoutResize?.disconnect(); layoutMutations?.disconnect(); observedPrompt = null; observedMeta = null; });
}, { flush: 'post' });
onMounted(() => window.addEventListener('resize', scheduleExerciseLayout));
onUnmounted(() => {
  cancelAnimationFrame(layoutFrame);
  layoutResize?.disconnect();
  layoutMutations?.disconnect();
  window.removeEventListener('resize', scheduleExerciseLayout);
});
</script>
<template>
  <div v-if="auth.user" class="study-workspace" :class="{ 'is-word-practice': workspace.lane === 'daily' || following, 'is-daily-practice': workspace.lane === 'daily' }">
    <div class="study-directory-layout" :class="{ 'is-collapsed': navigationCollapsed }">
    <StudyNavigation :active="activeTab" :lane="workspace.lane === 'independent' ? 'independent' : 'daily'" :blocked="workspace.lane === 'daily' && dailyBlocked" controls @select="selectTab" @collapse="navigationCollapsed = $event" />
    <div class="study-directory-main">
    <div v-if="workspace.lane === 'daily' || following" class="workspace-navigation study-directory-toolbar">
      <WordPracticeToolbar v-if="workspace.lane === 'daily' || following" ref="wordToolbar" :mode="workspace.mode" :blocked="!following && dailyBlocked" allow-follow independent-follow
        :word-visible="following ? preferences.showFollowWord : undefined" :can-toggle-word="following"
        :meaning-visible="following ? preferences.showFollowChinese : dailyView?.meaningVisible" :can-toggle-meaning="following || dailyView?.canToggleMeaning"
        :can-pronounce="following ? followView?.canPronounce : dailyView?.canPronounce" :speaking="following ? followView?.speaking : dailyView?.speaking"
        @mode="select" @word="followView?.toggleWord()" @meaning="following ? followView?.toggleMeaning() : dailyView?.toggleMeaning()" @pronounce="following ? followView?.play() : dailyView?.pronounce()">
        <template v-if="following" #practice-settings><div class="word-practice-round-settings">
          <AppSelect v-model="followCount" :options="followView?.countOptions || []" :label="followView?.task ? '下一轮词数' : '练习词数'" :disabled="followView?.settingsBlocked" />
          <button v-if="followView?.task?.status === 'IN_PROGRESS'" class="muted-link" @click="wordToolbar?.closeSettings(); followView?.requestAbandon()">放弃本轮</button>
        </div></template>
      </WordPracticeToolbar>
    </div>
    <div ref="exercise" class="workspace-exercise" :class="`is-${workspace.lane}`">
    <div v-if="workspace.lane !== 'independent' || (workspace.dictationId && !current.settings)" class="workspace-meta workspace-status-meta"><div class="workspace-progress"><div><span>{{ current.completed }} / {{ current.total || '—' }} {{ current.noun }} · 剩余 {{ current.remaining }} {{ current.noun }}</span><div class="workspace-progress-track" role="progressbar" aria-label="当前任务完成进度" :aria-valuenow="current.completed" :aria-valuemax="current.total || 1"><span :style="{ width: `${current.total ? Math.min(100, current.completed / current.total * 100) : 0}%` }" /></div></div></div><div v-if="workspace.lane !== 'daily' && !following" class="workspace-source"><span>{{ current.source }}</span></div></div>
    <section id="mode-panel-words" v-show="activeTab === 'words' && workspace.lane !== 'independent'" role="tabpanel" tabindex="-1" aria-labelledby="mode-tab-words" class="workspace-panel">
      <div id="mode-panel-daily" v-show="workspace.lane === 'daily'"><StudyModeHost v-if="visited.has('daily')" :active="workspace.lane === 'daily'" :state="states.daily!"><UnifiedDailyView ref="dailyView" :requested-batch-id="workspace.dailyId" @mode="confirmedMode" @blocked="dailyBlocked = $event" /></StudyModeHost></div>
      <div id="mode-panel-follow" v-show="following"><StudyModeHost v-if="visited.has('follow')" :active="following" :state="states.follow!"><FollowTypingView ref="followView" :requested-batch-id="workspace.followId" @batch="workspace.followId = $event" /></StudyModeHost></div>
    </section>
    <section id="mode-panel-independent" v-show="workspace.lane === 'independent'" role="region" aria-label="独立默写专项" class="workspace-panel"><StudyModeHost v-if="visited.has('independent')" :active="workspace.lane === 'independent'" :state="states.independent!"><DictationModeView /></StudyModeHost></section>
    <section id="mode-panel-sentences" v-show="workspace.lane === 'sentences'" role="tabpanel" tabindex="-1" aria-labelledby="mode-tab-sentences" class="workspace-panel"><StudyModeHost v-if="visited.has('sentences')" :active="workspace.lane === 'sentences'" :state="states.sentences!"><SentenceModeView /></StudyModeHost></section>
    </div>
    </div>
    </div>
  </div>
</template>
