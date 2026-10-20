import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { usePreviewStore } from "../stores/preview";
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
  const speaking = ref(false);
  let timer: ReturnType<typeof setTimeout>;
  function speak(word: string) {
    const store = usePreviewStore();
    if (!store.sound) {
      store.notify("单词发音已关闭，可在偏好设置中开启");
      return;
    }
    if (!("speechSynthesis" in window)) {
      store.notify("当前浏览器暂不支持语音朗读");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = store.accent;
    utterance.rate = 0.82;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(
      (voice) => voice.lang.replace("_", "-") === store.accent,
    );
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      speaking.value = false;
    };
    utterance.onerror = () => {
      speaking.value = false;
      store.notify("朗读暂不可用，请检查系统语音设置");
    };
    speaking.value = true;
    window.speechSynthesis.speak(utterance);
    clearTimeout(timer);
    timer = setTimeout(() => {
      speaking.value = false;
    }, 5000);
  }
  onBeforeUnmount(() => {
    clearTimeout(timer);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  });
  return { speak, speaking };
}
