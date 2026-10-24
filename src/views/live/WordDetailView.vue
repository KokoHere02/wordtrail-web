<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, History } from 'lucide-vue-next';
import { wordsApi } from '../../api/words';
import { useResource } from '../../composables/useResource';
import type { WordDetail } from '../../types/words';
import StatePanel from '../../components/ui/StatePanel.vue';
import WordHistoryDialog from '../../components/learning/WordHistoryDialog.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
import WordSentences from '../../components/learning/WordSentences.vue';
const id = Number(useRoute().params.wordId);
const router = useRouter();
const { data, loading, error, load } = useResource<WordDetail>();
const historyOpen = ref(false);
const statuses = { ACTIVE: '学习中', PAUSED: '已暂停', REMOVED: '已移出' };
const labels = { 1: '认识', 2: '模糊', 3: '不认识' };
const refresh = () => load(() => wordsApi.detail(id));
const time = (value: string | null) => value ? value.replace('T', ' ') : '未记录';
function back() {
  const target: unknown = window.history.state?.back;
  if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')) router.back();
  else void router.push('/books');
}
onMounted(refresh);
</script>
<template>
  <div class="wordlist-page word-detail-page">
    <button class="muted-link detail-back" @click="back"><ArrowLeft :size="17" />返回</button>
    <StatePanel :loading="loading" :error="error" @retry="refresh" />
    <template v-if="data && !loading && !error">
      <header class="word-detail-heading"><div><span class="subtle-copy">单词详情</span><h1 lang="en">{{ data.word }}</h1><p v-if="data.phonetic" class="word-detail-phonetic">{{ data.phonetic }}</p><WordMeaning class="word-detail-translation" :translation="data.translation" :translation-groups="data.translationGroups" /></div><button class="btn btn-secondary" @click="historyOpen = true"><History :size="18" />学习历史</button><RouterLink :to="{ path: '/sentences', query: { wordId: data.id } }" class="btn btn-secondary">关联句子练习</RouterLink></header>
      <section class="word-detail-panel" aria-labelledby="personal-books-heading"><h2 id="personal-books-heading">我的个人词本</h2><div v-if="data.personalBooks.length" class="personal-book-links"><RouterLink v-for="book in data.personalBooks" :key="book.id" :to="`/books/${book.id}`">{{ book.name }}</RouterLink></div><p v-else class="subtle-copy">尚未收录到个人词本。</p></section>
      <section class="word-detail-panel word-plan-panel" aria-labelledby="word-plan-heading"><div class="word-panel-heading"><h2 id="word-plan-heading">长期学习计划</h2><span class="subtle-copy">北京时间</span></div><template v-if="data.plan"><div class="word-plan-badges"><span class="learning-badge">{{ statuses[data.plan.planStatus] }}</span><span class="subtle-copy">{{ data.plan.started ? '已开始' : '未学' }}</span><span v-if="data.plan.due" class="learning-badge">已到期待复习</span></div><dl class="word-plan-facts"><div><dt>下次复习</dt><dd>{{ data.plan.nextReviewAt ? time(data.plan.nextReviewAt) : '尚未安排' }}</dd></div><div><dt>上次学习</dt><dd>{{ time(data.plan.lastLearnedAt) }}</dd></div><div><dt>长期计划反馈</dt><dd>{{ data.plan.lastResult ? labels[data.plan.lastResult] : '暂无反馈记录' }}</dd></div><div><dt>复习等级</dt><dd>{{ data.plan.started ? data.plan.reviewLevel : '尚未开始' }}</dd></div><div><dt>加入计划</dt><dd>{{ time(data.plan.joinedAt) }}</dd></div><div><dt>首次学习</dt><dd>{{ time(data.plan.firstLearnedAt) }}</dd></div></dl><p v-if="data.plan.planStatus !== 'ACTIVE'" class="subtle-copy">计划已暂停或移出，以上复习时间保留，不计为到期。</p></template><p v-else class="subtle-copy">尚未加入长期学习计划。</p></section>
      <WordHistoryDialog v-model="historyOpen" :word-id="data.id" :word="data.word" />
      <WordSentences :word-id="data.id" />
    </template>
  </div>
</template>
