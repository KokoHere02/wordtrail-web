<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { dictationApi } from '../../api/dictation';
import { useResource } from '../../composables/useResource';
import { useSelection } from '../../composables/useSelection';
import { useDictationLaunch } from '../../composables/useDictationLaunch';
import type { Page } from '../../types/api';
import type { DictationWord } from '../../types/dictation';
import AppButton from '../../components/ui/AppButton.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import DictationWordRows from '../../components/learning/DictationWordRows.vue';
import DictationLaunchNotice from '../../components/learning/DictationLaunchNotice.vue';
const { data, loading, error, load } = useResource<Page<DictationWord>>();
const { selected, count, toggle, clear, togglePage } = useSelection();
const creation = useDictationLaunch();
const { busy, error: createError, uncertain, created } = creation;
const locked = computed(() => busy.value || uncertain.value || !!created.value);
const page = ref(1);
const size = 10;
const roundCount = ref(20);
const validation = ref('');
const pageIds = computed(() => data.value?.records.map(word => word.wordId) || []);
const pageSelected = computed(() => !!pageIds.value.length && pageIds.value.every(id => selected.value.has(id)));
const refresh = () => load(() => dictationApi.mistakes({ page: page.value, size }));
watch(page, refresh);
onMounted(refresh);
async function start(manual: boolean) {
  if (locked.value || loading.value || error.value) return;
  validation.value = '';
  if (manual && (count.value < 1 || count.value > 100)) { validation.value = '请选择 1～100 个不同单词。'; return; }
  if (!manual && (!Number.isInteger(roundCount.value) || roundCount.value < 1 || roundCount.value > 100)) { validation.value = '本轮数量须为 1～100 的整数。'; return; }
  await creation.launch(manual ? { source: 'MISTAKES', wordIds: [...selected.value] } : { source: 'MISTAKES', count: roundCount.value });
}
</script>
<template>
  <div class="wordlist-page dictation-mistakes"><header class="library-heading"><div><h1>默写待巩固词</h1><p class="subtle-copy">最近默写仍需验证的词 · 重练创建新批次，不覆盖旧结果</p></div><RouterLink to="/dictation" class="muted-link">返回单词默写</RouterLink></header>
    <section class="wordlist-sheet"><div class="wordlist-selection"><label><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pageIds.some(id => selected.has(id))" :disabled="locked || loading || !!error || !pageIds.length" @change="togglePage(pageIds, !pageSelected)" />选择当前页</label><span>已选 {{ count }} 词</span><button class="muted-link" :disabled="locked || !count" @click="clear">清空选择</button><button class="muted-link" :disabled="locked || loading" @click="refresh">刷新错词</button></div><StatePanel :loading="loading" :error="error" :empty="data?.total === 0" message="暂无已记录的默写待巩固词。认识记录中的不认识不会计入此处。" @retry="refresh" /><DictationWordRows v-if="data && !loading && !error" :records="data.records" selectable :selected="selected" :disabled="locked" @toggle="toggle" /><AppPagination v-if="data" :page="page" :size="size" :total="data.total" :disabled="loading || locked" @change="page = $event" />
      <div class="dictation-launch-actions"><AppButton :busy="busy" :disabled="locked || loading || !!error || !count || count > 100" @click="start(true)">重练所选 {{ count }} 词</AppButton><label for="dictation-mistakes-count">本轮数量<input id="dictation-mistakes-count" v-model.number="roundCount" type="number" min="1" max="100" step="1" :disabled="locked" /></label><AppButton variant="secondary" :disabled="locked || loading || !!error || !data?.total" @click="start(false)">重练待巩固词</AppButton></div><p v-if="validation || count > 100" class="inline-error" role="alert">{{ validation || '每轮最多 100 个不同单词。' }}</p><DictationLaunchNotice :error="createError" :uncertain="uncertain" :batch-id="created?.batchId" @refresh="$router.push('/dictation#dictation-tasks')" />
    </section>
  </div>
</template>
