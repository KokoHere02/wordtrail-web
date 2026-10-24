import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useAuthStore } from './auth';
import type { StudyMode } from '../composables/useStudySurface';
export const useStudyWorkspace = defineStore('study-workspace', () => {
  const auth = useAuthStore();
  const mode = ref<StudyMode>('recognition');
  const dailyId = ref<number>(), dictationId = ref<number>(), sentenceId = ref<number>(), practiceId = ref<number>();
  watch(() => auth.user?.id, () => { mode.value = 'recognition'; dailyId.value = undefined; dictationId.value = undefined; sentenceId.value = undefined; practiceId.value = undefined; }, { flush: 'sync' });
  return { mode, dailyId, dictationId, sentenceId, practiceId };
});
