<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useSentenceNote } from '../../composables/useSentenceNote';
import { sentenceErrorTags, type SentenceNote } from '../../types/sentenceLinks';
import AppSelect from '../ui/AppSelect.vue';
const props = defineProps<{ sentenceId: number; personalNote?: SentenceNote; attemptId?: number | null }>();
const emit = defineEmits<{ saved: [value: SentenceNote] }>();
const { note, form, editing, loading, loaded, needsReview, error, notice, draft, busy, locked, reload, edit, save } = useSentenceNote(props.sentenceId, props.personalNote, value => emit('saved', value));
onMounted(() => { if (!props.personalNote) void reload(); });
watch(() => props.personalNote, value => { if (!editing.value && !busy.value) note.value = value; });
const attempts = computed(() => [...new Set([note.value?.attemptId, props.attemptId].filter((value): value is number => typeof value === 'number'))]);
const attemptOptions = computed<{ value: number | null; label: string }[]>(() => [{ value: null, label: '不关联作答' }, ...attempts.value.map(id => ({ value: id, label: `${id === props.attemptId ? '当前作答' : '原关联作答'} #${id}` }))]);
const tagLabel = (tag: string) => sentenceErrorTags.find(value => value.value === tag)?.label || tag;
</script>
<template>
  <section class="sentence-note-panel" :data-sentence-note="sentenceId"><div class="sentence-linked-heading"><h2>个人笔记与错因</h2><button v-if="!editing" type="button" class="muted-link" :disabled="busy" @click="edit">编辑笔记</button></div>
    <template v-if="!editing"><p v-if="note?.content" class="sentence-note-content">{{ note.content }}</p><p v-else class="subtle-copy">{{ note ? '暂无笔记正文' : '笔记尚未返回，可打开编辑读取。' }}</p><div v-if="note?.errorTags.length" class="sentence-note-tags"><span v-for="tag in note.errorTags" :key="tag" class="learning-badge">{{ tagLabel(tag) }}</span></div></template>
    <template v-else><p v-if="loading" role="status">正在读取笔记…</p><div v-if="needsReview && draft" class="sentence-conflict"><p>待核对的原稿</p><p class="sentence-note-content">{{ draft.content || '空文本' }}</p><p>{{ draft.errorTags.map(tagLabel).join('、') || '无错因标签' }} · 原关联作答 {{ draft.attemptId ?? '无' }} · 原版本 {{ draft.version }}</p><button type="button" class="btn btn-secondary" :disabled="busy || !loaded" @click="needsReview = false; error = ''">已核对最新笔记，继续编辑</button></div>
      <form class="sentence-editor sentence-note-form" @submit.prevent="save()"><fieldset :disabled="locked"><label :for="`sentence-note-${sentenceId}`">笔记（最多 4000 字）</label><textarea :id="`sentence-note-${sentenceId}`" v-model="form.content" rows="4" maxlength="4000" /><div class="sentence-note-tag-options" role="group" aria-label="个人错因"><label v-for="tag in sentenceErrorTags" :key="tag.value"><input v-model="form.errorTags" type="checkbox" :value="tag.value" />{{ tag.label }}</label></div><AppSelect v-model="form.attemptId" :options="attemptOptions" label="关联作答" :disabled="locked" /><div class="live-actions"><button type="submit" class="btn btn-primary">保存笔记</button><button type="button" class="muted-link" @click="save(true)">清空笔记</button></div></fieldset><div class="live-actions"><button type="button" class="muted-link" :disabled="busy" @click="reload">重新读取笔记</button><button type="button" class="muted-link" :disabled="busy" @click="editing = false">收起编辑</button></div></form>
    </template><p v-if="error" class="inline-error" role="alert">{{ error }}</p><p v-if="notice" class="subtle-copy" role="status">{{ notice }}</p>
  </section>
</template>
