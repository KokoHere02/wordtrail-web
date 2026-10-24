<script setup lang="ts">
import { computed, reactive, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { Settings2 } from 'lucide-vue-next';
import { useStudyWorkspace } from '../../stores/studyWorkspace';
import { useAuthStore } from '../../stores/auth';
import type { StudyMode, StudySurfaceState } from '../../composables/useStudySurface';
import StudyModeHost from '../../components/learning/StudyModeHost.vue';
import DailyView from '../live/DailyView.vue';
import StudyView from './StudyView.vue';
import DictationModeView from './modes/DictationModeView.vue';
import SentenceModeView from './modes/SentenceModeView.vue';
import GuidedSpellingView from './modes/GuidedSpellingView.vue';
defineOptions({ name: 'StudyWorkspaceView' });
const route = useRoute(), workspace = useStudyWorkspace();
const auth = useAuthStore();
const modes: { id: StudyMode; label: string }[] = [{ id: 'recognition', label: '单词认读' }, { id: 'dictation', label: '单词默写' }, { id: 'spelling', label: '跟练拼写' }, { id: 'sentences', label: '句子翻译' }];
const visited = reactive(new Set<StudyMode>());
const state = reactive<Record<StudyMode, StudySurfaceState>>(Object.fromEntries(modes.map(mode => [mode.id, { source: mode.id === 'recognition' ? '每日计划' : '尚未选择内容', completed: 0, total: 0, remaining: 0, noun: mode.id === 'sentences' ? '句' : '词', settings: false }])) as Record<StudyMode, StudySurfaceState>);
const current = computed(() => state[workspace.mode]);
function routeState() {
  if (!auth.user || !route.meta.workspace) return;
  const id = Number(route.params.batchId);
  const sessionId = Number(route.params.sessionId);
  if (route.path.startsWith('/study/') && id > 0) { workspace.mode = 'recognition'; workspace.practiceId = id; }
  else if (route.path.startsWith('/dictation')) { workspace.mode = 'dictation'; if (id > 0) workspace.dictationId = id; else state.dictation.settings = true; }
  else if (sessionId > 0) { workspace.mode = 'sentences'; workspace.sentenceId = sessionId; }
  else if (route.query.mode && modes.some(mode => mode.id === route.query.mode)) { workspace.mode = route.query.mode as StudyMode; if (route.query.daily === '1') workspace.practiceId = undefined; }
  else if (id > 0) { workspace.mode = 'recognition'; workspace.dailyId = id; workspace.practiceId = undefined; }
  visited.add(workspace.mode);
}
watch(() => route.fullPath, routeState, { immediate: true });
watch(() => workspace.mode, value => { visited.add(value); });
function select(mode: StudyMode, focusContent = true) { workspace.mode = mode; if (focusContent && mode === 'recognition') void nextTick(() => document.getElementById(`mode-panel-${mode}`)?.focus()); }
function keyboard(event: KeyboardEvent, index: number) {
  const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (!offset && !['Home', 'End'].includes(event.key)) return;
  event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? modes.length - 1 : (index + offset + modes.length) % modes.length;
  select(modes[next]!.id, false); document.getElementById(`mode-tab-${modes[next]!.id}`)?.focus();
}
</script>
<template>
  <div v-if="auth.user" class="study-workspace"><header class="workspace-heading"><h1>学习</h1><p>切换一种方式，继续今天的练习。</p></header>
    <div class="workspace-tabs" role="tablist" aria-label="学习方式"><button v-for="(mode, index) in modes" :id="`mode-tab-${mode.id}`" :key="mode.id" role="tab" :aria-selected="workspace.mode === mode.id" :aria-controls="`mode-panel-${mode.id}`" :tabindex="workspace.mode === mode.id ? 0 : -1" @click="select(mode.id)" @keydown="keyboard($event, index)">{{ mode.label }}</button></div>
    <div class="workspace-meta"><div class="workspace-source"><small>SOURCE</small><span>{{ current.source }}</span></div><div class="workspace-progress"><small>PROGRESS</small><div><span>{{ current.completed }} / {{ current.total || '—' }} {{ current.noun }} · 剩余 {{ current.remaining }} {{ current.noun }}</span><div class="workspace-progress-track" role="progressbar" aria-label="当前模式完成进度" :aria-valuenow="current.completed" :aria-valuemax="current.total || 1"><span :style="{ width: `${current.total ? Math.min(100, current.completed / current.total * 100) : 0}%` }" /></div></div></div><button class="workspace-settings" :aria-expanded="current.settings" @click="current.settings = !current.settings"><Settings2 :size="19" />练习设置</button></div>
    <section v-for="mode in modes" v-show="workspace.mode === mode.id" :id="`mode-panel-${mode.id}`" :key="mode.id" role="tabpanel" tabindex="-1" :aria-labelledby="`mode-tab-${mode.id}`" :aria-hidden="workspace.mode !== mode.id" class="workspace-panel"><StudyModeHost v-if="visited.has(mode.id)" :active="workspace.mode === mode.id" :state="state[mode.id]"><StudyView v-if="mode.id === 'recognition' && workspace.practiceId" :key="`practice:${workspace.practiceId}`" :requested-batch-id="workspace.practiceId" /><DailyView v-else-if="mode.id === 'recognition'" :key="`daily:${workspace.dailyId || 'today'}`" embedded :requested-batch-id="workspace.dailyId" /><DictationModeView v-else-if="mode.id === 'dictation'" /><GuidedSpellingView v-else-if="mode.id === 'spelling'" /><SentenceModeView v-else /></StudyModeHost></section>
  </div>
</template>
