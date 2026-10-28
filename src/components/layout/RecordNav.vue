<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
const links = [{ path: '/records', label: '每日学习' }, { path: '/records/dictation', label: '单词默写' }, { path: '/sentences/records', label: '句子练习' }, { path: '/statistics', label: '单词统计' }, { path: '/sentences/statistics', label: '句子统计' }];
</script>
<template><nav class="section-hub-nav" aria-label="学习历史与统计"><RouterLink v-for="link in links" :key="link.path" :to="link.path" :class="{ active: route.path === link.path }">{{ link.label }}</RouterLink></nav></template>
