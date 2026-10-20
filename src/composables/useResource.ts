import { ref, shallowRef } from "vue";
import { errorMessage } from "../api/http";
export function useResource<T>() {
  const data = shallowRef<T>();
  const loading = ref(false);
  const error = ref("");
  let generation = 0;
  async function load(fetcher: () => Promise<T>) {
    const current = ++generation;
    loading.value = true;
    error.value = "";
    try {
      const result = await fetcher();
      if (current === generation) data.value = result;
    } catch (e) {
      if (current === generation) {
        error.value = errorMessage(e);
        data.value = undefined;
      }
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  return { data, loading, error, load };
}
