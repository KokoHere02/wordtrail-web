import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { dailyApi } from '../api/daily';
import { ApiError } from '../api/http';
import { useAuthStore } from './auth';
import type { Pronunciation } from '../types/dailyTraining';

export const defaultPronunciation = (): Pronunciation => ({ autoPlay: false, accent: 'US', playbackRate: 1, repeatCount: 1 });
export const usePronunciation = defineStore('pronunciation', () => {
  const auth = useAuthStore(), value = ref(defaultPronunciation()), loaded = ref(false);
  let generation = 0, revision = 0, inflight: Promise<void> | undefined;
  watch(() => auth.user?.id, () => { generation++; value.value = defaultPronunciation(); loaded.value = false; inflight = undefined; }, { flush: 'sync' });
  function accept(settings: Pronunciation | undefined) {
    if (!settings) throw new ApiError('新版发音接口尚未就绪，请重启新版后端。', 'PRONUNCIATION_DEPLOYMENT_REQUIRED');
    value.value = { ...settings }; loaded.value = true;
  }
  async function load() {
    if (loaded.value) return;
    if (inflight) return inflight;
    const token = generation, readRevision = revision;
    const operation = dailyApi.settings().then(settings => { if (token === generation && readRevision === revision) accept(settings.pronunciation); });
    inflight = operation;
    try { await operation; } finally { if (inflight === operation) inflight = undefined; }
  }
  async function save(body: Pronunciation) {
    const token = generation;
    revision++;
    const settings = await dailyApi.pronunciation(body);
    if (token !== generation) throw new ApiError('登录状态已变化，请重新打开设置。', 'IDENTITY_CHANGED');
    accept(settings.pronunciation);
  }
  return { value, loaded, load, save };
});
