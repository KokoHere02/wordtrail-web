import { computed, ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue';

// An encounter is keyed by item + attempt, never by wordId: reinforcement may repeat a word.
export function useLearningHistory<T>(currentKey: MaybeRefOrGetter<string>) {
  const entries = shallowRef<{ key: string; value: T }[]>([]);
  const cursor = ref<number | null>(null);
  const selected = computed(() => cursor.value === null ? undefined : entries.value[cursor.value]);
  const previousIndex = computed(() => cursor.value === null
    ? entries.value.length - (entries.value.at(-1)?.key === toValue(currentKey) ? 2 : 1)
    : cursor.value - 1);
  const canPrevious = computed(() => previousIndex.value >= 0);
  function remember(key: string, value: T) {
    const snapshot = JSON.parse(JSON.stringify(value)) as T;
    const index = entries.value.findIndex(entry => entry.key === key);
    const next = [...entries.value];
    if (index < 0) next.push({ key, value: snapshot }); else next[index] = { key, value: snapshot };
    entries.value = next;
  }
  function previous() { if (canPrevious.value) cursor.value = previousIndex.value; }
  function forward() { if (cursor.value !== null) cursor.value = cursor.value + 1 < entries.value.length ? cursor.value + 1 : null; }
  function live() { cursor.value = null; }
  return { entries, cursor, selected, canPrevious, remember, previous, forward, live };
}
