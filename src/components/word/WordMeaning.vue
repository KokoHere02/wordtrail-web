<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import type { TranslationFields } from '../../types/translation';
import { displayPartOfSpeech, parseLegacyMeaning, professionalPrefix, splitMeaningItems } from '../../utils/studyMeaning';
const props = withDefaults(defineProps<TranslationFields & { layout?: 'compact' | 'study'; wordKey?: string | number; full?: boolean }>(), { layout: 'compact', full: false });
const expanded = ref(false);
const openProfessional = ref(new Set<number>());
const contentId = useId();
const source = computed(() => props.translationGroups !== undefined ? props.translationGroups : props.layout === 'study' && props.translation ? parseLegacyMeaning(props.translation) ?? undefined : undefined);
const groups = computed(() => source.value?.map(group => {
  const professional = props.layout === 'study' && group.partOfSpeech === null ? professionalPrefix(group.meaning) : null;
  const meaning = professional ? group.meaning.slice(professional.length) : group.meaning;
  return { ...group, meaning, label: displayPartOfSpeech(group.partOfSpeech), professional, items: props.layout === 'study' ? splitMeaningItems(meaning) : [meaning] };
}));
const collapsible = computed(() => props.layout === 'study' && groups.value?.some(group => group.items.length > 4 || group.professional));
function toggleProfessional(index: number) {
  const next = new Set(openProfessional.value);
  if (next.has(index)) next.delete(index); else next.add(index);
  openProfessional.value = next;
}
function toggleAll() {
  expanded.value = !expanded.value;
  openProfessional.value = new Set(expanded.value ? groups.value?.flatMap((group, index) => group.professional ? [index] : []) : []);
}
watch(() => [props.translationGroups, props.translation, props.wordKey], () => { expanded.value = false; openProfessional.value = new Set(); });
</script>
<template>
  <div :class="['word-meaning', `word-meaning--${layout}`]" aria-label="单词释义">
    <p v-if="layout === 'study'" class="translation-heading" aria-hidden="true">MEANINGS</p>
    <template v-if="source !== undefined">
      <div :id="contentId">
        <div v-for="(group, index) in groups" :key="index" :class="['translation-group', { 'has-part-of-speech': group.partOfSpeech !== null, 'translation-professional': group.professional }]">
          <button v-if="group.professional && !full" type="button" class="professional-toggle" :aria-expanded="openProfessional.has(index)" :aria-controls="`${contentId}-${index}`" @click="toggleProfessional(index)"><span>{{ group.professional.label }} 专业释义</span><ChevronDown :size="18" :class="{ expanded: openProfessional.has(index) }" /></button>
          <span v-else-if="group.professional" class="translation-part-of-speech">{{ group.professional.label }}</span>
          <span v-else-if="group.partOfSpeech !== null" class="translation-part-of-speech">{{ group.label }}</span>
          <div v-if="full || !group.professional || openProfessional.has(index)" :id="group.professional ? `${contentId}-${index}` : undefined" class="translation-body"><span class="translation-meaning">{{ full || expanded ? group.meaning : group.items.slice(0, 4).join('') }}</span><small v-if="!full && !expanded && group.items.length > 4" class="translation-more">另有 {{ group.items.length - 4 }} 项释义</small></div>
        </div>
      </div>
      <span v-if="!source?.length" class="translation-empty">暂无释义</span>
      <button v-if="collapsible && !full" type="button" class="translation-expand" :aria-controls="contentId" :aria-expanded="expanded" @click="toggleAll">{{ expanded ? '收起释义' : '展开完整释义' }}<ChevronDown :size="18" :class="{ expanded }" /></button>
    </template>
    <span v-else class="translation-legacy">{{ translation || '暂无释义' }}</span>
  </div>
</template>
