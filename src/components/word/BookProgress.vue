<script setup lang="ts">
import type { Book } from '../../types/api';
defineProps<{ book: Book }>();
</script>
<template>
  <dl class="book-progress" aria-label="词本学习进度">
    <div><dt>未学</dt><dd>{{ book.unlearnedCount }}</dd></div>
    <div><dt>已开始</dt><dd>{{ book.startedCount }}</dd></div>
    <div><dt>到期</dt><dd>{{ book.dueCount }}</dd></div>
  </dl>
</template>
