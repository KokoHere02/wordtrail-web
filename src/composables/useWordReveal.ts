import { onScopeDispose, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { wordsApi } from '../api/words';
import { errorMessage } from '../api/http';
import type { TranslationFields } from '../types/translation';
import { hasTranslation } from '../utils/translation';

export function useWordReveal(
  key: MaybeRefOrGetter<string>,
  wordId: MaybeRefOrGetter<number | undefined>,
  answer: MaybeRefOrGetter<TranslationFields | undefined>,
) {
  const visible = ref(false);
  const loading = ref(false);
  const error = ref('');
  const definition = shallowRef<TranslationFields>();
  let generation = 0;
  function reset() { generation++; visible.value = false; loading.value = false; error.value = ''; definition.value = undefined; }
  function showSaved(value: TranslationFields) {
    generation++; visible.value = true; loading.value = false; error.value = '';
    definition.value = hasTranslation(value) ? value : undefined;
  }
  watch(() => toValue(key), reset, { flush: 'sync' });
  watch(() => toValue(answer), value => {
    // A newer save/correction replaces both fields, including missing fields. Never retain old groups.
    if (visible.value && value) showSaved(value);
  });
  async function reveal() {
    if (loading.value || visible.value && definition.value) return;
    const id = toValue(wordId);
    if (!id) return;
    const saved = toValue(answer);
    if (saved) { showSaved(saved); return; }
    const current = ++generation;
    visible.value = true; loading.value = true; error.value = '';
    try {
      // Explicit user action only. The unanswered learning detail intentionally hides its meaning.
      const detail = await wordsApi.detail(id);
      if (current === generation) definition.value = { translation: detail.translation, translationGroups: detail.translationGroups };
    } catch (value) { if (current === generation) error.value = errorMessage(value); }
    finally { if (current === generation) loading.value = false; }
  }
  onScopeDispose(() => { generation++; });
  return { visible, loading, error, definition, reveal, reset, showSaved };
}
