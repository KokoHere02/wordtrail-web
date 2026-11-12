<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { request, errorMessage } from '../../api/http';
import AppButton from '../ui/AppButton.vue';
import AppDialog from '../ui/AppDialog.vue';

type Sentence = { id: number; englishText: string; referenceTranslation: string };
const props = defineProps<{ modelValue: boolean; scope: string; tagId: string; wordId?: number; keyword: string; previousCount: number }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; selected: [number[]] }>();
const count = ref(100), rows = ref<Sentence[]>([]), selected = ref(new Set<number>());
const loading = ref(false), loaded = ref(false), error = ref('');
const selectedCount = computed(() => selected.value.size);
let generation = 0;
async function choose() {
  if (loading.value) return;
  if (!Number.isInteger(count.value) || count.value < 1 || count.value > 100) { error.value = '请输入 1～100 的整数。'; return; }
  const revision = ++generation;
  loading.value = true; loaded.value = false; error.value = ''; rows.value = []; selected.value = new Set();
  try {
    const result = await request<Sentence[]>('GET', '/sentence-practice/sentences/random', undefined, { count: count.value, scope: props.scope, tagId: props.tagId || undefined, wordId: props.wordId, keyword: props.keyword || undefined });
    if (revision !== generation || !props.modelValue) return;
    rows.value = result; selected.value = new Set(result.map(row => row.id)); loaded.value = true;
  } catch (e) { if (revision === generation && props.modelValue) error.value = errorMessage(e); }
  finally { if (revision === generation) loading.value = false; }
}
function toggle(id: number) {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  selected.value = next;
}
function confirm() {
  if (!selectedCount.value || loading.value) return;
  emit('selected', rows.value.filter(row => selected.value.has(row.id)).map(row => row.id));
  emit('update:modelValue', false);
}
watch(() => props.modelValue, open => {
  if (open) { count.value = 100; void choose(); }
  else { generation++; loading.value = false; loaded.value = false; error.value = ''; rows.value = []; selected.value = new Set(); }
});
</script>

<template>
  <AppDialog :model-value="modelValue" title="随机挑选句子" description="从当前范围和筛选条件中，随机挑选尚未加入学习列表的句子。" panel-class="random-words-dialog" @update:model-value="emit('update:modelValue', $event)">
    <div class="random-words">
      <form class="random-words-controls" @submit.prevent="choose"><label for="random-sentence-count">挑选数量</label><input id="random-sentence-count" v-model.number="count" type="number" min="1" max="100" :disabled="loading" /><AppButton type="submit" variant="secondary" :busy="loading">{{ loaded ? '重新挑选' : '挑选' }}</AppButton></form>
      <p v-if="previousCount" class="subtle-copy">确认后将替换当前已选的 {{ previousCount }} 句。</p>
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <p v-if="loading" class="subtle-copy" role="status">正在挑选句子…</p>
      <template v-if="loaded">
        <p class="subtle-copy" role="status">{{ rows.length ? `挑选到 ${rows.length} 句，已选 ${selectedCount} 句。可取消不想要的句子。` : '当前范围内没有可加入学习列表的句子。' }}</p>
        <div v-if="rows.length" class="random-words-list" aria-label="随机挑选结果">
          <label v-for="row in rows" :key="row.id" class="random-sentence"><input type="checkbox" :checked="selected.has(row.id)" :aria-label="`选择 ${row.englishText}`" @change="toggle(row.id)" /><span><strong lang="en">{{ row.englishText }}</strong><small>{{ row.referenceTranslation }}</small></span></label>
        </div>
      </template>
      <div class="live-actions"><AppButton :disabled="!selectedCount || loading" @click="confirm">确认选择 {{ selectedCount }} 句</AppButton><AppButton variant="secondary" @click="emit('update:modelValue', false)">取消</AppButton></div>
    </div>
  </AppDialog>
</template>

<style scoped>
.random-sentence { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
.random-sentence input { flex: none; margin-top: 4px; }
.random-sentence small { display: block; margin-top: 4px; color: var(--muted); }
</style>
