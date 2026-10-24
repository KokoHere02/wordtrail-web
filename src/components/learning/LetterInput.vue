<script setup lang="ts">
import { computed, ref, watch } from 'vue';
const props = defineProps<{ modelValue: string; length?: number; disabled?: boolean; id: string; label?: string; invalid?: boolean; describedBy?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; submit: [] }>();
const field = ref<HTMLInputElement>();
const caret = ref(0), composing = ref(false);
const characters = computed(() => Array.from(props.modelValue));
const slots = computed(() => props.length ? Math.max(props.length, characters.value.length) : 0);
function selection() { caret.value = field.value?.selectionStart ?? props.modelValue.length; }
function input(event: Event) { const target = event.target as HTMLInputElement; emit('update:modelValue', target.value); selection(); }
function keydown(event: KeyboardEvent) { if (!props.disabled && event.key === 'Enter' && !event.isComposing && !composing.value) { event.preventDefault(); emit('submit'); } }
watch(() => props.modelValue, value => { if (!value) caret.value = 0; });
defineExpose({ focus: () => field.value?.focus() });
</script>
<template>
  <div :class="['letter-input', { 'has-slots': !!length, 'is-disabled': disabled }]"><label :for="id" class="letter-input-label">{{ label || '英文拼写' }}<span v-if="length">{{ length }} 个位置</span></label><div class="letter-input-control"><div v-if="length" class="letter-slots" aria-hidden="true"><span v-for="index in slots" :key="index" :class="['letter-slot', { 'is-caret': caret === index - 1 && !disabled, 'is-extra': index > length, 'is-empty': !characters[index - 1] }]">{{ characters[index - 1] || '' }}</span></div><input :id="id" ref="field" :value="modelValue" type="text" :disabled="disabled" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="255" enterkeyhint="done" :aria-label="label || '英文拼写'" :aria-invalid="invalid || undefined" :aria-describedby="describedBy" :class="{ 'letter-input-overlay': !!length }" @input="input" @click="selection" @keyup="selection" @select="selection" @compositionstart="composing = true" @compositionend="composing = false; input($event)" @keydown="keydown" /></div></div>
</template>
