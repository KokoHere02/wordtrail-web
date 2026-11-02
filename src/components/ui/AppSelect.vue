<script setup lang="ts" generic="T extends string | number | null">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { Check, ChevronDown } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: T; options: { value: T; label: string; group?: string }[]; label: string;
  disabled?: boolean; hideLabel?: boolean; animated?: boolean; searchable?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: T] }>();
const id = useId(), root = ref<HTMLElement>(), trigger = ref<HTMLButtonElement>();
const open = ref(false), active = ref(0), query = ref(''), searchInput = ref<HTMLInputElement>();
const visibleOptions = computed(() => {
  const term = query.value.trim().toLocaleLowerCase();
  return term ? props.options.filter(option => option.label.toLocaleLowerCase().includes(term) || option.group?.toLocaleLowerCase().includes(term)) : props.options;
});
const selected = computed(() => props.options.findIndex(option => option.value === props.modelValue));
const current = computed(() => props.options[selected.value]?.label || '请选择');
let search = '', searchAt = 0;
function scroll() { void nextTick(() => root.value?.querySelector('[data-active=true]')?.scrollIntoView?.({ block: 'nearest' })); }
function show(last = false) {
  if (props.disabled) return;
  query.value = '';
  active.value = selected.value >= 0 ? selected.value : last ? props.options.length - 1 : 0;
  open.value = true; scroll();
  if (props.searchable) void nextTick(() => searchInput.value?.focus());
}
function choose(index: number) {
  const option = visibleOptions.value[index];
  if (props.disabled || !option) return;
  emit('update:modelValue', option.value); open.value = false; trigger.value?.focus();
}
function keyboard(event: KeyboardEvent) {
  if (props.disabled || event.isComposing) return;
  if (event.key === 'Tab') { open.value = false; return; }
  if (event.key === 'Escape') { if (open.value) { event.preventDefault(); event.stopPropagation(); open.value = false; } return; }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
    event.preventDefault();
    if (!open.value) { show(event.key === 'ArrowUp' || event.key === 'End'); return; }
    if (event.key === 'Enter' || event.key === ' ') { choose(active.value); return; }
    const length = visibleOptions.value.length;
    if (!length) return;
    active.value = event.key === 'Home' ? 0 : event.key === 'End' ? length - 1 : (active.value + (event.key === 'ArrowDown' ? 1 : -1) + length) % length;
    scroll();
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const now = Date.now(); search = (now - searchAt < 600 ? search : '') + event.key.toLowerCase(); searchAt = now;
    const index = props.options.findIndex(option => option.label.toLowerCase().startsWith(search));
    if (index >= 0) { if (!open.value) show(); active.value = index; scroll(); }
  }
}
function searchKeyboard(event: KeyboardEvent) {
  if (event.key === 'Escape') { keyboard(event); trigger.value?.focus(); }
  else if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) keyboard(event);
}
watch(query, () => { active.value = 0; });
function outside(event: PointerEvent) { if (event.target instanceof Node && !root.value?.contains(event.target)) open.value = false; }
function blur(event: FocusEvent) { if (!(event.relatedTarget instanceof Node) || !root.value?.contains(event.relatedTarget)) open.value = false; }
watch(() => props.disabled, disabled => { if (disabled) open.value = false; });
watch(() => props.options, () => { open.value = false; });
onMounted(() => document.addEventListener('pointerdown', outside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
</script>
<template>
  <div ref="root" :class="['app-select', { 'is-open': open, 'is-disabled': disabled }]" @focusout="blur">
    <label :id="`${id}-label`" :for="id" :class="{ 'sr-only': hideLabel }">{{ label }}</label>
    <button :id="id" ref="trigger" type="button" class="app-select-trigger" role="combobox" aria-haspopup="listbox" :aria-labelledby="`${id}-label ${id}-value`" :aria-expanded="open" :aria-controls="open ? `${id}-options` : undefined" :aria-activedescendant="open && visibleOptions.length ? `${id}-option-${active}` : undefined" :disabled="disabled" @click="open ? open = false : show()" @keydown="keyboard">
      <span :id="`${id}-value`">{{ current }}</span><ChevronDown :size="16" aria-hidden="true" />
    </button>
    <Transition name="app-select-pop" :css="animated">
      <ul v-if="open" :id="`${id}-options`" role="listbox" :aria-labelledby="`${id}-label`" class="app-select-options">
        <li v-if="searchable" class="app-select-search" role="presentation"><input ref="searchInput" v-model="query" type="search" aria-label="搜索标签" placeholder="搜索标签" @keydown="searchKeyboard" /></li>
        <template v-for="(option, index) in visibleOptions" :key="option.value ?? ''">
          <li v-if="option.group && option.group !== visibleOptions[index - 1]?.group" class="app-select-group" role="presentation">{{ option.group }}</li>
          <li :id="`${id}-option-${index}`" role="option" :aria-selected="modelValue === option.value" :data-active="index === active" @pointermove="active = index" @pointerdown.prevent @click="choose(index)"><span>{{ option.label }}</span><Check v-if="modelValue === option.value" :size="16" aria-hidden="true" /></li>
        </template>
        <li v-if="searchable && !visibleOptions.length" class="app-select-empty" role="presentation">没有找到匹配的标签</li>
      </ul>
    </Transition>
  </div>
</template>
