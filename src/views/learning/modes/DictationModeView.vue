<script setup lang="ts">
import { ref, watch } from 'vue';
import { useStudyWorkspace } from '../../../stores/studyWorkspace';
import { useStudySurface } from '../../../composables/useStudySurface';
import DictationStudyView from '../../dictation/DictationStudyView.vue';
import DictationHomeView from '../../dictation/DictationHomeView.vue';
import DictationTasks from '../../../components/learning/DictationTasks.vue';
import DictationMistakesView from '../../dictation/DictationMistakesView.vue';
const workspace = useStudyWorkspace(), surface = useStudySurface()!;
const settingsVisited = ref(false);
const source = ref<'PLAN' | 'MISTAKES'>('PLAN');
const mistakesVisited = ref(false);
const openedBatch = ref<number>();
watch([() => workspace.dictationId, surface.active], ([id, active]) => { if (id && active) openedBatch.value = id; }, { immediate: true });
watch(source, value => { if (value === 'MISTAKES') mistakesVisited.value = true; });
watch(() => surface.state.settings, open => { if (open) settingsVisited.value = true; }, { immediate: true });
watch(() => workspace.dictationId, value => { if (value) surface.state.settings = false; });
</script>
<template>
  <div class="workspace-dictation-mode"><section v-if="settingsVisited" v-show="surface.state.settings" class="workspace-configuration"><label class="workspace-setting-fields">内容范围<select v-model="source"><option value="PLAN">计划词</option><option value="MISTAKES">默写待巩固</option></select></label><DictationHomeView v-show="source === 'PLAN'" embedded /><DictationMistakesView v-if="mistakesVisited" v-show="source === 'MISTAKES'" /></section><DictationStudyView v-if="workspace.dictationId &amp;&amp; openedBatch === workspace.dictationId" :key="workspace.dictationId" :requested-batch-id="workspace.dictationId" /><div v-else class="workspace-start"><h2>根据释义，写出英文</h2><p>选择计划词开始，或继续上次默写。</p><button class="btn btn-secondary" @click="surface.state.settings = true">选择默写内容</button><DictationTasks resume-only /></div></div>
</template>
