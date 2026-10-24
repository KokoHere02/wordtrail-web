<script setup lang="ts">
import { watch } from 'vue';
import { Search } from 'lucide-vue-next';
import { useDictionaryCollection } from '../../composables/useDictionaryCollection';
import type { BookWordsChange } from '../../types/api';
import AppDialog from '../ui/AppDialog.vue';
import AppButton from '../ui/AppButton.vue';
import AppPagination from '../ui/AppPagination.vue';
import StatePanel from '../ui/StatePanel.vue';
import WordMeaning from './WordMeaning.vue';
const props = defineProps<{ modelValue: boolean; bookId: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; changed: [result: BookWordsChange]; unavailable: [] }>();
const collection = useDictionaryCollection(props.bookId);
const { data, loading, error, keyword, matchType, applied, page, size, pageIds, pageSelected, busy, validation, saveError, blocked, selection } = collection;
watch(blocked, value => { if (value) emit('unavailable'); });
function close(value: boolean) { if (!busy.value) emit('update:modelValue', value); }
async function collect() {
  const result = await collection.collect();
  if (result) { emit('changed', result); emit('update:modelValue', false); }
}
</script>
<template>
  <AppDialog :model-value="modelValue" title="搜索收词" description="收词后，可再选词加入学习计划。" @update:model-value="close">
    <div class="dictionary-collector">
      <form class="dictionary-search" role="search" @submit.prevent="collection.search">
        <label class="library-search"><Search :size="18" /><input v-model="keyword" type="search" maxlength="255" aria-label="搜索全局词库" placeholder="输入英文单词" :disabled="busy || blocked" /></label>
        <label class="live-filter">匹配<select v-model="matchType" :disabled="busy || blocked"><option value="PREFIX">前缀</option><option value="EXACT">完整</option></select></label>
        <AppButton type="submit" variant="secondary" :disabled="busy || blocked">搜索词库</AppButton>
      </form>
      <p v-if="validation" class="inline-error" role="alert">{{ validation }}</p>
      <StatePanel :loading="loading" :error="error" :empty="!!data && !data.records.length" :message="data?.total === 0 ? '词库中未找到匹配单词，请检查拼写' : '本页暂无单词，请返回上一页。'" @retry="collection.refresh" />
      <p v-if="!applied" class="subtle-copy">搜索词库中的单词，按结果收录。</p>
      <template v-if="data && !loading && !error">
        <div class="wordlist-selection"><label><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pageIds.some(id => selection.selected.value.has(id))" :disabled="busy || blocked || !pageIds.length" @change="selection.togglePage(pageIds, !pageSelected)" />选择当前页</label><span>已选 {{ selection.count.value }} 词</span><button class="muted-link" :disabled="busy || !selection.count.value" @click="selection.clear">清空</button></div>
        <article v-for="word in data.records" :key="word.id" class="dictionary-word">
          <label><input type="checkbox" :checked="selection.selected.value.has(word.id)" :disabled="busy || blocked || word.inBook !== false" :aria-label="`收录 ${word.word} #${word.id}`" @change="selection.toggle(word.id, !selection.selected.value.has(word.id))" /><span><strong lang="en">{{ word.word }}</strong><small>{{ word.phonetic }}</small></span></label>
          <WordMeaning :translation="word.translation" :translation-groups="word.translationGroups" /><span class="subtle-copy">{{ word.inBook === true ? '已收录' : word.inBook === false ? '未收录' : '收录状态未知' }}</span>
        </article>
        <AppPagination :page="page" :size="size" :total="data.total" :disabled="busy || blocked || loading" @change="collection.changePage" />
      </template>
      <p v-if="selection.count.value > 100" class="inline-error" role="alert">每批最多收录 100 词。</p>
      <p v-if="saveError" class="inline-error" role="alert">{{ saveError }}</p>
      <div class="live-actions"><AppButton :busy="busy" :disabled="blocked || loading || !selection.count.value || selection.count.value > 100" @click="collect">收录所选 {{ selection.count.value }} 词</AppButton><AppButton variant="secondary" :disabled="busy" @click="close(false)">关闭</AppButton></div>
    </div>
  </AppDialog>
</template>
