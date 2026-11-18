<script setup lang="ts">
import { ref, watch } from 'vue';
import { ArrowUpRight } from 'lucide-vue-next';
import { request, errorMessage } from '../../api/http';
import { useResource } from '../../composables/useResource';
import { splitExample } from '../../utils/exampleText';
import StatePanel from '../ui/StatePanel.vue';

const props = defineProps<{ wordId: number; word: string }>();
type Sentence = { id: number; englishText: string; referenceTranslation: string; learning: boolean };
const { data, loading, error, load } = useResource<Sentence[]>();
const changes = ref(new Set<number>()), saveError = ref('');
function refresh() {
  return load(() => request<Sentence[]>('GET', '/sentence-practice/sentences', undefined, { wordId: props.wordId, limit: 5 }));
}
async function toggle(row: Sentence) {
  if (changes.value.has(row.id)) return;
  changes.value.add(row.id); saveError.value = '';
  try {
    await request(row.learning ? 'DELETE' : 'PUT', `/sentence-practice/learning/${row.id}`);
    data.value = data.value?.map(item => item.id === row.id ? { ...item, learning: !row.learning } : item);
  } catch (e) { saveError.value = errorMessage(e); }
  finally { changes.value.delete(row.id); }
}
watch(() => props.wordId, refresh, { immediate: true });
</script>
<template>
  <section class="detail-examples" aria-label="关联例句">
    <StatePanel :loading="loading" :error="error" @retry="refresh" />
    <template v-if="!loading && !error">
      <p v-if="!data?.length" class="subtle-copy">这个单词暂无关联句子。</p>
      <article v-for="row in data" :key="row.id" class="word-sentence-row">
        <p lang="en"><template v-for="(part, index) in splitExample(row.englishText, [word])" :key="index"><strong v-if="part.match">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></p>
        <p>{{ row.referenceTranslation }}</p>
        <button type="button" class="muted-link" :disabled="changes.has(row.id)" @click="toggle(row)">{{ row.learning ? '移出学习列表' : '加入学习列表' }}</button>
      </article>
    </template>
    <p v-if="saveError" role="alert" class="inline-error">{{ saveError }}</p>
    <RouterLink class="detail-practice" :to="{ path: '/sentences', query: { wordId } }">关联句子练习 <ArrowUpRight :size="16" /></RouterLink>
  </section>
</template>
