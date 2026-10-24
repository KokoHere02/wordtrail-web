<script setup lang="ts">
defineProps<{ error: string; uncertain: boolean; sessionId?: number }>();
</script>
<template>
  <div v-if="error" class="live-error sentence-launch-error" role="alert"><p>{{ error }}</p><p v-if="uncertain">创建结果尚未确认，请先查询进行中的练习，避免重复创建。</p><div class="live-actions"><RouterLink v-if="sessionId" :to="`/sentences/sessions/${sessionId}`" class="violet-link">进入已创建的练习</RouterLink><RouterLink to="/sentences/records" class="violet-link">查询进行中练习</RouterLink></div></div>
</template>
