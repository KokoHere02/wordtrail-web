<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useSentenceManagementAccess } from '../../stores/sentenceManagementAccess';
import StatePanel from '../ui/StatePanel.vue';
const access = useSentenceManagementAccess();
const emit = defineEmits<{ authorized: [] }>();
watch(() => access.canManage, value => { if (value) emit('authorized'); }, { immediate: true });
onMounted(() => access.load());
</script>
<template>
  <div class="sentence-management-gate"><StatePanel :loading="access.loading" :error="access.error" @retry="access.load(true)" /><div v-if="!access.loading && !access.canManage && !access.error" class="library-empty sentence-permission-empty"><h2>没有题库维护权限</h2><p>维护权限由服务端配置，普通句子练习不受影响。</p><button type="button" class="btn btn-secondary" @click="access.load(true)">重新检查权限</button></div><slot v-if="access.canManage" /></div>
</template>
