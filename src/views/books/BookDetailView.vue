<script setup lang="ts">
import { computed, onMounted, ref, watch, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Layers,
} from "lucide-vue-next";
import { api } from "../../api";
import { errorMessage } from "../../api/http";
import { useBooksStore } from "../../stores/books";
import { useResource } from "../../composables/useResource";
import { useSelection } from "../../composables/useSelection";
import type { Book, BookWord, LearningStatus, Page } from "../../types/api";
import AppButton from "../../components/ui/AppButton.vue";
import AppPagination from "../../components/ui/AppPagination.vue";
import SearchField from "../../components/ui/SearchField.vue";
import StatePanel from "../../components/ui/StatePanel.vue";
import WordMeaning from '../../components/word/WordMeaning.vue';
const route = useRoute();
const router = useRouter();
const bookId = Number(route.params.bookId);
const catalog = useBooksStore();
const meta = useResource<Book>();
const words = useResource<Page<BookWord>>();
const { selected, count, toggle, clear, togglePage } = useSelection();
const keyword = ref("");
const appliedKeyword = ref("");
const status = ref<LearningStatus>("ALL");
const page = ref(1);
const size = 10;
const roundCount = ref(20);
const creating = ref(false);
const createError = ref("");
const filters: { value: LearningStatus; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "UNLEARNED", label: "未学" },
  { value: "LEARNED", label: "已学" },
];
const pageIds = computed(
  () => words.data.value?.records.map((w) => w.id) || [],
);
const allChecked = computed(
  () =>
    pageIds.value.length > 0 &&
    pageIds.value.every((id) => selected.value.has(id)),
);
const someChecked = computed(
  () => !allChecked.value && pageIds.value.some((id) => selected.value.has(id)),
);
function reload() {
  void words.load(() =>
    api.words(bookId, {
      page: page.value,
      size,
      learningStatus: status.value,
      ...(appliedKeyword.value ? { keyword: appliedKeyword.value } : {}),
    }),
  );
}
let timer: ReturnType<typeof setTimeout>;
watch(keyword, () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    appliedKeyword.value = keyword.value.trim();
    page.value = 1;
    reload();
  }, 250);
});
watch(status, () => {
  page.value = 1;
  reload();
});
onBeforeUnmount(() => clearTimeout(timer));
function changePage(value: number) {
  page.value = value;
  reload();
}
async function start(manual: boolean) {
  if (creating.value) return;
  createError.value = "";
  if (manual && (count.value < 1 || count.value > 100)) {
    createError.value = "手动选词请保持在 1～100 个以内。";
    return;
  }
  if (
    !manual &&
    (!Number.isInteger(roundCount.value) ||
      roundCount.value < 1 ||
      roundCount.value > 100)
  ) {
    createError.value = "本轮数量请输入 1～100 的整数。";
    return;
  }
  creating.value = true;
  try {
    const batch = await api.create(
      manual
        ? { bookId, selectionType: "MANUAL", wordIds: [...selected.value] }
        : { bookId, selectionType: "BOOK", count: roundCount.value },
    );
    await router.push(`/study/${batch.batchId}`);
  } catch (e) {
    createError.value = errorMessage(e);
  } finally {
    creating.value = false;
  }
}
onMounted(() => {
  void meta.load(() => catalog.find(bookId));
  reload();
});
</script>
<template>
  <RouterLink to="/books" class="back-link"
    ><ArrowLeft :size="15" />全部词书</RouterLink
  >
  <StatePanel
    :loading="meta.loading.value"
    :error="meta.error.value"
    @retry="meta.load(() => catalog.find(bookId))"
  />
  <template v-if="meta.data.value">
    <section class="book-heading">
      <div>
        <div class="eyebrow"><BookOpen :size="14" /> WORD COLLECTION</div>
        <h1>{{ meta.data.value.name }}</h1>
        <p class="book-description">
          {{ meta.data.value.description || "从一个单词开始，慢慢积累。" }}
        </p>
        <div class="book-meta">
          <span>{{ meta.data.value.wordCount.toLocaleString() }} 个单词</span
          ><span class="tiny-dot" /><span>按词书顺序学习</span>
        </div>
      </div>
      <span class="book-number" aria-hidden="true"
        >{{ String(bookId).padStart(2, "0") }}<span>词 / 书</span></span
      >
    </section>
    <section class="word-section" aria-label="词书单词">
      <div class="list-toolbar">
        <div class="section-title">
          <h2>词汇一览</h2>
          <span class="muted">选一些词，开始今天的积累</span>
        </div>
        <div class="list-controls">
          <SearchField
            v-model="keyword"
            label="搜索英文前缀"
            placeholder="搜索单词"
          />
          <div class="segmented" role="group" aria-label="学习状态筛选">
            <button
              v-for="filter in filters"
              :key="filter.value"
              :aria-pressed="status === filter.value"
              :class="{ selected: status === filter.value }"
              @click="status = filter.value"
            >
              {{ filter.label }}
            </button>
          </div>
        </div>
      </div>
      <div class="selection-line">
        <label class="check-label"
          ><input
            type="checkbox"
            :checked="allChecked"
            :indeterminate="someChecked"
            :disabled="words.loading.value || !pageIds.length"
            @change="
              togglePage(pageIds, ($event.target as HTMLInputElement).checked)
            "
          />选择当前页</label
        ><span v-if="count" class="selected-count" aria-live="polite"
          >已选 {{ count }} 个</span
        ><button v-if="count" class="text-button" @click="clear">
          清空选择</button
        ><AppButton
          v-if="count"
          class="selection-start"
          :busy="creating"
          :disabled="count > 100"
          @click="start(true)"
          >开始学习<ArrowRight :size="15" /></AppButton
        ><span v-else class="selection-hint">支持跨页选词 · 最多 100 个</span>
      </div>
      <p v-if="count > 100" class="form-error" role="alert">
        每轮最多选择 100 个词，请取消部分选择后再开始。
      </p>
      <StatePanel
        :loading="words.loading.value"
        :error="words.error.value"
        :empty="words.data.value?.total === 0"
        message="没有找到符合条件的单词，试试其他关键词或筛选。"
        @retry="reload"
      />
      <div
        v-if="!words.loading.value && words.data.value?.records.length"
        class="word-table"
      >
        <div class="word-table-head">
          <span /><span>单词</span><span>释义</span><span>学习状态</span>
        </div>
        <div
          v-for="word in words.data.value.records"
          :key="word.id"
          :class="['word-row', { 'row-selected': selected.has(word.id) }]"
        >
          <label class="word-check"
            ><input
              type="checkbox"
              :aria-label="`选择 ${word.word}`"
              :checked="selected.has(word.id)"
              @change="
                toggle(word.id, ($event.target as HTMLInputElement).checked)
              "
          /></label>
          <div class="word-name">{{ word.word }}</div>
          <WordMeaning class="word-translation" :translation="word.translation" :translation-groups="word.translationGroups" />
          <span :class="['learning-status', { learned: word.learned }]"
            ><span class="status-dot" />{{
              word.learned ? "已学" : "未学"
            }}</span
          >
        </div>
      </div>
      <AppPagination
        v-if="words.data.value"
        :page="page"
        :size="size"
        :total="words.data.value.total"
        :disabled="words.loading.value"
        @change="changePage"
      />
    </section>
    <div class="learning-start">
      <div class="manual-start">
        <span class="action-icon"><Check :size="19" /></span>
        <div>
          <strong>{{
            count ? `已选 ${count} 个单词` : "挑选你想学习的词"
          }}</strong>
          <p>
            {{
              count
                ? "带上这些词，进入专注学习"
                : "勾选单词后，可开始手动选词学习"
            }}
          </p>
        </div>
        <AppButton
          :disabled="!count || count > 100"
          :busy="creating"
          @click="start(true)"
          >{{ count ? `学习所选 ${count} 个词` : "手动选词学习"
          }}<ArrowRight :size="17"
        /></AppButton>
      </div>
      <div class="book-start">
        <div class="flex items-center gap-2">
          <Layers :size="17" /><span>按词书开始</span>
        </div>
        <label class="count-input"
          ><span>本轮</span
          ><input
            v-model.number="roundCount"
            type="number"
            min="1"
            max="100"
            step="1"
            aria-label="本轮单词数量"
          /><span>个词</span></label
        ><AppButton variant="secondary" :busy="creating" @click="start(false)"
          >开始<ArrowRight :size="16"
        /></AppButton>
        <p>依次选取未学词，不足时按实际数量</p>
      </div>
      <p v-if="createError" class="form-error" role="alert">
        {{ createError }}
      </p>
    </div>
    <p class="page-footnote">学过，是一次相遇；记住，需要慢慢来。</p>
  </template>
</template>
