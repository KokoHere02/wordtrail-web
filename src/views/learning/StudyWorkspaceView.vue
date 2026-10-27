<script setup lang="ts">
import { computed, reactive, ref, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { BookOpen, History, PencilLine, Settings2 } from 'lucide-vue-next';
import { useStudyWorkspace } from '../../stores/studyWorkspace';
import { useAuthStore } from '../../stores/auth';
import type { StudyMode, StudySurfaceState } from '../../composables/useStudySurface';
import type { DailyStudyMode } from '../../types/dailyTraining';
import StudyModeHost from '../../components/learning/StudyModeHost.vue';
import WordPracticeToolbar from '../../components/learning/WordPracticeToolbar.vue';
import UnifiedDailyView from '../live/DailyView.vue';
import StudyView from './StudyView.vue';
import DictationModeView from './modes/DictationModeView.vue';
import SentenceModeView from './modes/SentenceModeView.vue';
import FollowTypingView from './FollowTypingView.vue';
import { useStudyPreferences } from '../../stores/studyPreferences';
import AppSelect from '../../components/ui/AppSelect.vue';

defineOptions({ name: 'StudyWorkspaceView' });
const route = useRoute(), router = useRouter(), workspace = useStudyWorkspace(), auth = useAuthStore();
const dailyView = ref<InstanceType<typeof UnifiedDailyView>>(), dailyBlocked = ref(false);
const followView = ref<InstanceType<typeof FollowTypingView>>(), preferences = useStudyPreferences();
const tabs = [{ id: 'words', label: '单词练习' }, { id: 'sentences', label: '句子翻译' }] as const;
const wordToolbar = ref<InstanceType<typeof WordPracticeToolbar>>();
const followCount = computed({ get: () => String(followView.value?.count ?? 20), set: value => { followView.value?.setCount(Number(value)); } });
const following = computed(() => workspace.lane === 'follow');
const lastWordMode = ref<StudyMode>('recognition');
const activeTab = computed(() => workspace.lane === 'sentences' ? 'sentences' : 'words');
const backendMode: Record<Exclude<StudyMode, 'sentences'>, DailyStudyMode> = { recognition: 'RECOGNITION', dictation: 'DICTATION', spelling: 'FOLLOW_TYPING', listen: 'LISTEN_DICTATION' };
const visited = reactive(new Set<string>());
const states = reactive<Record<string, StudySurfaceState>>({
  daily: { source: '每日单词', completed: 0, total: 0, remaining: 0, noun: '词', settings: false },
  practice: { source: '认识专项', completed: 0, total: 0, remaining: 0, noun: '词', settings: false },
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
  const id = Number(route.params.batchId), sentenceId = Number(route.params.sessionId);
  if (route.path.startsWith('/study/') && id > 0) { workspace.lane = 'practice'; workspace.mode = 'recognition'; workspace.practiceId = id; }
  else if (route.path.startsWith('/dictation')) { workspace.lane = 'independent'; workspace.mode = 'dictation'; if (id > 0) { workspace.dictationId = id; states.independent!.settings = false; } else states.independent!.settings = true; }
  else if (route.query.mode === 'follow') { workspace.lane = 'follow'; workspace.mode = 'spelling'; lastWordMode.value = 'spelling'; const followId = Number(route.query.followBatchId); workspace.followId = Number.isSafeInteger(followId) && followId > 0 ? followId : undefined; }
  else if (sentenceId > 0 || route.query.mode === 'sentences') { workspace.lane = 'sentences'; workspace.mode = 'sentences'; if (sentenceId > 0) workspace.sentenceId = sentenceId; }
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
    await router.push(workspace.sentenceId ? `/sentences/sessions/${workspace.sentenceId}` : '/learn?mode=sentences');
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
function keyboard(event: KeyboardEvent, index: number) {
  const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (!offset && !['Home', 'End'].includes(event.key)) return;
  event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + offset + tabs.length) % tabs.length;
  void selectTab(tabs[next]!.id); document.getElementById(`mode-tab-${tabs[next]!.id}`)?.focus();
}
function selectTab(id: 'words' | 'sentences') {
  if (id === activeTab.value) return;
  return select(id === 'sentences' ? 'sentences' : lastWordMode.value);
}
</script>
<template>
  <div v-if="auth.user" class="study-workspace" :class="{ 'is-word-practice': workspace.lane === 'daily' || following }">
    <nav class="workspace-shortcuts" aria-label="学习入口">
      <RouterLink to="/learn" :class="{ 'is-active': ['daily', 'follow'].includes(workspace.lane) }" :aria-current="['daily', 'follow'].includes(workspace.lane) ? 'page' : undefined"><BookOpen :size="16" :stroke-width="1.7" aria-hidden="true" /><span>每日单词</span></RouterLink>
      <RouterLink to="/dictation" :class="{ 'is-active': workspace.lane === 'independent' }" :aria-current="workspace.lane === 'independent' ? 'page' : undefined"><PencilLine :size="16" :stroke-width="1.7" aria-hidden="true" /><span>独立默写专项</span></RouterLink>
      <RouterLink to="/consolidation"><BookOpen :size="16" aria-hidden="true" /><span>错因与巩固</span></RouterLink>
      <RouterLink to="/records/dictation"><History :size="16" :stroke-width="1.7" aria-hidden="true" /><span>专项历史</span></RouterLink>
    </nav>
    <div v-if="workspace.lane !== 'independent'" class="workspace-navigation">
      <div class="workspace-tabs" role="tablist" aria-label="学习内容"><button v-for="(entry, index) in tabs" :id="`mode-tab-${entry.id}`" :key="entry.id" role="tab" :aria-selected="activeTab === entry.id" :aria-controls="entry.id === 'sentences' ? 'mode-panel-sentences' : 'mode-panel-words'" :tabindex="activeTab === entry.id ? 0 : -1" :disabled="workspace.lane === 'daily' && dailyBlocked" @click="selectTab(entry.id)" @keydown="keyboard($event, index)">{{ entry.label }}</button></div>
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
      <button v-else class="workspace-settings" :aria-expanded="current.settings" @click="current.settings = !current.settings"><Settings2 :size="19" />练习设置</button>
    </div>
    <div v-if="workspace.lane !== 'independent' || (workspace.dictationId && !current.settings)" class="workspace-meta"><div class="workspace-source"><small>SOURCE</small><span>{{ current.source }}</span></div><div class="workspace-progress"><small>PROGRESS</small><div><span>{{ current.completed }} / {{ current.total || '—' }} {{ current.noun }} · 剩余 {{ current.remaining }} {{ current.noun }}</span><div class="workspace-progress-track" role="progressbar" aria-label="当前任务完成进度" :aria-valuenow="current.completed" :aria-valuemax="current.total || 1"><span :style="{ width: `${current.total ? Math.min(100, current.completed / current.total * 100) : 0}%` }" /></div></div></div></div>
    <section id="mode-panel-words" v-show="activeTab === 'words' && workspace.lane !== 'independent'" role="tabpanel" tabindex="-1" aria-labelledby="mode-tab-words" class="workspace-panel">
      <div id="mode-panel-daily" v-show="workspace.lane === 'daily'"><StudyModeHost v-if="visited.has('daily')" :active="workspace.lane === 'daily'" :state="states.daily!"><UnifiedDailyView ref="dailyView" :requested-batch-id="workspace.dailyId" @mode="confirmedMode" @blocked="dailyBlocked = $event" /></StudyModeHost></div>
      <div id="mode-panel-follow" v-show="following"><StudyModeHost v-if="visited.has('follow')" :active="following" :state="states.follow!"><FollowTypingView ref="followView" :requested-batch-id="workspace.followId" @batch="workspace.followId = $event" /></StudyModeHost></div>
      <div id="mode-panel-practice" v-show="workspace.lane === 'practice'"><StudyModeHost v-if="visited.has('practice')" :active="workspace.lane === 'practice'" :state="states.practice!"><StudyView v-if="workspace.practiceId" :key="workspace.practiceId" :requested-batch-id="workspace.practiceId" /></StudyModeHost></div>
    </section>
    <section id="mode-panel-independent" v-show="workspace.lane === 'independent'" role="region" aria-label="独立默写专项" class="workspace-panel"><StudyModeHost v-if="visited.has('independent')" :active="workspace.lane === 'independent'" :state="states.independent!"><DictationModeView /></StudyModeHost></section>
    <section id="mode-panel-sentences" v-show="workspace.lane === 'sentences'" role="tabpanel" tabindex="-1" aria-labelledby="mode-tab-sentences" class="workspace-panel"><StudyModeHost v-if="visited.has('sentences')" :active="workspace.lane === 'sentences'" :state="states.sentences!"><SentenceModeView /></StudyModeHost></section>
  </div>
</template>
