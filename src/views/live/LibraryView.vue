<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, Plus, Search } from 'lucide-vue-next';
import { api } from '../../api';
import { useResource } from '../../composables/useResource';
import { useBooksStore } from '../../stores/books';
import type { Book, BookScope, Page } from '../../types/api';
import BookCover from '../../components/word/BookCover.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import BookProgress from '../../components/word/BookProgress.vue';
import BookEditorDialog from '../../components/word/BookEditorDialog.vue';
import AppButton from '../../components/ui/AppButton.vue';
const keyword = ref('');
const router = useRouter();
const appliedKeyword = ref('');
const scope = ref<BookScope>('ALL');
const scopes: { value: BookScope; label: string }[] = [{ value: 'ALL', label: '全部' }, { value: 'SYSTEM', label: '系统词书' }, { value: 'PERSONAL', label: '我的词本' }];
const editorOpen = ref(false);
const editingBook = ref<Book>();
const page = ref(1);
const size = 12;
const books = useBooksStore();
const { data, loading, error, load } = useResource<Page<Book>>();
const refresh = () => load(async () => { const result = await api.books({ page: page.value, size, keyword: appliedKeyword.value || undefined, scope: scope.value }); books.remember(result.records); return result; });
function search() { appliedKeyword.value = keyword.value.trim(); if (page.value !== 1) page.value = 1; else void refresh(); }
function edit(book?: Book) { editingBook.value = book; editorOpen.value = true; }
function saved(book: Book) {
  if (editingBook.value) void refresh();
  else void router.push(`/books/${book.id}`);
}
watch(scope, () => { if (page.value !== 1) page.value = 1; else void refresh(); });
watch(page, refresh);
onMounted(refresh);
</script>
<template>
  <div class="library-page">
    <header class="library-heading library-toolbar" aria-label="词书搜索与管理">
      <div class="library-heading-actions"><form class="library-search" role="search" @submit.prevent="search"><Search :size="22" /><input v-model="keyword" type="search" maxlength="128" aria-label="搜索词书" placeholder="搜索词书 / 词本" /><button class="violet-link" type="submit">搜索</button></form><AppButton @click="edit()"><Plus :size="18" />创建词本</AppButton></div>
    </header>
    <div class="category-tabs" role="group" aria-label="词书范围"><button v-for="entry in scopes" :key="entry.value" :class="{ active: scope === entry.value }" :aria-pressed="scope === entry.value" @click="scope = entry.value">{{ entry.label }}</button><span v-if="data" class="subtle-copy">{{ data.total }} 本</span></div>
    <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" :message="scope === 'PERSONAL' && !appliedKeyword ? '还没有个人词本，创建一本开始收词。' : '没有找到匹配的词书或词本。'" @retry="refresh" />
    <TransitionGroup v-if="!loading && !error" name="book-grid" tag="div" class="library-grid">
      <article v-for="(book, index) in data?.records" :key="book.id" class="library-card" :style="{ '--card-order': index }">
        <BookCover :label="book.name" /><div class="library-card-copy"><span class="subtle-copy">{{ book.bookType === 'PERSONAL' ? '个人词本' : '系统词书' }}</span><h2>{{ book.name }}</h2><p v-if="book.description">{{ book.description }}</p><span class="book-word-count">{{ book.wordCount.toLocaleString() }} 词</span><BookProgress :book="book" /></div>
        <div class="library-card-bottom"><RouterLink :to="`/books/${book.id}`" class="violet-link">查看词表<ArrowRight :size="18" /></RouterLink><button v-if="book.editable" class="muted-link" @click="edit(book)">编辑</button></div>
      </article>
    </TransitionGroup>
    <AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="page = $event" />
    <div class="library-bottom"><RouterLink to="/plan" class="btn btn-secondary">我的计划<ArrowRight :size="18" /></RouterLink></div>
    <BookEditorDialog v-model="editorOpen" :book="editingBook" @saved="saved" @unavailable="refresh" />
  </div>
</template>
<style scoped>
.library-toolbar .library-heading-actions { width: 100%; justify-content: flex-end; }
</style>
