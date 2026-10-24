<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { Star } from 'lucide-vue-next';
import { useSentenceCatalog } from '../../composables/useSentenceCatalog';
import type { SentenceSource } from '../../types/sentences';
import { sentenceAssessmentLabel } from '../../types/sentences';
import SentenceNav from '../../components/learning/SentenceNav.vue';
import SentenceLaunchNotice from '../../components/learning/SentenceLaunchNotice.vue';
import SentenceHistoryDialog from '../../components/learning/SentenceHistoryDialog.vue';
import SentenceWordPicker from '../../components/learning/SentenceWordPicker.vue';
import SentenceScheduleDialog from '../../components/learning/SentenceScheduleDialog.vue';
import AppButton from '../../components/ui/AppButton.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
const route = useRoute();
const source: SentenceSource = route.path === '/sentences/favorites' ? 'FAVORITES' : route.path === '/sentences/review' ? 'REVIEW' : route.path === '/sentences/due' ? 'DUE' : 'BANK';
const requestedWordId = Number(route.query.wordId);
const initialWordId = Number.isSafeInteger(requestedWordId) && requestedWordId > 0 ? requestedWordId : undefined;
const catalog = useSentenceCatalog(source, source !== 'REVIEW' ? initialWordId : undefined);
const { rows, loading, error, total, selection, creation, difficulty, word, page, size, roundCount, validation, notice, favoriteError, favoriteBusy, pageIds, pageSelected, locked } = catalog;
const { selected, count } = selection;
const { busy: creating, error: createError, uncertain, created } = creation;
const historyOpen = ref(false);
const historyId = ref<number | null>(null);
const pickerOpen = ref(false);
const scheduleOpen = ref(false);
const scheduleId = ref<number | null>(null);
const emptyMessages = { BANK: '题库暂无符合条件的句子，可调整筛选或稍后再试。', FAVORITES: '暂无符合条件的收藏，先去题库收藏句子。', REVIEW: '暂无已自评的待巩固句子。', DUE: '当前没有可安排的到期句子。进行中练习里的未完成题目会暂时排除，请继续原轮次。' };
</script>
<template>
  <div class="wordlist-page sentence-catalog"><header class="library-heading"><div><h1>句子英译中</h1><p class="subtle-copy">对照参考解析，自评理解程度</p></div><RouterLink to="/sentences/records" class="muted-link">继续已有练习</RouterLink></header><SentenceNav :active="source" />
    <p v-if="source === 'DUE'" class="sentence-reference-note">到期复习按服务端日期安排，进行中轮次的未完成题目会暂时排除。<RouterLink to="/sentences/records" class="violet-link">继续原轮次</RouterLink></p><section class="wordlist-sheet" :aria-label="source === 'REVIEW' ? '待巩固句子' : source === 'FAVORITES' ? '收藏句子' : '句子题库'">
      <form v-if="source !== 'REVIEW'" class="sentence-filters" @submit.prevent="catalog.applyFilters"><label for="sentence-difficulty">难度<select id="sentence-difficulty" v-model.number="difficulty" :disabled="locked"><option value="">全部难度</option><option :value="1">难度 1</option><option :value="2">难度 2</option><option :value="3">难度 3</option></select></label><AppButton variant="secondary" :disabled="locked" @click="pickerOpen = true">{{ word ? word.word || '已指定关联单词' : '选择关联单词' }}</AppButton><button v-if="word" type="button" class="muted-link" :disabled="locked" @click="word = undefined">清除关联单词</button><AppButton type="submit" variant="secondary" :disabled="locked || loading || !!favoriteBusy.size">应用筛选</AppButton></form>
      <div class="wordlist-selection"><label><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pageIds.some(id => selected.has(id))" :disabled="locked || loading || !!error || !pageIds.length" @change="selection.togglePage(pageIds, !pageSelected)" />选择当前页</label><span>已选 {{ count }} 句</span><button class="muted-link" :disabled="locked || !count" @click="selection.clear">清空选择</button><button class="muted-link" :disabled="locked || loading" @click="catalog.refresh">刷新列表</button></div>
      <StatePanel :loading="loading" :error="error" :empty="total === 0" :message="emptyMessages[source]" @retry="catalog.refresh" />
      <div v-if="!loading && !error" class="sentence-question-list"><article v-for="row in rows" :key="row.sentenceId" class="sentence-question-row"><input type="checkbox" :checked="selected.has(row.sentenceId)" :disabled="locked || !row.available" :aria-label="`选择句子 ${row.sentenceId}`" @change="selection.toggle(row.sentenceId, !selected.has(row.sentenceId))" /><div class="sentence-question-copy"><p lang="en" class="sentence-english">{{ row.englishText }}</p><p class="subtle-copy">难度 {{ row.difficulty }}<span v-if="!row.available"> · 已停用，不能用于新练习</span></p><p v-if="row.question" class="sentence-source subtle-copy">{{ row.question.source }}<span v-if="row.question.sourceReference"> · {{ row.question.sourceReference }}</span></p><p v-if="row.due" class="subtle-copy sentence-due-date">下次复习 {{ row.due.nextReviewDate }} · 档位 {{ row.due.reviewLevel }} · {{ sentenceAssessmentLabel(row.due.lastAssessment) }}</p><p v-if="row.due" class="sentence-source subtle-copy">{{ row.due.source }}<span v-if="row.due.sourceReference"> · {{ row.due.sourceReference }}</span></p><p v-if="row.review" class="subtle-copy">自评：{{ sentenceAssessmentLabel(row.review.selfAssessment) }} · {{ row.review.reviewedAt.replace('T', ' ') }}</p></div><div class="sentence-row-actions"><button v-if="row.question" type="button" class="sentence-favorite" :aria-label="`${row.question.favorite ? '取消收藏' : '收藏'}句子 ${row.sentenceId}`" :aria-pressed="row.question.favorite" :disabled="locked || favoriteBusy.has(row.sentenceId)" @click="catalog.favorite(row.sentenceId, !row.question.favorite)"><Star :size="18" :fill="row.question.favorite ? 'currentColor' : 'none'" />{{ row.question.favorite ? '已收藏' : '收藏' }}</button><button v-else-if="!row.available" type="button" class="muted-link" :disabled="locked || favoriteBusy.has(row.sentenceId)" @click="catalog.favorite(row.sentenceId, false)">取消收藏</button><button type="button" class="muted-link" @click="historyId = row.sentenceId; historyOpen = true">作答历史</button><button type="button" class="muted-link" @click="scheduleId = row.sentenceId; scheduleOpen = true">复习安排</button></div></article></div>
      <AppPagination v-if="total !== undefined" :page="page" :size="size" :total="total" :disabled="loading || locked" noun="句" @change="page = $event" />
      <p v-if="notice" class="live-notice" role="status">{{ notice }}</p><p v-if="favoriteError" class="inline-error" role="alert">{{ favoriteError }}</p><p v-if="validation || count > 50" class="inline-error" role="alert">{{ validation || '每轮最多选择 50 个不同句子。' }}</p>
      <div class="sentence-launch-actions"><AppButton :busy="creating" :disabled="locked || loading || !!error || !!favoriteBusy.size || !count || count > 50" @click="catalog.start(true)">练习所选 {{ count }} 句</AppButton><label for="sentence-count">自动选题数量<input id="sentence-count" v-model.number="roundCount" type="number" min="1" max="50" step="1" :disabled="locked" /></label><AppButton variant="secondary" :disabled="locked || loading || !!error || !!favoriteBusy.size || total === 0" @click="catalog.start(false)">{{ source === 'BANK' ? '从题库开始' : source === 'FAVORITES' ? '从收藏开始' : source === 'DUE' ? '开始到期复习' : '开始巩固练习' }}</AppButton></div><SentenceLaunchNotice :error="createError" :uncertain="uncertain" :session-id="created?.sessionId" />
    </section><SentenceHistoryDialog v-model="historyOpen" :sentence-id="historyId" /><SentenceScheduleDialog v-model="scheduleOpen" :sentence-id="scheduleId" /><SentenceWordPicker v-if="pickerOpen" v-model="pickerOpen" @select="word = $event" />
  </div>
</template>
