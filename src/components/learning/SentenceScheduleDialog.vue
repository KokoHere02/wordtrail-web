<script setup lang="ts">
import { watch } from 'vue';
import { sentencesApi } from '../../api/sentences';
import { useResource } from '../../composables/useResource';
import type { SentenceSchedule } from '../../types/sentences';
import { sentenceAssessmentLabel } from '../../types/sentences';
import { sentenceServiceError } from '../../api/sentenceManagement';
import AppDialog from '../ui/AppDialog.vue';
import StatePanel from '../ui/StatePanel.vue';
const props = defineProps<{ modelValue: boolean; sentenceId: number | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const { data, loading, error, load } = useResource<SentenceSchedule | null>();
function refresh() {
  const id = props.sentenceId;
  if (!props.modelValue || id === null) return;
  void load(async () => { try { return await sentencesApi.schedule(id); } catch (value) { throw new Error(sentenceServiceError(value)); } });
}
watch(() => [props.modelValue, props.sentenceId], refresh, { immediate: true });
</script>
<template>
  <AppDialog :model-value="modelValue" title="个人复习安排" panel-class="sentence-dialog sentence-schedule-dialog" @update:model-value="emit('update:modelValue', $event)"><StatePanel :loading="loading" :error="error" :empty="data === null" message="当前没有复习安排，保存自评后由服务端安排。" @retry="refresh" /><dl v-if="data && !loading && !error" class="sentence-schedule-facts"><div><dt>下次复习日期</dt><dd>{{ data.nextReviewDate }}</dd></div><div><dt>复习档位</dt><dd>{{ data.reviewLevel }}</dd></div><div><dt>当前有效自评</dt><dd>{{ sentenceAssessmentLabel(data.lastAssessment) }}</dd></div><div><dt>自评时间</dt><dd>{{ data.reviewedAt.replace('T', ' ') }}</dd></div><div><dt>对应作答</dt><dd>#{{ data.lastAttemptId }}</dd></div></dl></AppDialog>
</template>
