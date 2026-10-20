<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Search,
  SlidersHorizontal,
} from "lucide-vue-next";
import { usePreviewStore } from "../../stores/preview";
import { previewWords } from "../../data/preview";
import BookCover from "../../components/word/BookCover.vue";
const store = usePreviewStore();
const route = useRoute();
const router = useRouter();
const book = computed(() =>
  store.books.find((book) => book.id === Number(route.params.bookId)),
);
store.setSelectionBook(Number(route.params.bookId));
const keyword = ref("");
const filter = ref("全部");
const page = ref(1);
const size = 10;
const words = computed(() =>
  book.value?.custom
    ? (book.value.words || []).map((word, index) => ({
        id: 10000 + index,
        word,
        phonetic: "",
        meaning: "我的收藏词汇",
      }))
    : previewWords,
);
const filtered = computed(() =>
  words.value.filter(
    (word) =>
      word.word.toLowerCase().includes(keyword.value.toLowerCase()) &&
      (filter.value !== "已选择" || store.selected.includes(word.id)),
  ),
);
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * size, page.value * size),
);
const pageSelected = computed(
  () =>
    paged.value.length > 0 &&
    paged.value.every((word) => store.selected.includes(word.id)),
);
function selectPage() {
  const ids = paged.value.map((word) => word.id);
  store.setSelection(
    pageSelected.value
      ? store.selected.filter((id) => !ids.includes(id))
      : [...new Set([...store.selected, ...ids])],
  );
}
function start() {
  if (book.value) store.chooseBook(book.value.id);
  store.resetMemory();
  store.resetDictation();
  store.notify("词单已经准备好，进入今日复习");
  void router.push("/learn");
}
</script>
<template>
  <div class="wordlist-page">
    <RouterLink to="/books" class="muted-link back-to-library"
      ><ArrowLeft :size="17" />返回词库</RouterLink
    ><template v-if="book"
      ><header class="wordlist-heading">
        <BookCover :label="book.label" />
        <div>
          <p class="overline">YOUR WORD COLLECTION</p>
          <h1>{{ book.name }}</h1>
          <p>{{ book.description }}</p>
          <span class="subtle-copy"
            >{{ book.count.toLocaleString() }} 词 · 本地样本预览</span
          >
        </div>
        <button class="btn btn-secondary" @click="store.chooseBook(book.id)">
          <Check v-if="store.activeBookId === book.id" :size="17" />{{
            store.activeBookId === book.id ? "当前学习词书" : "设为学习词书"
          }}
        </button>
      </header>
      <section class="wordlist-sheet">
        <div class="wordlist-tools">
          <div class="category-tabs">
            <button
              v-for="value in ['全部', '已选择']"
              :key="value"
              :class="{ active: filter === value }"
              @click="
                filter = value;
                page = 1;
              "
            >
              {{ value }}
            </button>
          </div>
          <div class="library-search">
            <Search :size="19" /><input
              v-model="keyword"
              type="search"
              placeholder="寻找一个单词"
              aria-label="搜索单词"
              @input="page = 1"
            />
          </div>
        </div>
        <div class="wordlist-selection">
          <label
            ><input
              type="checkbox"
              :checked="pageSelected"
              @change="selectPage"
            />选择当前页</label
          ><span>已选 {{ store.selected.length }} 词</span
          ><button
            v-if="store.selected.length"
            class="muted-link"
            @click="store.setSelection([])"
          >
            清空选择
          </button>
        </div>
        <div
          v-for="(word, index) in paged"
          :key="word.id"
          class="preview-word-row"
          :style="{ '--delay': `${index * 20}ms` }"
        >
          <label
            ><input
              type="checkbox"
              :checked="store.selected.includes(word.id)"
              :aria-label="`选择 ${word.word}`"
              @change="store.toggleWord(word.id)"
            /><span
              ><strong lang="en">{{ word.word }}</strong
              ><small>{{ word.phonetic }}</small></span
            ></label
          >
          <p>{{ word.meaning }}</p>
          <span
            :class="[
              'word-selected-state',
              { added: store.selected.includes(word.id) },
            ]"
            ><Check :size="14" v-if="store.selected.includes(word.id)" />{{
              store.selected.includes(word.id) ? "已加入" : "未选择"
            }}</span
          >
        </div>
        <div v-if="!paged.length" class="library-empty">
          <Search :size="28" />
          <p>这里还没有符合条件的词。</p>
        </div>
        <div class="wordlist-pagination">
          <span>当前展示 {{ filtered.length }} 个本地样本</span>
          <div>
            <button
              class="round-icon"
              aria-label="上一页"
              :disabled="page <= 1"
              @click="page--"
            >
              <ArrowLeft :size="17" /></button
            ><span
              >{{ page }} /
              {{ Math.max(1, Math.ceil(filtered.length / size)) }}</span
            ><button
              class="round-icon"
              aria-label="下一页"
              :disabled="page * size >= filtered.length"
              @click="page++"
            >
              <ArrowRight :size="17" />
            </button>
          </div>
        </div>
      </section>
      <div class="wordlist-bottom">
        <span><CheckCheck :size="20" />把想学的词，放进每天的积累。</span
        ><button class="btn btn-primary" @click="start">
          开始学习<ArrowRight :size="18" />
        </button></div
    ></template>
    <div v-else class="library-empty">
      <SlidersHorizontal :size="30" />
      <h1>这本词书还未收藏</h1>
      <RouterLink to="/books" class="violet-link"
        >回到词库<ArrowRight :size="17"
      /></RouterLink>
    </div>
  </div>
</template>
