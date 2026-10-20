<script setup lang="ts">
import { BookOpen } from "lucide-vue-next";
</script>
<template>
  <main class="not-found">
    <BookOpen :size="36" :stroke-width="1.2" />
    <h1>这一页，似乎走丢了。</h1>
    <p class="muted">页面不存在，请回到词书继续。</p>
    <RouterLink to="/books" class="btn btn-primary">返回词书</RouterLink>
  </main>
</template>
