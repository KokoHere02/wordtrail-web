<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, BookOpen, RotateCcw } from 'lucide-vue-next';
import { dictationApi } from '../../../api/dictation';
import { useStudyWorkspace } from '../../../stores/studyWorkspace';
import { useStudySurface } from '../../../composables/useStudySurface';
import DictationStudyView from '../../dictation/DictationStudyView.vue';
import DictationHomeView from '../../dictation/DictationHomeView.vue';
import DictationTasks from '../../../components/learning/DictationTasks.vue';
import DictationMistakesView from '../../dictation/DictationMistakesView.vue';
const workspace = useStudyWorkspace(), surface = useStudySurface()!;
const route = useRoute(), router = useRouter();
const restoreError = ref('');
let restoring = false;
async function restoreActive() {
  if (restoring || !surface.active.value || route.path !== '/dictation') return;
  restoring = true; restoreError.value = '';
  try {
    const page = await dictationApi.tasks({ page: 1, size: 100, status: 'IN_PROGRESS' });
    const task = page.records.find(item => item.singleAttempt && item.canContinue);
    if (task && surface.active.value && route.path === '/dictation') await router.replace(`/dictation/${task.batchId}`);
    else if (!task && surface.active.value && route.path === '/dictation') workspace.dictationId = undefined;
  } catch { restoreError.value = '无法检查进行中的默写，请重试。'; }
  finally { restoring = false; }
}
watch([() => route.path, surface.active], () => { void restoreActive(); }, { immediate: true });
const settingsVisited = ref(false);
const source = ref<'PLAN' | 'MISTAKES'>('PLAN');
const mistakesVisited = ref(false);
const openedBatch = ref<number>();
const choosing = computed(() => !workspace.dictationId || surface.state.settings);
watch([() => workspace.dictationId, surface.active], ([id, active]) => { if (id && active) openedBatch.value = id; }, { immediate: true });
watch(source, value => { if (value === 'MISTAKES') mistakesVisited.value = true; });
watch(() => surface.state.settings, open => { if (open) settingsVisited.value = true; }, { immediate: true });
watch(() => workspace.dictationId, value => { if (value) surface.state.settings = false; });
</script>
<template>
  <div class="workspace-dictation-mode">
    <section v-if="settingsVisited || !workspace.dictationId" v-show="choosing" class="dictation-picker">
      <p v-if="restoreError" role="alert">{{ restoreError }} <button class="muted-link" @click="restoreActive">重试</button></p>
      <div class="dictation-picker-heading">
        <div class="dictation-source-switch" role="group" aria-label="内容范围">
          <button type="button" :aria-pressed="source === 'PLAN'" @click="source = 'PLAN'"><BookOpen :size="17" aria-hidden="true" />计划单词</button>
          <button type="button" :aria-pressed="source === 'MISTAKES'" @click="source = 'MISTAKES'"><RotateCcw :size="17" aria-hidden="true" />错词重测</button>
        </div>
        <button v-if="workspace.dictationId" type="button" class="dictation-quiet-button" @click="surface.state.settings = false"><ArrowLeft :size="16" aria-hidden="true" />返回当前测验</button>
      </div>
      <DictationHomeView v-show="source === 'PLAN'" embedded />
      <DictationMistakesView v-if="mistakesVisited" v-show="source === 'MISTAKES'" :active="choosing && source === 'MISTAKES' && surface.active.value" embedded />
      <DictationTasks resume-only :active="choosing && surface.active.value" />
    </section>
    <DictationStudyView v-if="workspace.dictationId && openedBatch === workspace.dictationId" v-show="!choosing" :key="workspace.dictationId" :requested-batch-id="workspace.dictationId" :active="!choosing" />
  </div>
</template>
