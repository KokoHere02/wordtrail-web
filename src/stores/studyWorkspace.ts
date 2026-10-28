import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useAuthStore } from './auth';
import type { StudyMode } from '../composables/useStudySurface';
export const useStudyWorkspace = defineStore('study-workspace', () => {
  const auth = useAuthStore();
  const mode = ref<StudyMode>('recognition');
  const lane = ref<'daily' | 'follow' | 'independent' | 'sentences'>('daily');
  const extraDailyItemId = ref<number>();
  const dailyId = ref<number>(), dictationId = ref<number>(), sentenceId = ref<number>(), followId = ref<number>();
  watch(() => auth.user?.id, () => { mode.value = 'recognition'; lane.value = 'daily'; extraDailyItemId.value = undefined; dailyId.value = undefined; dictationId.value = undefined; sentenceId.value = undefined; followId.value = undefined; }, { flush: 'sync' });
  return { mode, lane, extraDailyItemId, dailyId, dictationId, sentenceId, followId };
});
