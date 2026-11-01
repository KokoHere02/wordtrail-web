import { getCurrentInstance, onDeactivated, onScopeDispose, ref } from 'vue';
import { audioBlob } from '../api/learningMedia';
import { ApiError, errorMessage } from '../api/http';
import type { Pronunciation } from '../types/dailyTraining';
import { preparePronunciation } from './preparePronunciation';

export function useAudioPlayer(onStale?: () => void) {
  const speaking = ref(false), loading = ref(false), error = ref('');
  let generation = 0, controller: AbortController | undefined, audio: HTMLAudioElement | undefined, objectUrl: string | undefined;
  function stop() {
    generation++; controller?.abort(); controller = undefined;
    if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); audio = undefined; }
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = undefined; }
    speaking.value = false; loading.value = false;
  }
  function waitUntilReady(element: HTMLAudioElement, signal: AbortSignal) {
    const haveEnoughData = 4; // HTMLMediaElement.HAVE_ENOUGH_DATA
    if (element.readyState >= haveEnoughData) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        element.removeEventListener('canplaythrough', ready);
        element.removeEventListener('error', failed);
        signal.removeEventListener('abort', aborted);
      };
      const ready = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('音频播放失败，请重试或切换学习方式。')); };
      const aborted = () => { cleanup(); resolve(); };
      element.addEventListener('canplaythrough', ready, { once: true });
      element.addEventListener('error', failed, { once: true });
      signal.addEventListener('abort', aborted, { once: true });
      if (signal.aborted) aborted();
      else if (element.readyState >= haveEnoughData) ready();
    });
  }
  async function play(source: string, settings: Pronunciation) {
    stop(); error.value = ''; const token = generation; controller = new AbortController(); loading.value = true;
    const current = () => token === generation;
    try {
      const blob = await audioBlob(source, settings.accent, controller.signal);
      if (!current()) return;
      const prepared = await preparePronunciation(blob, settings.playbackRate);
      if (!current()) return;
      objectUrl = URL.createObjectURL(prepared); audio = new Audio(objectUrl); audio.preload = 'auto'; audio.playbackRate = settings.playbackRate;
      await waitUntilReady(audio, controller.signal);
      if (!current() || !audio) return;
      let remaining = settings.repeatCount;
      const start = async () => {
        if (!current() || !audio) return;
        try { await audio.play(); if (current()) { speaking.value = true; loading.value = false; } }
        catch { if (current()) { stop(); error.value = '播放被浏览器阻止，请点击播放按钮。'; } }
      };
      audio.onended = () => {
        if (!current() || !audio) return;
        if (--remaining > 0) { audio.currentTime = 0; void start(); }
        else stop();
      };
      audio.onerror = () => { if (current()) { stop(); error.value = '音频播放失败，请重试或切换学习方式。'; } };
      await start();
    } catch (e) {
      if (!current()) return;
      stop();
      if (e instanceof ApiError && ['STALE_TRAINING_ANSWER', 'STALE_STUDY_MODE', 'DAILY_TASK_EXPIRED', 'PLAN_WORD_UNAVAILABLE', 'CONSOLIDATION_WORD_UNAVAILABLE', 'BATCH_ABANDONED'].includes(e.code)) {
        error.value = '题目已更新，正在重新同步。'; onStale?.();
      } else error.value = e instanceof ApiError && e.code === 'AUDIO_UNAVAILABLE' ? '音频暂不可用，请重试播放或切换学习方式。' : errorMessage(e);
    }
  }
  if (getCurrentInstance()) onDeactivated(stop);
  onScopeDispose(stop);
  return { play, stop, speaking, loading, error };
}
