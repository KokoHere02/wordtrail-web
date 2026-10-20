<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  RotateCcw,
  Volume2,
} from "lucide-vue-next";
import { usePreviewStore } from "../../stores/preview";
import {
  usePreviewSession,
  usePronunciation,
} from "../../composables/usePreviewSession";
import StudyToolbar from "../../components/learning/StudyToolbar.vue";
import SessionStats from "../../components/learning/SessionStats.vue";
const store = usePreviewStore();
const router = useRouter();
const { time, seconds } = usePreviewSession(store.dictationSeconds, (value) => {
  store.dictationSeconds = value;
});
const { speak, speaking } = usePronunciation();
const typed = ref(store.dictationDone === 8 ? "aban" : "");
const input = ref<HTMLInputElement>();
const phase = ref<"typing" | "correct" | "revealed" | "incorrect">("typing");
const helped = ref(false);
const independent = computed(() => store.dictationCorrect);
const transitioning = ref(false);
const letters = computed(() => [...store.dictationWord.word]);
const status = computed(() =>
  phase.value === "correct"
    ? "拼写正确，把这个词记住了。"
    : phase.value === "revealed"
      ? "答案在这里，再看一眼，把它记住。"
      : phase.value === "incorrect"
        ? "有些字母还不太对，退格修改，再试试。"
        : `已输入 ${typed.value.length} / ${letters.value.length} 个字母`,
);
function pronounce() {
  speak(store.dictationWord.word);
}
function update(event: Event) {
  if (phase.value === "correct" || phase.value === "revealed") return;
  const element = event.target as HTMLInputElement;
  typed.value = element.value
    .replace(/[^a-z'-]/gi, "")
    .toLowerCase()
    .slice(0, letters.value.length);
  element.value = typed.value;
  if (typed.value.length === letters.value.length) {
    phase.value =
      typed.value === store.dictationWord.word ? "correct" : "incorrect";
    if (phase.value === "correct" && !helped.value) store.gradeDictation(true);
  } else phase.value = "typing";
}
function reveal() {
  helped.value = true;
  store.gradeDictation(false);
  typed.value = store.dictationWord.word;
  phase.value = "revealed";
}
function showHint(value: "none" | "first") {
  if (value === "first" && phase.value === "typing") {
    helped.value = true;
    store.gradeDictation(false);
    if (!typed.value) typed.value = store.dictationWord.word[0] || "";
    store.notify("已提示首字母，本词不计入独立答对");
  }
}
async function next() {
  if (transitioning.value) return;
  if (phase.value !== "correct" && phase.value !== "revealed") {
    reveal();
    return;
  }
  transitioning.value = true;
  store.dictationDone++;
  if (store.dictationDone >= store.dictationTotal) {
    const record = store.saveRound(
      "单词默写",
      seconds.value,
      independent.value,
    );
    await router.push(`/records/${record.id}`);
    return;
  }
  typed.value = "";
  phase.value = "typing";
  helped.value = false;
  await nextTick();
  input.value?.focus({ preventScroll: true });
  transitioning.value = false;
}
function retry() {
  typed.value = "";
  phase.value = "typing";
  helped.value = true;
  input.value?.focus();
}
function keyboard(event: KeyboardEvent) {
  if (store.settingsOpen || store.profileOpen) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
    event.preventDefault();
    pronounce();
  }
  if (
    event.key === "Enter" &&
    !(event.target instanceof HTMLElement && event.target.closest("button,a"))
  ) {
    event.preventDefault();
    void next();
  }
}
onMounted(() => {
  if (store.dictationDone >= store.dictationTotal) {
    store.resetDictation();
    typed.value = "";
    seconds.value = 0;
  }
  document.addEventListener("keydown", keyboard);
  if (window.innerWidth > 640) input.value?.focus({ preventScroll: true });
});
onBeforeUnmount(() => document.removeEventListener("keydown", keyboard));
</script>
<template>
  <div class="dictation-page practice-page">
    <div class="practice-breadcrumb">
      <p>
        <RouterLink :to="`/books/${store.activeBookId}`">{{
          store.activeBook.name
        }}</RouterLink
        ><ChevronRight :size="17" /><span>单词默写</span
        ><span class="practice-badge">中译英</span>
      </p>
      <RouterLink to="/today" class="violet-link"
        >返回今日<ArrowLeft :size="17"
      /></RouterLink>
    </div>
    <StudyToolbar
      mode="dictation"
      :speaking="speaking"
      @speak="pronounce"
      @hint="showHint"
    />
    <div class="dictation-content">
      <p class="practice-counter">
        本轮 {{ Math.min(store.dictationDone + 1, store.dictationTotal) }} /
        {{ store.dictationTotal }}
      </p>
      <div class="dictation-word-stage">
        <Transition name="word" mode="out-in"
          ><h1 :key="store.dictationWord.id" class="dictation-meaning">
            {{ store.dictationWord.meaning }}
          </h1></Transition
        >
      </div>
      <button
        :class="['dictation-audio', { 'is-speaking': speaking }]"
        @click="pronounce"
      >
        <Volume2 :size="22" />听发音
      </button>
      <div
        :class="[
          'spelling-field',
          {
            'spelling-long': letters.length > 12,
            'spelling-very-long': letters.length > 18,
            'spelling-correct': phase === 'correct',
            'spelling-error': phase === 'incorrect',
          },
        ]"
        :style="{ '--letters': letters.length }"
        @click="input?.focus()"
      >
        <label for="spelling-input" class="sr-only">输入英文拼写</label
        ><input
          id="spelling-input"
          ref="input"
          :value="typed"
          :readonly="phase === 'correct' || phase === 'revealed'"
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          :spellcheck="false"
          :maxlength="letters.length"
          aria-describedby="spelling-help spelling-status"
          @input="update"
        /><span
          v-for="(letter, index) in letters"
          :key="`${store.dictationWord.id}-${index}`"
          :class="[
            'letter-cell',
            {
              filled: !!typed[index],
              matching: typed[index] === letter,
              mismatched: !!typed[index] && typed[index] !== letter,
              caret: typed.length === index && phase === 'typing',
              revealed: phase === 'revealed',
            },
          ]"
          aria-hidden="true"
          ><span v-if="typed[index]" :key="typed[index]" class="letter-pop">{{
            typed[index]
          }}</span></span
        >
      </div>
      <p id="spelling-help" class="spelling-help">直接输入英文，按退格修正</p>
      <p
        id="spelling-status"
        :class="[
          'spelling-status',
          {
            'status-error': phase === 'incorrect',
            'status-success': phase === 'correct',
          },
        ]"
        role="status"
      >
        <CheckCircle2 v-if="phase !== 'incorrect'" :size="21" />{{ status }}
      </p>
      <div class="dictation-actions">
        <template v-if="phase === 'typing' || phase === 'incorrect'"
          ><button class="muted-link" @click="reveal">
            <Eye :size="21" />查看答案</button
          ><span class="toolbar-divider" /><button
            class="violet-link"
            @click="reveal"
          >
            暂时不会<ArrowRight :size="19" /></button></template
        ><template v-else
          ><button class="muted-link" @click="retry">
            <RotateCcw :size="18" />再拼一次</button
          ><span class="toolbar-divider" /><button
            class="violet-link"
            @click="next"
          >
            {{
              store.dictationDone + 1 === store.dictationTotal
                ? "完成本轮"
                : "下一个词"
            }}<ArrowRight :size="19" /></button
        ></template>
      </div>
      <div
        class="segment-progress"
        role="img"
        :aria-label="`已练习 ${store.dictationDone} / ${store.dictationTotal} 个词`"
      >
        <span
          v-for="index in store.dictationTotal"
          :key="index"
          :class="{
            done: index <= store.dictationDone,
            current: index === store.dictationDone + 1,
          }"
        />
      </div>
      <SessionStats
        :time="time"
        :done="store.dictationDone"
        :total="store.dictationTotal"
        :extra="independent"
        mode="dictation"
      />
    </div>
  </div>
</template>
