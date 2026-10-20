import { computed, ref } from "vue";
export function useSelection() {
  const selected = ref(new Set<number>());
  const count = computed(() => selected.value.size);
  function toggle(id: number, checked: boolean) {
    const next = new Set(selected.value);
    if (checked) next.add(id);
    else next.delete(id);
    selected.value = next;
  }
  function clear() {
    selected.value = new Set();
  }
  function togglePage(ids: number[], checked: boolean) {
    const next = new Set(selected.value);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    selected.value = next;
  }
  return { selected, count, toggle, clear, togglePage };
}
