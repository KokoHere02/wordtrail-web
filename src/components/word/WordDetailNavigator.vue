<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ChevronLeft, ChevronRight, List, X } from 'lucide-vue-next';
import { api } from '../../api';
import { errorMessage } from '../../api/http';
import { useResource } from '../../composables/useResource';
import type { BookWord, LearningStatus, Page } from '../../types/api';
import type { BookLocation } from '../../types/words';
import AppDialog from '../ui/AppDialog.vue';
import AppPagination from '../ui/AppPagination.vue';
import SearchField from '../ui/SearchField.vue';
import StatePanel from '../ui/StatePanel.vue';

type Entry = Pick<BookWord, 'id' | 'word' | 'translation'>;
const props = defineProps<{ wordId: number; books?: BookLocation[] }>();
const route = useRoute(), router = useRouter();
const positive = (value: unknown) => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
const requestedBook = positive(route.query.book);
const sourceTerm = typeof route.query.keyword === 'string' ? route.query.keyword.slice(0, 255) : '';
const status: LearningStatus = route.query.status === 'LEARNED' || route.query.status === 'UNLEARNED' ? route.query.status : 'ALL';
const size = 10;
const dictionary = !requestedBook && (route.query.scope === 'dictionary' || !!sourceTerm);
const location = computed(() => props.books?.find(item => item.id === requestedBook) ?? (!dictionary ? props.books?.[0] : undefined));
const book = computed(() => location.value?.id ?? requestedBook);
const sourcePage = computed(() => requestedBook || dictionary ? positive(route.query.page) ?? 1 : Math.floor((location.value?.wordIndex ?? 0) / size) + 1);
const source = useResource<Page<Entry>>();
const results = useResource<Page<Entry>>();
const page = ref(sourcePage.value), input = ref(sourceTerm), term = ref(sourceTerm);
const trigger = ref<HTMLButtonElement>(), searchArea = ref<HTMLElement>();
const stepping = ref(false), stepError = ref('');
const media = window.matchMedia('(max-width: 760px)');
const mobile = ref(media.matches);
const opened = ref(!mobile.value || window.history.state?.wordPickerOpen === true);
function resize() { mobile.value = media.matches; opened.value = !mobile.value; }
let active = true;
onMounted(() => { media.addEventListener('change', resize); });
onBeforeUnmount(() => { active = false; media.removeEventListener('change', resize); });
function fetchPage(number: number, keyword: string): Promise<Page<Entry>> {
  return book.value ? api.words(book.value, { page: number, size, learningStatus: status, keyword: keyword || undefined })
    : api.dictionary({ page: number, size, keyword, matchType: 'PREFIX' });
}
function loadSource() { return source.load(() => fetchPage(sourcePage.value, sourceTerm)); }
watch([book, sourcePage], () => {
  page.value = sourcePage.value;
  if (book.value || sourceTerm) void loadSource();
}, { immediate: true });
const onSourcePage = computed(() => page.value === sourcePage.value && term.value === sourceTerm);
const list = computed(() => onSourcePage.value ? source : results);
const index = computed(() => source.data.value?.records.findIndex(row => row.id === props.wordId) ?? -1);
function canStep(delta: number) {
  const data = source.data.value;
  if (!data || index.value < 0 || stepping.value) return false;
  const adjacent = (sourcePage.value - 1) * size + index.value + delta;
  return adjacent >= 0 && adjacent < data.total;
}
async function select(entry: Entry, number: number, keyword: string) {
  if (mobile.value) closeList();
  if (entry.id === props.wordId && number === sourcePage.value && keyword === sourceTerm) return;
  await router.replace({ path: `/words/${entry.id}`, query: { book: book.value ? String(book.value) : undefined, page: String(number), keyword: keyword || undefined, status: status === 'ALL' ? undefined : status }, state: { wordPickerOpen: false } });
}
function changeBook(event: Event) {
  const id = Number((event.target as HTMLSelectElement).value);
  const selected = props.books?.find(item => item.id === id);
  void router.replace({ path: route.path, state: { wordPickerOpen: mobile.value }, query: selected
    ? { book: String(id), page: String(Math.floor(selected.wordIndex / size) + 1) }
    : { scope: 'dictionary' } });
}
async function step(delta: number) {
  if (!canStep(delta)) return;
  stepping.value = true; stepError.value = '';
  try {
    const rows = source.data.value!.records;
    const next = index.value + delta;
    const local = rows[next];
    if (local) await select(local, sourcePage.value, sourceTerm);
    else {
      const number = sourcePage.value + delta;
      const other = await fetchPage(number, sourceTerm);
      const entry = delta > 0 ? other.records[0] : other.records.at(-1);
      if (!active) return;
      if (entry) await select(entry, number, sourceTerm);
      else await loadSource();
    }
  } catch (e) { stepError.value = errorMessage(e); }
  finally { stepping.value = false; }
}
function browse(number: number) {
  page.value = number;
  if (!onSourcePage.value && (book.value || term.value)) void results.load(() => fetchPage(number, term.value));
  else if (onSourcePage.value && source.error.value) void loadSource();
}
function search() { term.value = input.value.trim(); browse(1); }
function closeList() {
  opened.value = false;
  if (window.history.state?.wordPickerOpen) window.history.replaceState({ ...window.history.state, wordPickerOpen: false }, '');
  void nextTick(() => trigger.value?.focus());
}
function openList() {
  if (opened.value) { closeList(); return; }
  opened.value = true;
  input.value = term.value = sourceTerm;
  browse(sourcePage.value);
  if (!mobile.value) void nextTick(() => searchArea.value?.querySelector('input')?.focus());
}
function back() {
  const target: unknown = window.history.state?.back;
  if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')) router.back();
  else void router.push(book.value ? `/books/${book.value}` : '/books');
}
watch([opened, () => list.value.data.value, () => list.value.loading.value], () => {
  const rows = searchArea.value?.querySelector('ul');
  const selected = rows?.querySelector('[aria-current="page"]');
  if (mobile.value || !rows || !selected) return;
  rows.scrollTop += selected.getBoundingClientRect().top - rows.getBoundingClientRect().top - (rows.clientHeight - selected.clientHeight) / 2;
}, { flush: 'post' });
</script>

