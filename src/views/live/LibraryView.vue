<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ArrowRight, Search } from 'lucide-vue-next';
import { api } from '../../api';
import { useResource } from '../../composables/useResource';
import { useBooksStore } from '../../stores/books';
import type { Book, Page } from '../../types/api';
import BookCover from '../../components/word/BookCover.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
const keyword = ref('');
const page = ref(1);
const size = 12;
const books = useBooksStore();
const { data, loading, error, load } = useResource<Page<Book>>();
const refresh = () => load(async () => { const result = await api.books({ page: page.value, size, keyword: keyword.value.trim() || undefined }); books.remember(result.records); return result; });
function search() { if (page.value !== 1) page.value = 1; else void refresh(); }
watch(page, refresh);
onMounted(refresh);
</script>
<template>
  <div class="library-page">
    <header class="library-heading"><div><h1 class="reveal" style="--delay: 50ms">词库</h1></div>
      <form class="library-search" role="search" @submit.prevent="search"><Search :size="22" /><input v-model="keyword" type="search" aria-label="搜索词书" placeholder="搜索词书" /><button class="violet-link" type="submit">搜索</button></form>
    </header>
    <div class="category-tabs"><span class="subtle-copy">全部词书 <template v-if="data">· {{ data.total }} 本</template></span></div>
    <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" message="没有找到这本词书，换个关键词试试。" @retry="refresh" />
    <TransitionGroup v-if="!loading && !error" name="book-grid" tag="div" class="library-grid">
      <article v-for="(book, index) in data?.records" :key="book.id" class="library-card" :style="{ '--card-order': index }">
        <BookCover :label="book.name" /><div class="library-card-copy"><h2>{{ book.name }}</h2><p v-if="book.description">{{ book.description }}</p><span class="book-word-count">{{ book.wordCount.toLocaleString() }} 词</span></div>
        <div class="library-card-bottom"><RouterLink :to="`/books/${book.id}`" class="violet-link">查看词表<ArrowRight :size="18" /></RouterLink></div>
      </article>
    </TransitionGroup>
    <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="page = $event" />
    <div class="library-bottom"><RouterLink to="/plan" class="btn btn-secondary">我的计划<ArrowRight :size="18" /></RouterLink></div>
  </div>
</template>
