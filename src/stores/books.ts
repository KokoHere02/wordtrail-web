import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../api";
import type { Book } from "../types/api";
export const useBooksStore = defineStore("books", () => {
  const books = ref<Record<number, Book>>({});
  function remember(items: Book[]) {
    for (const book of items) books.value[book.id] = book;
  }
  function clear() {
    books.value = {};
  }
  async function find(id: number): Promise<Book> {
    if (books.value[id]) return books.value[id];
    // No single-book endpoint exists. Scan the documented paginated catalog.
    for (let page = 1; ; page++) {
      const result = await api.books({ page, size: 100 });
      remember(result.records);
      if (books.value[id]) return books.value[id];
      if (page * result.size >= result.total || !result.records.length)
        throw new Error("找不到这本词书，或你没有访问权限。");
    }
  }
  return { books, remember, find, clear };
});
