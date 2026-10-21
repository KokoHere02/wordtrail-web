import { onScopeDispose, ref } from 'vue';
import { useRouter } from 'vue-router';
import { dailyApi } from '../api/daily';
import { errorMessage } from '../api/http';
import type { DailyTask } from '../types/daily';

// Only call from an explicit user action. Reading a page must never append a group.
export function useStartDaily(onStarted?: (task: DailyTask) => Promise<void>) {
  const router = useRouter();
  const starting = ref(false);
  const startError = ref('');
  let active = true;
  onScopeDispose(() => { active = false; });
  async function start() {
    if (starting.value) return;
    starting.value = true;
    startError.value = '';
    try {
      const task = await dailyApi.start();
      if (active) {
        if (onStarted) await onStarted(task);
        else await router.push(task.status === 'IN_PROGRESS' ? `/learn/${task.batchId}` : `/records/${task.batchId}`);
      }
    } catch (e) { if (active) startError.value = errorMessage(e); }
    finally { starting.value = false; }
  }
  return { starting, startError, start };
}
