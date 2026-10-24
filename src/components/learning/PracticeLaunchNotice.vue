<script setup lang="ts">
defineProps<{ error: string; uncertain: boolean; batchId?: number }>();
</script>
<template>
  <div v-if="error" class="practice-launch-notice live-error" role="alert"><p>{{ error }}</p><p v-if="uncertain">创建结果尚未确认，请先检查专项记录，避免重复创建。</p><div class="live-actions"><RouterLink v-if="batchId" :to="`/study/${batchId}`" class="violet-link">进入已创建的专项</RouterLink><RouterLink to="/learning" class="violet-link">查看专项记录</RouterLink></div></div>
</template>
