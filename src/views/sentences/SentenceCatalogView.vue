<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { CalendarDays, History, RotateCcw, Star } from 'lucide-vue-next';
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
import AppSelect from '../../components/ui/AppSelect.vue';
import { sentenceDifficultyOptions, sentenceDifficultyLabel } from '../../utils/sentenceOptions';
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
  <div class="sentence-library-page sentence-catalog" aria-label="句子内容">
    <SentenceNav :active="source" />
    <section class="sentence-filter-sheet" aria-label="句子筛选与练习">
      <form v-if="source !== 'REVIEW'" class="sentence-filters" @submit.prevent="catalog.applyFilters">
        <AppSelect v-model="difficulty" :options="sentenceDifficultyOptions" label="难度" :disabled="locked" />
        <div class="sentence-filter-field"><span>关联单词</span><div class="sentence-word-filter"><AppButton variant="secondary" :disabled="locked" @click="pickerOpen = true">{{ word ? word.word || '已指定关联单词' : '选择关联单词' }}</AppButton><button v-if="word" type="button" class="muted-link" :disabled="locked" @click="word = undefined">清除关联单词</button></div></div>
        <AppButton type="submit" variant="secondary" :disabled="locked || loading || !!favoriteBusy.size">应用筛选</AppButton>
      </form>
      <div class="sentence-auto-start"><label for="sentence-count">句子数量<input id="sentence-count" v-model.number="roundCount" type="number" min="1" max="50" step="1" :disabled="locked" /></label><AppButton variant="secondary" :disabled="locked || loading || !!error || !!favoriteBusy.size || total === 0" @click="catalog.start(false)">{{ source === 'BANK' ? '从题库开始' : source === 'FAVORITES' ? '从收藏开始' : source === 'DUE' ? '开始到期复习' : '开始巩固练习' }}</AppButton></div>
    </section>
    <p v-if="source === 'DUE'" class="sentence-library-note">进行中的句子请从<RouterLink to="/sentences/records" class="violet-link">原练习</RouterLink>继续。</p>
    <p v-if="notice" class="sentence-library-note" role="status">{{ notice }}</p><p v-if="favoriteError" class="inline-error" role="alert">{{ favoriteError }}</p><p v-if="validation || count > 50" class="inline-error" role="alert">{{ validation || '每轮最多选择 50 个不同句子。' }}</p>
    <SentenceLaunchNotice :error="createError" :uncertain="uncertain" :session-id="created?.sessionId" />
    <section class="sentence-library-sheet" :aria-label="source === 'REVIEW' ? '待巩固句子' : source === 'FAVORITES' ? '收藏句子' : source === 'DUE' ? '到期复习句子' : '句子题库'">
      <div class="sentence-selection-toolbar">
        <div class="sentence-selection-info"><label><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected && pageIds.some(id => selected.has(id))" :disabled="locked || loading || !!error || !pageIds.length" @change="selection.togglePage(pageIds, !pageSelected)" />选择当前页</label><span aria-live="polite">已选 {{ count }} 句</span><button class="muted-link" :disabled="locked || !count" @click="selection.clear">清空选择</button></div>
        <div class="sentence-selection-actions"><button class="sentence-icon-action" :disabled="locked || loading" aria-label="刷新列表" @click="catalog.refresh"><RotateCcw :size="17" aria-hidden="true" /><span>刷新列表</span></button><AppButton :busy="creating" :disabled="locked || loading || !!error || !!favoriteBusy.size || !count || count > 50" @click="catalog.start(true)">练习所选 {{ count }} 句</AppButton></div>
      </div>
      <StatePanel :loading="loading" :error="error" :empty="total === 0" :message="emptyMessages[source]" @retry="catalog.refresh" />
      <div v-if="!loading && !error" class="sentence-question-list">
        <article v-for="row in rows" :key="row.sentenceId" :class="['sentence-question-row', { 'is-selected': selected.has(row.sentenceId) }]">
          <label class="sentence-row-check"><input type="checkbox" :checked="selected.has(row.sentenceId)" :disabled="locked || !row.available" :aria-label="`选择句子 ${row.sentenceId}`" @change="selection.toggle(row.sentenceId, !selected.has(row.sentenceId))" /></label>
          <div class="sentence-question-copy"><p lang="en" class="sentence-english">{{ row.englishText }}</p><div class="sentence-row-meta"><span class="sentence-level">{{ sentenceDifficultyLabel(row.difficulty) }}</span><span v-if="!row.available" class="sentence-status-muted">已停用</span><span v-if="row.question">{{ row.question.source }}<template v-if="row.question.sourceReference"> · {{ row.question.sourceReference }}</template></span><span v-if="row.due">{{ row.due.source }}<template v-if="row.due.sourceReference"> · {{ row.due.sourceReference }}</template></span></div><p v-if="row.due" class="subtle-copy sentence-due-date">下次复习 {{ row.due.nextReviewDate }} · {{ sentenceAssessmentLabel(row.due.lastAssessment) }}</p><p v-if="row.review" class="subtle-copy">{{ sentenceAssessmentLabel(row.review.selfAssessment) }} · {{ row.review.reviewedAt.replace('T', ' ') }}</p></div>
          <div class="sentence-row-actions"><button v-if="row.question" type="button" class="sentence-favorite" :aria-label="`${row.question.favorite ? '取消收藏' : '收藏'}句子 ${row.sentenceId}`" :aria-pressed="row.question.favorite" :disabled="locked || favoriteBusy.has(row.sentenceId)" @click="catalog.favorite(row.sentenceId, !row.question.favorite)"><Star :size="16" :fill="row.question.favorite ? 'currentColor' : 'none'" aria-hidden="true" />{{ row.question.favorite ? '已收藏' : '收藏' }}</button><button v-else-if="!row.available" type="button" class="muted-link" :disabled="locked || favoriteBusy.has(row.sentenceId)" @click="catalog.favorite(row.sentenceId, false)">取消收藏</button><button type="button" class="sentence-row-action" @click="historyId = row.sentenceId; historyOpen = true"><History :size="15" aria-hidden="true" />作答历史</button><button type="button" class="sentence-row-action" @click="scheduleId = row.sentenceId; scheduleOpen = true"><CalendarDays :size="15" aria-hidden="true" />复习安排</button></div>
        </article>
      </div>
      <AppPagination v-if="total !== undefined" :page="page" :size="size" :total="total" :disabled="loading || locked" noun="句" @change="page = $event" />
    </section>
    <RouterLink to="/sentences/records" class="sentence-record-link muted-link">继续已有练习</RouterLink>
    <SentenceHistoryDialog v-model="historyOpen" :sentence-id="historyId" /><SentenceScheduleDialog v-model="scheduleOpen" :sentence-id="scheduleId" /><SentenceWordPicker v-if="pickerOpen" v-model="pickerOpen" @select="word = $event" />
  </div>
</template>