<template>
  <div class="detail-tools">
    <button type="button" class="muted-link" @click="back"><ArrowLeft :size="16" />返回</button>
    <div class="detail-controls">
      <button ref="trigger" type="button" class="detail-tool" :aria-expanded="opened" @click="openList"><List :size="17" />词表</button>
      <template v-if="book || sourceTerm">
        <button type="button" class="detail-step" aria-label="上一个单词" title="上一个单词" :disabled="!canStep(-1)" @click="step(-1)"><ChevronLeft :size="18" /></button>
        <button type="button" class="detail-step" aria-label="下一个单词" title="下一个单词" :disabled="!canStep(1)" @click="step(1)"><ChevronRight :size="18" /></button>
      </template>
    </div>
  </div>
  <p v-if="stepError || source.error.value" role="status" class="inline-error">{{ stepError || source.error.value }} <button v-if="source.error.value" class="muted-link" @click="loadSource">重试词表</button></p>
  <div class="detail-layout" :class="{ 'with-list': opened && !mobile }">
    <component :is="mobile ? AppDialog : 'aside'" v-if="opened"
      v-bind="mobile ? { modelValue: true, title: book ? '词本词表' : '词库检索', panelClass: 'word-picker-sheet' } : { class: 'detail-index', 'aria-label': '词表' }"
      @update:model-value="closeList">
      <div ref="searchArea" class="word-picker" @keydown.esc="closeList">
        <header v-if="!mobile"><h2>{{ book ? '所在词书' : '词库检索' }}</h2><button class="detail-step" aria-label="收起词表" @click="closeList"><X :size="16" /></button></header>
        <select v-if="books?.length" class="detail-book-select" aria-label="选择词书" :value="book ?? ''" @change="changeBook">
          <option v-for="item in books" :key="item.id" :value="item.id">{{ item.name }}</option>
          <option value="">全部词库</option>
        </select>
        <form role="search" @submit.prevent="search"><SearchField v-model="input" label="搜索单词" :maxlength="255" /><button class="muted-link" type="submit">搜索</button></form>
        <template v-if="book || term">
          <StatePanel :loading="list.loading.value" :error="list.error.value" :empty="list.data.value?.total === 0" message="没有找到匹配的单词" @retry="browse(page)" />
          <template v-if="list.data.value && !list.loading.value && !list.error.value">
            <p v-if="book && list.data.value.records.length" class="detail-index-page">第 {{ page }} 页 · 本页单词</p>
            <ul><li v-for="row in list.data.value.records" :key="row.id"><button type="button" :aria-current="row.id === wordId ? 'page' : undefined" @click="select(row, page, term)"><strong lang="en">{{ row.word }}</strong><small>{{ row.translation }}</small></button></li></ul>
            <AppPagination v-if="list.data.value.total > size" :page="page" :size="size" :total="list.data.value.total" noun="词" @change="browse" />
          </template>
        </template>
        <p v-else class="subtle-copy">输入英文前缀查找单词。</p>
      </div>
    </component>
    <div class="detail-reading"><slot /></div>
  </div>
</template>
