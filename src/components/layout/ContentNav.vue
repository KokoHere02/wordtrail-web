<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
</script>
<template><nav class="section-hub-nav content-kind-nav" aria-label="内容库分类"><RouterLink to="/books" :class="{ active: !route.path.startsWith('/sentences') }">单词</RouterLink><RouterLink to="/sentences" :class="{ active: route.path.startsWith('/sentences') }">句子</RouterLink><RouterLink v-if="!route.path.startsWith('/sentences')" to="/plan">学习计划</RouterLink><RouterLink v-if="!route.path.startsWith('/sentences')" to="/weak-words">薄弱词</RouterLink><RouterLink v-if="!route.path.startsWith('/sentences')" to="/dictation/mistakes">默写待巩固</RouterLink></nav></template>
