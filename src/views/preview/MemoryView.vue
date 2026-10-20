<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Volume2,
} from "lucide-vue-next";
import StudyToolbar from "../../components/learning/StudyToolbar.vue";
import SessionStats from "../../components/learning/SessionStats.vue";
import { usePreviewStore } from "../../stores/preview";
import {
  usePreviewSession,
  usePronunciation,
} from "../../composables/usePreviewSession";
import type { Recall } from "../../types/preview";
const store = usePreviewStore();
const router = useRouter();
const { time, seconds } = usePreviewSession(store.memorySeconds, (value) => {
  store.memorySeconds = value;
});
const { speak, speaking } = usePronunciation();
const selected = ref<Recall | null>(
  store.memoryAnswers[store.memoryDone]?.result ?? null,
);
const advancing = ref(false);
const feedback = ref("absorb · 明天再次复习");
let timer: ReturnType<typeof setTimeout>;
const choices: { value: Recall; title: string; hint: string; key: string }[] = [
  { value: "forgot", title: "忘记", hint: "本轮稍后再见", key: "1" },
  { value: "uncertain", title: "模糊", hint: "明天再复习", key: "2" },
  { value: "known", title: "认识", hint: "3 天后复习", key: "3" },
];
const forgotten = computed(
  () =>
    store.memoryAnswers.filter((answer) => answer.result === "forgot").length,
);
const example = computed(() => {
  const word = store.memoryWord;
  const index = word.example.toLowerCase().indexOf(word.word);
  return index < 0
    ? { before: word.example, word: "", after: "" }
    : {
        before: word.example.slice(0, index),
        word: word.example.slice(index, index + word.word.length),
        after: word.example.slice(index + word.word.length),
      };
});
function pronounce() {
  speak(store.memoryWord.word);
}
function next() {
  if (advancing.value || !selected.value) return;
  clearTimeout(timer);
  advancing.value = true;
  store.memoryDone++;
  if (store.memoryDone >= store.memoryTotal) {
    const record = store.saveRound("记忆复习", seconds.value);
    void router.push(`/records/${record.id}`);
    return;
  }
  selected.value = null;
  timer = setTimeout(() => {
    advancing.value = false;
  }, 440);
}
function rate(value: Recall) {
  if (selected.value || advancing.value || store.settingsOpen) return;
  selected.value = value;
  store.memoryAnswers.push({ wordId: store.memoryWord.id, result: value });
  const choice = choices.find((choice) => choice.value === value)!;
  feedback.value = `${store.memoryWord.word} · ${choice.hint}`;
  if (store.autoNext) timer = setTimeout(next, 520);
}
function keyboard(event: KeyboardEvent) {
  if (
    store.settingsOpen ||
    store.profileOpen ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    (event.target instanceof HTMLElement &&
      event.target.closest("input,select,textarea,[contenteditable=true]"))
  )
    return;
  const choice = choices.find((choice) => choice.key === event.key);
  if (choice) {
    event.preventDefault();
    rate(choice.value);
  }
  const isControl =
    event.target instanceof HTMLElement && event.target.closest("button,a");
  if (event.code === "Space" && !isControl) {
    event.preventDefault();
    pronounce();
  }
  if (event.key === "Enter" && selected.value && !isControl) {
    event.preventDefault();
    next();
  }
}
onMounted(() => {
  if (store.memoryDone >= store.memoryTotal) {
    store.resetMemory();
    seconds.value = 0;
    selected.value = null;
  }
  if (selected.value) {
    feedback.value = `${store.memoryWord.word} · ${choices.find((choice) => choice.value === selected.value)!.hint}`;
    if (store.autoNext) timer = setTimeout(next, 520);
  }
  document.addEventListener("keydown", keyboard);
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  document.removeEventListener("keydown", keyboard);
});
</script>
<template>
  <div class="memory-page practice-page">
    <div class="practice-breadcrumb">
      <p>
        <RouterLink :to="`/books/${store.activeBookId}`">{{
          store.activeBook.name
        }}</RouterLink
        ><ChevronRight :size="17" /><span>今日复习</span
        ><span class="practice-badge">复习</span>
      </p>
      <RouterLink to="/today" class="violet-link"
        >返回今日<ArrowLeft :size="17"
      /></RouterLink>
    </div>
    <StudyToolbar mode="memory" :speaking="speaking" @speak="pronounce" />
    <div class="memory-content">
      <p class="practice-counter">
        今日 {{ Math.min(store.memoryDone + 1, store.memoryTotal) }} /
        {{ store.memoryTotal }}
      </p>
      <div class="memory-word-stage">
        <Transition name="word" mode="out-in"
          ><section :key="store.memoryWord.id" class="memory-word-content">
            <div class="memory-title">
              <h1
                :class="{
                  'long-memory-word': store.memoryWord.word.length > 14,
                }"
                lang="en"
              >
                {{ store.memoryWord.word }}
              </h1>
              <button
                :class="['round-icon word-audio', { 'is-speaking': speaking }]"
                aria-label="播放当前单词发音"
                @click="pronounce"
              >
                <Volume2 :size="26" />
              </button>
            </div>
            <p class="memory-phonetic">{{ store.memoryWord.phonetic }}</p>
            <p class="memory-meaning">{{ store.memoryWord.meaning }}</p>
            <p class="memory-example" lang="en">
              {{ example.before }}<strong>{{ example.word }}</strong
              >{{ example.after }}
            </p>
            <p class="memory-example-zh">{{ store.memoryWord.exampleZh }}</p>
          </section></Transition
        >
      </div>
      <div class="recall-options" role="group" aria-label="你对这个单词的记忆">
        <button
          v-for="choice in choices"
          :key="choice.value"
          :class="[
            'recall-card',
            `recall-${choice.value}`,
            {
              picked: selected === choice.value,
              'auto-advance': selected === choice.value && store.autoNext,
            },
          ]"
          :disabled="!!selected || advancing"
          :aria-pressed="selected === choice.value"
          @click="rate(choice.value)"
        >
          <strong>{{ choice.title }}</strong
          ><span>{{ choice.hint }} · {{ choice.key }}</span
          ><Check
            v-if="selected === choice.value"
            class="recall-check"
            :size="17"
          />
        </button>
      </div>
      <div class="recall-caption">
        <button
          v-if="selected && !store.autoNext"
          class="violet-link"
          @click="next"
        >
          下一个单词<ArrowRight :size="17" /></button
        ><span v-else>认识的词，也会在之后的复习中再次出现</span>
      </div>
      <SessionStats
        :time="time"
        :done="store.memoryDone"
        :total="store.memoryTotal"
        :extra="forgotten"
        mode="memory"
      /><Transition name="feedback" mode="out-in"
        ><p :key="feedback" class="practice-feedback" role="status">
          <Check :size="20" />{{ feedback }}
        </p></Transition
      >
    </div>
  </div>
</template>
