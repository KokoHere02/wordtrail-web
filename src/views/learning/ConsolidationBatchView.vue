<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import DailyView from '../live/DailyView.vue';
import StudyModeHost from '../../components/learning/StudyModeHost.vue';
import WordPracticeToolbar from '../../components/learning/WordPracticeToolbar.vue';
import type { DailyStudyMode } from '../../types/dailyTraining';
import type { StudyMode, StudySurfaceState } from '../../composables/useStudySurface';
const route = useRoute(), batchId = computed(() => Number(route.params.batchId));
const view = ref<InstanceType<typeof DailyView>>(), blocked = ref(false), mode = ref<StudyMode>('dictation');
const state = reactive<StudySurfaceState>({ source: '集中巩固', total: 0, completed: 0, remaining: 0, noun: '词', settings: false });
const modes = { recognition: 'RECOGNITION', dictation: 'DICTATION', spelling: 'FOLLOW_TYPING', listen: 'LISTEN_DICTATION' } as const;
function confirmed(value: DailyStudyMode) { mode.value = ({ RECOGNITION: 'recognition', DICTATION: 'dictation', FOLLOW_TYPING: 'spelling', LISTEN_DICTATION: 'listen' } as const)[value]; }
function change(value: Exclude<StudyMode, 'sentences'>) { void view.value?.changeMode(modes[value]); }
</script>
<template>
  <div class="study-workspace consolidation-workspace">
    <nav class="workspace-shortcuts" aria-label="学习入口"><RouterLink to="/learn">每日单词</RouterLink><RouterLink to="/consolidation" class="is-active">错因与巩固</RouterLink><RouterLink to="/dictation">独立默写专项</RouterLink></nav>
    <div class="workspace-navigation"><span>{{ state.source }}</span><WordPracticeToolbar allow-follow :mode="mode" :blocked="blocked" :meaning-visible="view?.meaningVisible" :can-toggle-meaning="view?.canToggleMeaning" :can-pronounce="view?.canPronounce" :speaking="view?.speaking" @mode="change" @meaning="view?.toggleMeaning()" @pronounce="view?.pronounce()" /></div>
    <div class="workspace-meta"><span>本轮完成 {{ state.completed }} / {{ state.total || '—' }} 词 · 剩余 {{ state.remaining }} 词</span><div class="workspace-progress-track" role="progressbar" aria-label="巩固批次完成进度" :aria-valuenow="state.completed" :aria-valuemax="state.total || 1"><span :style="{ width: `${state.total ? Math.min(100, state.completed / state.total * 100) : 0}%` }" /></div></div>
    <StudyModeHost :state="state" :active="true"><DailyView ref="view" :requested-batch-id="batchId" scope="CONSOLIDATION" @mode="confirmed" @blocked="blocked = $event" /></StudyModeHost>
  </div>
</template>
