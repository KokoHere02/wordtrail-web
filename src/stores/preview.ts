import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { previewBooks, previewWords } from "../data/preview";
import type {
  PreviewBook,
  PreviewRecord,
  PreviewWord,
  Recall,
} from "../types/preview";
interface SavedPreview {
  activeBookId: number;
  selectionBookId: number;
  selectionEdited: boolean;
  selected: number[];
  customBooks: PreviewBook[];
  records: PreviewRecord[];
  dailyNew: number;
  autoNext: boolean;
  sound: boolean;
  accent: "en-US" | "en-GB";
}
function readSaved(): Partial<SavedPreview> {
  try {
    return JSON.parse(
      localStorage.getItem("wordory.ui.v2") || "{}",
    ) as Partial<SavedPreview>;
  } catch {
    return {};
  }
}
export const usePreviewStore = defineStore("preview", () => {
  const saved = readSaved();
  const activeBookId = ref(saved.activeBookId || 1);
  const selectionBookId = ref(saved.selectionBookId || activeBookId.value);
  const selectionEdited = ref(saved.selectionEdited || false);
  const selected = ref<number[]>(saved.selected || []);
  const customBooks = ref<PreviewBook[]>(saved.customBooks || []);
  const records = ref<PreviewRecord[]>(saved.records || []);
  const dailyNew = ref(saved.dailyNew || 12);
  const autoNext = ref(saved.autoNext ?? true);
  const sound = ref(saved.sound ?? true);
  const accent = ref<"en-US" | "en-GB">(saved.accent || "en-US");
  const settingsOpen = ref(false);
  const profileOpen = ref(false);
  const toast = ref("");
  let toastTimer: ReturnType<typeof setTimeout>;
  const books = computed(() => [...previewBooks, ...customBooks.value]);
  const activeBook = computed(
    () =>
      books.value.find((b) => b.id === activeBookId.value) || previewBooks[0]!,
  );
  const selectedCount = computed(() =>
    selectionEdited.value && selectionBookId.value === activeBookId.value
      ? selected.value.length
      : activeBookId.value === 1
        ? 428
        : 0,
  );
  const planLearned = computed(() =>
    !selectedCount.value
      ? 0
      : selectionEdited.value
        ? Math.min(selectedCount.value, memoryAnswers.value.length)
        : 156,
  );
  const memoryDone = ref(activeBookId.value === 1 ? 8 : 0);
  const dictationDone = ref(activeBookId.value === 1 ? 8 : 0);
  const memoryOffset = ref(memoryDone.value);
  const dictationOffset = ref(dictationDone.value);
  const dictationBaseCorrect = ref(dictationDone.value ? 6 : 0);
  const dictationGrades = ref<Record<number, boolean>>({});
  const dictationCorrect = computed(
    () =>
      dictationBaseCorrect.value +
      Object.values(dictationGrades.value).filter(Boolean).length,
  );
  const memorySeconds = ref(206);
  const dictationSeconds = ref(138);
  function gradeDictation(independent: boolean) {
    if (dictationGrades.value[dictationDone.value] === undefined)
      dictationGrades.value[dictationDone.value] = independent;
  }
  const memoryAnswers = ref<{ wordId: number; result: Recall }[]>(
    memoryDone.value
      ? previewWords.slice(36, 44).map((word, index) => ({
          wordId: word.id,
          result: index < 2 ? "forgot" : "known",
        }))
      : [],
  );
  const studyWords = computed<PreviewWord[]>(() => {
    let words = previewWords;
    if (activeBook.value.custom)
      words = (activeBook.value.words || []).map((word, index) => {
        const known = previewWords.find(
          (item) => item.word === word.toLowerCase(),
        );
        return {
          ...(known || {
            word,
            phonetic: "",
            meaning: "暂无释义",
            example: "",
            exampleZh: "先收藏这个词，再慢慢补充它的含义。",
          }),
          id: 10000 + index,
        };
      });
    if (selectionBookId.value === activeBookId.value && selected.value.length)
      words = words.filter((word) => selected.value.includes(word.id));
    return words.length ? words : previewWords;
  });
  const memoryTotal = computed(() => studyWords.value.length);
  const dictationTotal = computed(() => Math.min(20, studyWords.value.length));
  const memoryWord = computed(
    () =>
      studyWords.value[
        (memoryDone.value - memoryOffset.value + studyWords.value.length) %
          studyWords.value.length
      ]!,
  );
  const dictationWord = computed(
    () =>
      studyWords.value[
        (dictationDone.value -
          dictationOffset.value +
          studyWords.value.length) %
          studyWords.value.length
      ]!,
  );
  function notify(message: string) {
    clearTimeout(toastTimer);
    toast.value = message;
    toastTimer = setTimeout(() => {
      toast.value = "";
    }, 2800);
  }
  function resetMemory() {
    memoryDone.value = 0;
    memoryOffset.value = 0;
    memoryAnswers.value = [];
    memorySeconds.value = 0;
  }
  function resetDictation() {
    dictationDone.value = 0;
    dictationOffset.value = 0;
    dictationBaseCorrect.value = 0;
    dictationGrades.value = {};
    dictationSeconds.value = 0;
  }
  function setSelectionBook(id: number) {
    if (selectionBookId.value !== id) {
      selected.value = [];
      selectionBookId.value = id;
      selectionEdited.value = false;
    }
  }
  function chooseBook(id: number) {
    if (activeBookId.value !== id) {
      setSelectionBook(id);
      activeBookId.value = id;
      resetMemory();
      resetDictation();
    }
    notify("已将词书设为当前学习计划");
  }
  function toggleWord(id: number) {
    selectionEdited.value = true;
    selected.value = selected.value.includes(id)
      ? selected.value.filter((value) => value !== id)
      : [...selected.value, id];
  }
  function setSelection(ids: number[]) {
    selectionEdited.value = true;
    selected.value = ids;
  }
  function addBook(name: string, words: string[]) {
    const id = Date.now();
    customBooks.value.push({
      id,
      name,
      words,
      label: "MY WORDS",
      count: words.length,
      description: "为自己收藏的词，慢慢学，常常见。",
      category: "我的词单",
      custom: true,
    });
    notify("词单创建好了，开始一点新积累吧");
    return id;
  }
  function saveRound(
    mode: PreviewRecord["mode"],
    seconds: number,
    independent = 0,
  ) {
    const known =
      mode === "记忆复习"
        ? memoryAnswers.value.filter((a) => a.result === "known").length
        : independent;
    const uncertain =
      mode === "记忆复习"
        ? memoryAnswers.value.filter((a) => a.result === "uncertain").length
        : 0;
    const total =
      mode === "记忆复习" ? memoryAnswers.value.length : dictationDone.value;
    const record: PreviewRecord = {
      id: Date.now(),
      bookName: activeBook.value.name,
      mode,
      total,
      known,
      uncertain,
      forgot: Math.max(0, total - known - uncertain),
      seconds,
      createdAt: new Date().toISOString(),
    };
    records.value.unshift(record);
    return record;
  }
  watch(
    [
      activeBookId,
      selectionBookId,
      selectionEdited,
      selected,
      customBooks,
      records,
      dailyNew,
      autoNext,
      sound,
      accent,
    ],
    () => {
      const data: SavedPreview = {
        activeBookId: activeBookId.value,
        selectionBookId: selectionBookId.value,
        selectionEdited: selectionEdited.value,
        selected: selected.value,
        customBooks: customBooks.value,
        records: records.value,
        dailyNew: dailyNew.value,
        autoNext: autoNext.value,
        sound: sound.value,
        accent: accent.value,
      };
      try {
        localStorage.setItem("wordory.ui.v2", JSON.stringify(data));
      } catch {
        /* Preview works without browser storage. */
      }
    },
    { deep: true },
  );
  return {
    activeBookId,
    selected,
    books,
    activeBook,
    selectedCount,
    planLearned,
    dailyNew,
    autoNext,
    sound,
    accent,
    settingsOpen,
    profileOpen,
    records,
    toast,
    memoryDone,
    dictationDone,
    memoryWord,
    dictationWord,
    memoryAnswers,
    memoryTotal,
    dictationTotal,
    dictationBaseCorrect,
    dictationCorrect,
    gradeDictation,
    memorySeconds,
    dictationSeconds,
    notify,
    chooseBook,
    toggleWord,
    setSelection,
    setSelectionBook,
    addBook,
    saveRound,
    resetMemory,
    resetDictation,
  };
});
