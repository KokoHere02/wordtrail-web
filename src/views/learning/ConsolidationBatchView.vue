<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DailyView from '../live/DailyView.vue';
import StudyModeHost from '../../components/learning/StudyModeHost.vue';
import StudyNavigation from '../../components/learning/StudyNavigation.vue';
import WordPracticeToolbar from '../../components/learning/WordPracticeToolbar.vue';
import type { DailyStudyMode } from '../../types/dailyTraining';
import type { StudyMode, StudySurfaceState } from '../../composables/useStudySurface';
const route = useRoute(), router = useRouter(), batchId = computed(() => Number(route.params.batchId));
const navigationCollapsed = ref(false);
const view = ref<InstanceType<typeof DailyView>>(), blocked = ref(false), mode = ref<StudyMode>('dictation');
const state = reactive<StudySurfaceState>({ source: '集中巩固', total: 0, completed: 0, remaining: 0, noun: '词', settings: false });
const modes = { recognition: 'RECOGNITION', dictation: 'DICTATION', spelling: 'FOLLOW_TYPING', listen: 'LISTEN_DICTATION' } as const;
function confirmed(value: DailyStudyMode) { mode.value = ({ RECOGNITION: 'recognition', DICTATION: 'dictation', FOLLOW_TYPING: 'spelling', LISTEN_DICTATION: 'listen' } as const)[value]; }
function change(value: Exclude<StudyMode, 'sentences'>) { void view.value?.changeMode(modes[value]); }
</script>
<template>
  <div class="study-workspace consolidation-workspace">
    <div class="study-directory-layout" :class="{ 'is-collapsed': navigationCollapsed }">
    <StudyNavigation active="words" lane="consolidation" :blocked="blocked" @select="$event === 'sentences' && router.push('/learn?mode=sentences')" @collapse="navigationCollapsed = $event" />
    <div class="study-directory-main">
    <div class="workspace-navigation study-directory-toolbar"><WordPracticeToolbar allow-follow :mode="mode" :blocked="blocked" :meaning-visible="view?.meaningVisible" :can-toggle-meaning="view?.canToggleMeaning" :can-pronounce="view?.canPronounce" :speaking="view?.speaking" @mode="change" @meaning="view?.toggleMeaning()" @pronounce="view?.pronounce()" /></div>
    <div class="workspace-meta workspace-status-meta"><div class="workspace-progress"><div><span>已完成 {{ state.completed }} / {{ state.total || '—' }} 词 · 剩余 {{ state.remaining }} 词</span><div class="workspace-progress-track" role="progressbar" aria-label="错词巩固进度" :aria-valuenow="state.completed" :aria-valuemax="state.total || 1"><span :style="{ width: `${state.total ? Math.min(100, state.completed / state.total * 100) : 0}%` }" /></div></div></div></div>
    <StudyModeHost :state="state" :active="true"><DailyView ref="view" :requested-batch-id="batchId" scope="CONSOLIDATION" @mode="confirmed" @blocked="blocked = $event" /></StudyModeHost>
    </div>
    </div>
  </div>
</template>
