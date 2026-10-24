import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { usePreviewStore } from "../stores/preview";
import { useWordSpeech } from './useWordSpeech';
export function usePreviewSession(
  initialSeconds: number,
  save?: (seconds: number) => void,
) {
  const seconds = ref(initialSeconds);
  let interval: ReturnType<typeof setInterval>;
  onMounted(() => {
    interval = setInterval(() => {
      if (!document.hidden) seconds.value++;
    }, 1000);
  });
  onBeforeUnmount(() => {
    clearInterval(interval);
    save?.(seconds.value);
  });
  const time = computed(
    () =>
      `${String(Math.floor(seconds.value / 60)).padStart(2, "0")}:${String(seconds.value % 60).padStart(2, "0")}`,
  );
  return { seconds, time };
}
export function usePronunciation() {
  const { speak: pronounce, speaking } = useWordSpeech(message => usePreviewStore().notify(message));
  function speak(word: string) {
    const store = usePreviewStore();
    if (!store.sound) {
      store.notify("单词发音已关闭，可在偏好设置中开启");
      return;
    }
    pronounce(word, store.accent);
  }
  return { speak, speaking };
}
