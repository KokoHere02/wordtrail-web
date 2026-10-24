import { onBeforeUnmount, onDeactivated, ref, watch } from 'vue';
import { useStudySurface } from './useStudySurface';

export function useWordSpeech(onError?: (message: string) => void) {
  const speaking = ref(false);
  const error = ref('');
  let generation = 0;
  const surface = useStudySurface();
  if (surface) watch(surface.active, value => { if (!value) stop(); });
  onDeactivated(stop);
  function stop() {
    generation++;
    speaking.value = false;
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch { /* Cleanup must not block navigation. */ }
  }
  function fail(message: string) { speaking.value = false; error.value = message; onError?.(message); }
  function speak(word: string, accent = 'en-US') {
    stop(); error.value = '';
    if (!word.trim()) return;
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') { fail('当前浏览器暂不支持单词朗读'); return; }
    const current = generation;
    try {
      const utterance = new window.SpeechSynthesisUtterance(word);
      utterance.lang = accent;
      utterance.rate = 0.82;
      const voice = window.speechSynthesis.getVoices().find(value => value.lang.replace('_', '-').toLowerCase() === accent.toLowerCase());
      if (voice) utterance.voice = voice;
      utterance.onend = () => { if (current === generation) speaking.value = false; };
      utterance.onerror = event => { if (current !== generation) return; speaking.value = false; if (event.error !== 'canceled' && event.error !== 'interrupted') fail('朗读暂不可用，请检查系统语音设置'); };
      speaking.value = true;
      window.speechSynthesis.speak(utterance);
    } catch { fail('朗读暂不可用，请检查系统语音设置'); }
  }
  onBeforeUnmount(stop);
  return { speak, stop, speaking, error };
}
