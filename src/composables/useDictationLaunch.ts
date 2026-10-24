import { onScopeDispose, ref } from 'vue';
import { useRouter } from 'vue-router';
import { dictationApi } from '../api/dictation';
import { ApiError, errorMessage } from '../api/http';
import { useStudySurface } from './useStudySurface';
import { useStudyWorkspace } from '../stores/studyWorkspace';
import type { CreateDictation, DictationTask } from '../types/dictation';
export function useDictationLaunch() {
  const router = useRouter();
  const surface = useStudySurface();
  const workspace = surface ? useStudyWorkspace() : undefined;
  const busy = ref(false);
  const error = ref('');
  const uncertain = ref(false);
  const created = ref<DictationTask>();
  let active = true;
  onScopeDispose(() => { active = false; });
  async function launch(body: CreateDictation) {
    if (busy.value || uncertain.value || created.value) return;
    busy.value = true; error.value = '';
    try {
      created.value = await dictationApi.create(body);
      if (!active) return;
      if (workspace) workspace.dictationId = created.value.batchId;
      if (!surface || surface.active.value) await router.push(`/dictation/${created.value.batchId}`);
    } catch (value) {
      if (!active) return;
      error.value = errorMessage(value);
      uncertain.value = !created.value && !(value instanceof ApiError && value.status !== undefined && value.status >= 400 && value.status < 500);
    } finally { if (active) busy.value = false; }
  }
  return { busy, error, uncertain, created, launch };
}
