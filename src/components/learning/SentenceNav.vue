<script setup lang="ts">
import { onMounted } from 'vue';
import { useSentenceManagementAccess } from '../../stores/sentenceManagementAccess';
defineProps<{ active: 'BANK' | 'FAVORITES' | 'REVIEW' | 'DUE' | 'RECORDS' | 'STATISTICS' | 'MANAGEMENT' | 'NOTES' }>();
const access = useSentenceManagementAccess();
onMounted(() => access.load());
const entries = [{ value: 'NOTES', label: '个人笔记', path: '/sentences/notes' }, { value: 'BANK', label: '题库', path: '/sentences' }, { value: 'FAVORITES', label: '收藏', path: '/sentences/favorites' }, { value: 'REVIEW', label: '待巩固', path: '/sentences/review' }, { value: 'DUE', label: '到期复习', path: '/sentences/due' }];
</script>
<template>
  <nav class="sentence-nav" aria-label="句子练习导航"><RouterLink v-for="entry in entries" :key="entry.value" :to="entry.path" :class="{ active: active === entry.value }" :aria-current="active === entry.value ? 'page' : undefined">{{ entry.label }}</RouterLink><RouterLink v-if="access.canManage" to="/sentences/manage" :class="{ active: active === 'MANAGEMENT' }" :aria-current="active === 'MANAGEMENT' ? 'page' : undefined">题库维护</RouterLink><button v-else-if="access.error" type="button" class="muted-link" :disabled="access.loading" :title="access.error" @click="access.load(true)">重查维护权限</button></nav>
</template>
