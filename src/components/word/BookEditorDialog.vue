<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '../../api';
import { ApiError, errorMessage } from '../../api/http';
import { useBooksStore } from '../../stores/books';
import type { Book } from '../../types/api';
import AppDialog from '../ui/AppDialog.vue';
import AppButton from '../ui/AppButton.vue';
const props = defineProps<{ modelValue: boolean; book?: Book }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [book: Book]; unavailable: [] }>();
const name = ref('');
const description = ref('');
const busy = ref(false);
const error = ref('');
const blocked = ref(false);
watch(() => props.modelValue, open => {
  if (!open) return;
  name.value = props.book?.name || '';
  description.value = props.book?.description || '';
  error.value = ''; blocked.value = false;
});
function close(value: boolean) { if (!busy.value) emit('update:modelValue', value); }
async function save() {
  if (busy.value || blocked.value || props.book && !props.book.editable) return;
  const title = name.value.trim();
  const detail = description.value.trim();
  if (!title || Array.from(title).length > 128) { error.value = '名称须为 1～128 个字符。'; return; }
  if (Array.from(detail).length > 2000) { error.value = '描述最多 2000 个字符。'; return; }
  busy.value = true; error.value = '';
  try {
    const body = { name: title, description: detail || null };
    const book = props.book ? await api.updateBook(props.book.id, body) : await api.createBook(body);
    useBooksStore().remember([book]);
    emit('saved', book);
    emit('update:modelValue', false);
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError && e.code === 'BOOK_READ_ONLY') error.value += '；请创建个人词本。';
    if (e instanceof ApiError && ['BOOK_READ_ONLY', 'BOOK_NOT_FOUND'].includes(e.code)) {
      blocked.value = true; emit('unavailable');
    }
  } finally { busy.value = false; }
}
</script>
<template>
  <AppDialog :model-value="modelValue" :title="book ? '编辑词本' : '创建个人词本'" @update:model-value="close">
    <form class="book-editor" novalidate @submit.prevent="save">
      <label for="book-name">名称</label>
      <input id="book-name" v-model="name" required maxlength="128" autocomplete="off" :disabled="busy || blocked" :aria-invalid="!!error" :aria-describedby="error ? 'book-editor-error' : undefined" />
      <label for="book-description">描述<span class="subtle-copy">（选填）</span></label>
      <textarea id="book-description" v-model="description" maxlength="2000" rows="3" :disabled="busy || blocked" />
      <p v-if="error" id="book-editor-error" class="inline-error" role="alert">{{ error }}</p>
      <div class="live-actions"><AppButton type="submit" :busy="busy" :disabled="blocked">{{ book ? '保存修改' : '创建词本' }}</AppButton><AppButton variant="secondary" :disabled="busy" @click="close(false)">取消</AppButton></div>
    </form>
  </AppDialog>
</template>
