<script setup lang="ts">
import { ArrowLeft, ArrowRight } from 'lucide-vue-next';
defineProps<{ previousDisabled: boolean; nextDisabled: boolean; final?: boolean }>();
defineEmits<{ previous: []; next: [] }>();
</script>
<template>
  <footer class="learning-controls">
    <button type="button" class="learning-step previous-button" :disabled="previousDisabled" title="仅回看本次打开后已答单词，不回退学习进度" @click="$emit('previous')"><ArrowLeft :size="18" />上一词</button>
    <p class="learning-keys"><span><kbd>1</kbd> 不认识</span><span><kbd>2</kbd> 模糊</span><span><kbd>3</kbd> 认识</span><span><kbd>Space</kbd> 查看释义</span><span><kbd>P</kbd> 发音</span><span><kbd>→</kbd> 下一词</span></p>
    <button type="button" class="learning-step next-button" :disabled="nextDisabled" :title="nextDisabled ? '请先选择熟悉度，查看答案后再继续' : undefined" @click="$emit('next')">{{ final ? '完成本轮' : '下一词' }}<ArrowRight :size="18" /></button>
  </footer>
</template>
