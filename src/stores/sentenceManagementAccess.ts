import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useAuthStore } from './auth';
import { sentenceManagementApi, sentenceServiceError } from '../api/sentenceManagement';
export const useSentenceManagementAccess = defineStore('sentence-management-access', () => {
  const auth = useAuthStore();
  const canManage = ref(false);
  const loading = ref(false);
  const error = ref('');
  let attempted = false;
  let generation = 0;
  let pending: Promise<boolean> | undefined;
  watch(() => auth.user?.id, () => { generation++; attempted = false; canManage.value = false; loading.value = false; error.value = ''; pending = undefined; }, { flush: 'sync' });
  function deny() { generation++; canManage.value = false; loading.value = false; attempted = true; pending = undefined; error.value = '当前账号没有题库维护权限。'; }
  async function load(force = false): Promise<boolean> {
    if (!auth.user) return false;
    if (pending) return pending;
    if (attempted && !force) return canManage.value;
    const current = ++generation;
    attempted = true; loading.value = true; error.value = ''; canManage.value = false;
    const task = (async () => {
      try { const value = await sentenceManagementApi.access(); if (current === generation) canManage.value = value.canManage === true; }
      catch (value) { if (current === generation) error.value = sentenceServiceError(value); }
      finally { if (current === generation) { loading.value = false; pending = undefined; } }
      return current === generation && canManage.value;
    })();
    pending = task;
    return task;
  }
  return { canManage, loading, error, load, deny };
});
