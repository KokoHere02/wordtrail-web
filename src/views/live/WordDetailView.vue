<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { BookOpen, CalendarDays } from 'lucide-vue-next';
import { wordsApi } from '../../api/words';
import { useResource } from '../../composables/useResource';
import { useLearningKeys } from '../../composables/useLearningKeys';
import type { WordDetail } from '../../types/words';
import StatePanel from '../../components/ui/StatePanel.vue';
import WordHistoryDialog from '../../components/learning/WordHistoryDialog.vue';
import WordMeaning from '../../components/word/WordMeaning.vue';
import WordPronunciation from '../../components/word/WordPronunciation.vue';
import WordDetailNavigator from '../../components/word/WordDetailNavigator.vue';
import WordSentences from '../../components/learning/WordSentences.vue';

const id = Number(useRoute().params.wordId);
const { data, loading, error, load } = useResource<WordDetail>();
const tabs = ['关联例句', '学习计划', '学习历史'] as const;
const section = ref<typeof tabs[number]>('关联例句');
const pronunciation = ref<InstanceType<typeof WordPronunciation>>();
useLearningKeys({ pronounce: () => pronunciation.value?.pronounce() });
const statuses = { ACTIVE: '学习中', PAUSED: '已暂停', REMOVED: '已移出' };
const refresh = () => load(() => wordsApi.detail(id));
const time = (value: string | null) => value ? value.replace('T', ' ') : '未记录';
const facts = computed(() => {
  const plan = data.value?.plan;
  return plan ? [
    ['下次复习', plan.nextReviewAt ? time(plan.nextReviewAt) : '尚未安排'],
    ['上次学习', time(plan.lastLearnedAt)],
    ['复习等级', plan.started ? plan.reviewLevel : '尚未开始'],
    ['加入计划', time(plan.joinedAt)],
    ['首次学习', time(plan.firstLearnedAt)],
  ] : [];
});
onMounted(refresh);
</script>
<template>
  <div class="wordlist-page word-detail-page">
    <WordDetailNavigator :key="$route.fullPath" :word-id="id" :books="data?.bookLocations">
      <StatePanel :loading="loading" :error="error" @retry="refresh" />
      <template v-if="data && !loading && !error">
        <header class="word-detail-heading">
          <h1 lang="en">{{ data.word }}</h1>
          <WordPronunciation ref="pronunciation" :word-id="id" :word="data.word" :phonetic="data.phonetic" />
          <WordMeaning class="word-detail-translation" :translation="data.translation" :translation-groups="data.translationGroups" />
          <div class="detail-metadata">
            <div class="detail-books"><BookOpen :size="16" aria-hidden="true" />
              <span v-if="!data.personalBooks.length">尚未收录到个人词本</span>
              <template v-else><span>我的词本</span><RouterLink v-for="book in data.personalBooks" :key="book.id" :to="`/books/${book.id}`">{{ book.name }}</RouterLink></template>
            </div>
            <div v-if="data.plan?.planStatus === 'ACTIVE' && data.plan.nextReviewAt"><CalendarDays :size="16" aria-hidden="true" />下次复习 <time :datetime="data.plan.nextReviewAt">{{ time(data.plan.nextReviewAt) }}</time></div>
          </div>
        </header>
        <div class="detail-sections" role="group" aria-label="单词详情内容">
          <button v-for="tab in tabs" :key="tab" type="button" :aria-pressed="section === tab" @click="section = tab">{{ tab }}</button>
        </div>
        <WordSentences v-if="section === '关联例句'" :word-id="id" :word="data.word" />
        <section v-else-if="section === '学习计划'" class="word-plan-panel detail-section" aria-label="长期学习计划">
          <template v-if="data.plan">
            <div class="word-panel-heading"><strong>{{ statuses[data.plan.planStatus] }} · {{ data.plan.started ? '已开始' : '未学' }}</strong><span class="subtle-copy">北京时间</span></div>
            <p v-if="data.plan.due" class="learning-badge">已到期待复习</p>
            <dl class="word-plan-facts"><div v-for="[label, value] in facts" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></div></dl>
            <p v-if="data.plan.planStatus !== 'ACTIVE'" class="subtle-copy">计划已暂停或移出，以上复习时间保留，不计为到期。</p>
          </template>
          <p v-else class="subtle-copy">尚未加入长期学习计划。</p>
        </section>
        <WordHistoryDialog v-else class="detail-section" embedded :model-value="true" :word-id="id" :word="data.word" />
      </template>
    </WordDetailNavigator>
  </div>
</template>
