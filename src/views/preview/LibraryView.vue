<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowRight, Info, Plus, Search, X } from "lucide-vue-next";
import { usePreviewStore } from "../../stores/preview";
import BookCover from "../../components/word/BookCover.vue";
import ProgressBar from "../../components/ui/ProgressBar.vue";
import AppDialog from "../../components/ui/AppDialog.vue";
const store = usePreviewStore();
const category = ref("全部");
const keyword = ref("");
const creating = ref(false);
const name = ref("");
const words = ref("");
const formError = ref("");
const categories = ["全部", "考试英语", "日常英语", "程序员", "我的词单"];
const filtered = computed(() =>
  store.books.filter(
    (book) =>
      (category.value === "全部" || book.category === category.value) &&
      `${book.name} ${book.label}`
        .toLowerCase()
        .includes(keyword.value.trim().toLowerCase()),
  ),
);
function createBook() {
  if (!name.value.trim()) {
    formError.value = "为你的词单取个名字吧。";
    return;
  }
  const entries = [
    ...new Set(
      words.value
        .split(/[\s,，;；]+/)
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (!entries.length) {
    formError.value = "至少写下一个想学的英文单词。";
    return;
  }
  if (entries.some((word) => !/^[a-z]+(?:['-][a-z]+)*$/.test(word))) {
    formError.value = "请填写英文单词，用空格或换行分隔。";
    return;
  }
  store.addBook(name.value.trim(), entries);
  creating.value = false;
  category.value = "我的词单";
  name.value = "";
  words.value = "";
  formError.value = "";
}
</script>
<template>
  <div class="library-page">
    <header class="library-heading">
      <div>
        <p class="overline reveal">YOUR NEXT WORD</p>
        <h1 class="reveal" style="--delay: 50ms">选一本，慢慢学。</h1>
        <p class="hero-subtitle reveal" style="--delay: 100ms">
          选择词书，再挑选想加入学习计划的单词。
        </p>
      </div>
      <div class="library-search reveal" style="--delay: 130ms">
        <Search :size="22" /><input
          v-model="keyword"
          type="search"
          aria-label="搜索词书"
          placeholder="搜索词书"
        /><button
          v-if="keyword"
          class="round-icon"
          aria-label="清空搜索"
          @click="keyword = ''"
        >
          <X :size="16" />
        </button>
      </div>
    </header>
    <nav
      class="category-tabs reveal"
      aria-label="词书分类"
      style="--delay: 160ms"
    >
      <button
        v-for="item in categories"
        :key="item"
        :class="{ active: category === item }"
        :aria-pressed="category === item"
        @click="category = item"
      >
        {{ item }}
      </button>
    </nav>
    <TransitionGroup name="book-grid" tag="div" class="library-grid"
      ><article
        v-for="(book, index) in filtered"
        :key="book.id"
        :class="[
          'library-card',
          { 'current-book': book.id === store.activeBookId },
        ]"
        :style="{ '--card-order': index }"
      >
        <BookCover :label="book.label" />
        <div class="library-card-copy">
          <span v-if="book.id === store.activeBookId" class="learning-badge"
            >正在学习</span
          >
          <h2>{{ book.name }}</h2>
          <p>{{ book.description }}</p>
          <span class="book-word-count"
            >{{ book.count.toLocaleString() }} 词</span
          >
        </div>
        <div class="library-card-bottom">
          <div v-if="book.id === store.activeBookId" class="card-mini-progress">
            <span>已选择 {{ store.selectedCount }} 词</span
            ><ProgressBar :value="store.selectedCount" :max="book.count" />
          </div>
          <RouterLink :to="`/books/${book.id}`" class="violet-link"
            >{{ book.id === store.activeBookId ? "管理词单" : "查看词表"
            }}<ArrowRight :size="18"
          /></RouterLink>
        </div>
      </article>
      <button
        v-if="category === '全部' || category === '我的词单'"
        key="create"
        class="library-card create-card"
        @click="creating = true"
      >
        <BookCover label="" empty />
        <div class="library-card-copy">
          <h2>创建我的词单</h2>
          <p>收集想学的单词，每天持续复习。</p>
        </div>
        <span class="violet-link"
          >新建词单<ArrowRight :size="18"
        /></span></button
    ></TransitionGroup>
    <div
      v-if="!filtered.length && category !== '我的词单'"
      class="library-empty"
    >
      <Search :size="30" />
      <h2>还没找到这本词书</h2>
      <p>换个关键词，或看看其他分类。</p>
      <button
        class="violet-link"
        @click="
          keyword = '';
          category = '全部';
        "
      >
        查看全部词书<ArrowRight :size="17" />
      </button>
    </div>
    <div class="library-bottom">
      <p><Info :size="21" />选词加入学习计划后，将根据记忆反馈安排每日复习。</p>
      <RouterLink to="/learn" class="btn btn-primary"
        >继续今日学习<ArrowRight :size="18"
      /></RouterLink>
    </div>
    <AppDialog
      v-model="creating"
      title="收藏一点新的可能"
      description="创建自己的词单，留住每个想学的词。"
      ><form class="word-list-form" @submit.prevent="createBook">
        <label for="new-list-name">词单名称</label
        ><input
          id="new-list-name"
          v-model="name"
          maxlength="40"
          placeholder="例如：阅读时遇见的词"
        /><label for="new-list-words">想学的单词</label
        ><textarea
          id="new-list-words"
          v-model="words"
          rows="4"
          placeholder="每个词用空格或换行分隔"
        />
        <p v-if="formError" class="inline-error" role="alert">
          {{ formError }}
        </p>
        <button class="btn btn-primary dialog-confirm" type="submit">
          <Plus :size="18" />创建词单
        </button>
      </form></AppDialog
    >
  </div>
</template>
