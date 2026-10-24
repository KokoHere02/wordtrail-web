import { onScopeDispose, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError, errorMessage } from '../api/http';
import type { BatchCreated } from '../types/api';

// A failed create response may have committed. Do not turn it into an automatic retry.
export function usePracticeLaunch(onRejected?: (error: unknown) => Promise<void>) {
  const router = useRouter();
  const busy = ref(false);
  const error = ref('');
  const uncertain = ref(false);
  const created = ref<BatchCreated>();
  let active = true;
  onScopeDispose(() => { active = false; });
  async function launch(create: () => Promise<BatchCreated>) {
    if (busy.value || uncertain.value || created.value) return;
    busy.value = true; error.value = '';
    try {
      created.value = await create();
      if (active) await router.push(`/study/${created.value.batchId}`);
    } catch (e) {
      if (!active) return;
      error.value = errorMessage(e);
      if (!created.value) {
        const knownRejection = e instanceof ApiError && (
          e.status !== undefined && e.status >= 400 && e.status < 500 ||
          ['WEAK_WORD_SELECTION_CHANGED', 'WORD_NOT_FOUND', 'NO_RELEARN_WORDS', 'INVALID_PARAMETER', 'BOOK_NOT_FOUND'].includes(e.code)
        );
        uncertain.value = !knownRejection;
        if (knownRejection && onRejected) await onRejected(e);
      }
    } finally { busy.value = false; }
  }
  return { busy, error, uncertain, created, launch };
}
