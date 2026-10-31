<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '../../api';
import { errorMessage } from '../../api/http';
import type { BookWord } from '../../types/api';
import AppButton from '../ui/AppButton.vue';
import AppDialog from '../ui/AppDialog.vue';
import WordMeaning from './WordMeaning.vue';

const props = defineProps<{ modelValue: boolean; bookId: number; previousCount: number }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; selected: [number[]] }>();
const count = ref(100);
const words = ref<BookWord[]>([]);
const selected = ref(new Set<number>());
const loading = ref(false);
const error = ref('');
const loaded = ref(false);
const selectedCount = computed(() => selected.value.size);
let generation = 0;

async function choose() {
  if (loading.value) return;
  if (!Number.isInteger(count.value) || count.value < 1 || count.value > 100) {
    error.value = '请输入 1～100 的整数。'; return;
  }
  const request = ++generation;
  loading.value = true; error.value = ''; loaded.value = false;
  words.value = []; selected.value = new Set();
  try {
    const result = await api.randomBookWords(props.bookId, count.value);
    if (request !== generation || !props.modelValue) return;
    words.value = result; selected.value = new Set(result.map(word => word.id)); loaded.value = true;
  } catch (e) {
    if (request === generation && props.modelValue) error.value = errorMessage(e);
  } finally { if (request === generation) loading.value = false; }
}
function toggle(id: number, checked: boolean) {
  const next = new Set(selected.value);
  if (checked) next.add(id); else next.delete(id);
  selected.value = next;
}
function confirm() {
  if (!selectedCount.value || loading.value) return;
  emit('selected', words.value.filter(word => selected.value.has(word.id)).map(word => word.id));
  emit('update:modelValue', false);
}
watch(() => props.modelValue, open => {
  if (open) { count.value = 100; void choose(); }
  else { generation++; loading.value = false; words.value = []; selected.value = new Set(); error.value = ''; loaded.value = false; }
});
</script>

<template>
  <AppDialog :model-value="modelValue" title="随机挑选单词" description="从本词本中随机挑选从未加入过学习计划的单词。" panel-class="random-words-dialog" @update:model-value="emit('update:modelValue', $event)">
    <div class="random-words">
      <form class="random-words-controls" @submit.prevent="choose">
        <label for="random-word-count">挑选数量</label>
        <input id="random-word-count" v-model.number="count" type="number" min="1" max="100" :disabled="loading" />
        <AppButton type="submit" variant="secondary" :busy="loading">{{ loaded ? '重新挑选' : '挑选' }}</AppButton>
      </form>
      <p v-if="previousCount" class="subtle-copy">确认后将替换当前已选的 {{ previousCount }} 词。</p>
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <p v-if="loading" class="subtle-copy" role="status">正在挑选单词…</p>
      <template v-if="loaded">
        <p class="subtle-copy" role="status">{{ words.length ? `挑选到 ${words.length} 词，已选 ${selectedCount} 词。可取消不想要的词。` : '本词本中没有从未加入过计划的单词。' }}</p>
        <div v-if="words.length" class="random-words-list" aria-label="随机挑选结果">
          <label v-for="word in words" :key="word.id" class="random-word">
            <input type="checkbox" :checked="selected.has(word.id)" :aria-label="`选择 ${word.word}`" @change="toggle(word.id, !selected.has(word.id))" />
            <strong lang="en">{{ word.word }}</strong>
            <WordMeaning :translation="word.translation" :translation-groups="word.translationGroups" />
          </label>
        </div>
      </template>
      <div class="live-actions"><AppButton :disabled="!selectedCount || loading" @click="confirm">确认选择 {{ selectedCount }} 词</AppButton><AppButton variant="secondary" @click="emit('update:modelValue', false)">取消</AppButton></div>
    </div>
  </AppDialog>
</template>
