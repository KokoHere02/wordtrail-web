<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Languages, PencilLine } from 'lucide-vue-next';

const props = defineProps<{ active: 'words' | 'sentences'; lane?: 'daily' | 'independent' | 'consolidation'; blocked?: boolean; controls?: boolean }>();
const emit = defineEmits<{ select: [section: 'words' | 'sentences']; collapse: [collapsed: boolean] }>();
const route = useRoute();
const collapsed = ref(sessionStorage.getItem('wordtrail.study.navigation.collapsed') === 'true');
const childrenExpanded = ref(sessionStorage.getItem('wordtrail.study.navigation.childrenCollapsed') !== 'true');
watch(collapsed, value => { sessionStorage.setItem('wordtrail.study.navigation.collapsed', String(value)); emit('collapse', value); }, { immediate: true });
watch(childrenExpanded, value => sessionStorage.setItem('wordtrail.study.navigation.childrenCollapsed', String(!value)));
const sections = [{ id: 'words', label: '单词练习', icon: BookOpen }, { id: 'sentences', label: '句子翻译', icon: Languages }] as const;
function select(section: 'words' | 'sentences') {
  if (section === 'sentences' && props.active === 'words') sessionStorage.setItem('wordtrail.study.navigation.lastWordRoute', route.fullPath);
  if (section === 'words' && props.active !== 'words') childrenExpanded.value = true;
  emit('select', section);
}
function selectPrimary(section: 'words' | 'sentences') {
  if (section === 'words' && props.active === 'words') childrenExpanded.value = !childrenExpanded.value;
  select(section);
}
function keyboard(event: KeyboardEvent, index: number) {
  const offset = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
  if (!offset && !['Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : (index + offset + sections.length) % sections.length;
  select(sections[next]!.id);
  document.getElementById(`mode-tab-${sections[next]!.id}`)?.focus();
}
</script>
<template>
  <nav class="study-directory" :class="{ 'is-collapsed': collapsed }" aria-label="学习导航">
    <div class="study-directory-heading"><button type="button" class="study-directory-toggle" :aria-label="collapsed ? '展开学习导航' : '收起学习导航'" :data-tooltip="collapsed ? '展开学习导航' : '收起学习导航'" :aria-expanded="!collapsed" @click="collapsed = !collapsed"><ChevronRight v-if="collapsed" :size="17" /><ChevronLeft v-else :size="17" /></button></div>
    <div class="study-directory-list" role="tablist" aria-label="学习内容" aria-orientation="vertical">
      <template v-for="(section, index) in sections" :key="section.id">
        <div class="study-directory-group">
          <button :id="`mode-tab-${section.id}`" class="study-directory-primary" type="button" role="tab" :aria-label="section.label" :data-tooltip="collapsed ? section.label : undefined" :aria-selected="props.active === section.id" :aria-expanded="section.id === 'words' ? active === 'words' && childrenExpanded : undefined" :aria-controls="section.id === 'words' ? `${controls ? (lane === 'independent' ? 'mode-panel-independent ' : 'mode-panel-words ') : ''}study-directory-words` : controls ? 'mode-panel-sentences' : undefined" :tabindex="props.active === section.id ? 0 : -1" :disabled="blocked" @click="selectPrimary(section.id)" @keydown="keyboard($event, index)"><component :is="section.icon" class="study-directory-icon" :size="17" aria-hidden="true" /><span class="study-directory-text">{{ section.id === 'words' ? '单词' : '句子' }}</span><ChevronDown v-if="section.id === 'words'" class="study-directory-chevron" :size="16" aria-hidden="true" /></button>
        </div>
        <div v-if="section.id === 'words'" id="study-directory-words" v-show="active === 'words'" class="study-directory-children" :class="{ 'is-open': childrenExpanded }" :aria-hidden="!childrenExpanded" :inert="!childrenExpanded">
          <div class="study-directory-children-inner">
          <RouterLink to="/learn" :aria-label="collapsed ? '每日单词' : undefined" :data-tooltip="collapsed ? '每日单词' : undefined" :aria-current="active === 'words' && lane === 'daily' ? 'page' : undefined" :class="{ 'is-active': active === 'words' && lane === 'daily' }"><BookOpen :size="15" aria-hidden="true" /><span class="study-directory-text">每日单词</span></RouterLink>
          <RouterLink to="/dictation" :aria-label="collapsed ? '独立默写专项' : undefined" :data-tooltip="collapsed ? '独立默写专项' : undefined" :aria-current="active === 'words' && lane === 'independent' ? 'page' : undefined" :class="{ 'is-active': active === 'words' && lane === 'independent' }"><PencilLine :size="15" aria-hidden="true" /><span class="study-directory-text">独立默写专项</span></RouterLink>
          <RouterLink to="/consolidation" :aria-label="collapsed ? '错因与巩固' : undefined" :data-tooltip="collapsed ? '错因与巩固' : undefined" :aria-current="active === 'words' && lane === 'consolidation' ? 'page' : undefined" :class="{ 'is-active': active === 'words' && lane === 'consolidation' }"><CircleAlert :size="15" aria-hidden="true" /><span class="study-directory-text">错因与巩固</span></RouterLink>
          </div>
        </div>
      </template>
    </div>
  </nav>
</template>
