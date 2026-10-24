import { onScopeDispose, ref } from 'vue';
import { useRouter } from 'vue-router';
import { sentencesApi } from '../api/sentences';
import { ApiError, errorMessage } from '../api/http';
import { useStudySurface } from './useStudySurface';
import { useStudyWorkspace } from '../stores/studyWorkspace';
import type { CreateSentenceSession, SentenceProgress } from '../types/sentences';
export function useSentenceLaunch() {
  const router = useRouter();
  const surface = useStudySurface();
  const workspace = surface ? useStudyWorkspace() : undefined;
  const busy = ref(false);
  const error = ref('');
  const uncertain = ref(false);
  const created = ref<SentenceProgress>();
  let active = true;
  onScopeDispose(() => { active = false; });
  async function launch(body: CreateSentenceSession | (() => Promise<SentenceProgress>)) {
    if (busy.value || uncertain.value || created.value) return;
    busy.value = true; error.value = '';
    try {
      const value = await (typeof body === 'function' ? body() : sentencesApi.create(body));
      if (!active) return;
      created.value = value;
      if (workspace) workspace.sentenceId = value.sessionId;
      if (!surface || surface.active.value) await router.push(`/sentences/sessions/${value.sessionId}`);
    } catch (value) {
      if (!active) return;
      error.value = errorMessage(value);
      uncertain.value = !created.value && !(value instanceof ApiError && value.status !== undefined && value.status >= 400 && value.status < 500);
    } finally { if (active) busy.value = false; }
  }
  return { busy, error, uncertain, created, launch };
}
