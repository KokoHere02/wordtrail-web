<script setup lang="ts">
import { ref, watch } from 'vue';
import { sentencesApi } from '../../api/sentences';
import { useResource } from '../../composables/useResource';
import type { Page } from '../../types/api';
import type { SentenceHistory } from '../../types/sentences';
import AppDialog from '../ui/AppDialog.vue';
import AppPagination from '../ui/AppPagination.vue';
import StatePanel from '../ui/StatePanel.vue';
import SentenceHistoryRows from './SentenceHistoryRows.vue';
const props = defineProps<{ modelValue: boolean; sentenceId: number | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const { data, loading, error, load } = useResource<Page<SentenceHistory>>();
const page = ref(1);
const size = 10;
function refresh() { if (props.modelValue && props.sentenceId !== null) void load(() => sentencesApi.history(props.sentenceId!, { page: page.value, size })); }
watch(() => [props.modelValue, props.sentenceId], () => { page.value = 1; refresh(); }, { immediate: true });
</script>
<template>
  <AppDialog :model-value="modelValue" title="单句作答历史" panel-class="sentence-dialog sentence-history-dialog" @update:model-value="emit('update:modelValue', $event)"><StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="暂无作答记录。" @retry="refresh" /><SentenceHistoryRows v-if="data && !loading && !error" :records="data.records" /><AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading" @change="page = $event; refresh()" /></AppDialog>
</template>
