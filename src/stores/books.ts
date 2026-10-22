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
    // Counts and edit permission are live server data, including on deep links.
    const book = await api.book(id);
    remember([book]);
    return book;
  }
  return { books, remember, find, clear };
});
