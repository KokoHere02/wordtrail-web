<script setup lang="ts">
import AppAlert from '../ui/AppAlert.vue';
defineProps<{ error: string; uncertain: boolean; batchId?: number }>();
defineEmits<{ refresh: [] }>();
</script>
<template>
  <AppAlert v-if="error" class="dictation-launch-error" :message="error"><p v-if="uncertain">创建结果尚未确认，请先查看默写记录，避免重复创建。</p><template #actions><RouterLink v-if="batchId" :to="`/dictation/${batchId}`" class="violet-link">进入已创建的默写</RouterLink><RouterLink to="/dictation#dictation-tasks" class="violet-link">查看默写记录</RouterLink><button v-if="uncertain" type="button" class="violet-link" @click="$emit('refresh')">刷新默写记录</button></template></AppAlert>
</template>
