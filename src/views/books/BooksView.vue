<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ArrowRight, BookOpen } from "lucide-vue-next";
import { api } from "../../api";
import { useBooksStore } from "../../stores/books";
import { useResource } from "../../composables/useResource";
import type { Book, Page } from "../../types/api";
import AppPagination from "../../components/ui/AppPagination.vue";
import SearchField from "../../components/ui/SearchField.vue";
import StatePanel from "../../components/ui/StatePanel.vue";
const { data, loading, error, load } = useResource<Page<Book>>();
const catalog = useBooksStore();
const keyword = ref("");
const applied = ref("");
const page = ref(1);
const size = 8;
function reload() {
  void load(async () => {
    const result = await api.books({
      page: page.value,
      size,
      ...(applied.value ? { keyword: applied.value } : {}),
    });
    catalog.remember(result.records);
    return result;
  });
}
let timer: ReturnType<typeof setTimeout>;
watch(keyword, () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    applied.value = keyword.value.trim();
    page.value = 1;
    reload();
  }, 250);
});
onBeforeUnmount(() => clearTimeout(timer));
onMounted(reload);
function changePage(value: number) {
  page.value = value;
  reload();
}
</script>
<template>
  <section class="page-heading">
    <div>
      <div class="eyebrow">YOUR WORD COLLECTIONS</div>
      <h1>在词与词之间，慢慢积累。</h1>
      <p>选一本词书，从今天的第一个单词开始。</p>
    </div>
  </section>
  <div class="catalog-toolbar">
    <span class="catalog-count"
      >词书收藏 <span v-if="data">/ {{ data.total }} 本</span></span
    ><SearchField
      v-model="keyword"
      label="搜索词书名称"
      placeholder="寻找一本词书"
    />
  </div>
  <StatePanel
    :loading="loading"
    :error="error"
    :empty="data?.total === 0"
    message="没有找到这本词书，试试其他名称。"
    @retry="reload"
  />
  <div v-if="!loading && !error" class="book-grid">
    <RouterLink
      v-for="book in data?.records"
      :key="book.id"
      :to="`/books/${book.id}`"
      class="book-card"
      ><div class="book-card-top">
        <BookOpen :size="22" :stroke-width="1.4" /><span>{{
          String(book.id).padStart(2, "0")
        }}</span>
      </div>
      <h2>{{ book.name }}</h2>
      <p>{{ book.description || "打开词书，开启一轮专注学习。" }}</p>
      <div class="book-card-bottom">
        <span>{{ book.wordCount.toLocaleString() }} 个单词</span
        ><strong>打开词书<ArrowRight :size="16" /></strong></div
    ></RouterLink>
  </div>
  <AppPagination
    v-if="data"
    :page="page"
    :size="size"
    :total="data.total"
    :disabled="loading"
    @change="changePage"
  />
  <p class="page-footnote">不必一次记住所有，只要每次向前一点。</p>
</template>
