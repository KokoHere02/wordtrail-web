<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { ArrowRight } from "lucide-vue-next";
import { api } from "../../api";
import { useResource } from "../../composables/useResource";
import type { BatchListItem, Page, Status } from "../../types/api";
import AppPagination from "../../components/ui/AppPagination.vue";
import StatePanel from "../../components/ui/StatePanel.vue";
const { data, loading, error, load } = useResource<Page<BatchListItem>>();
const status = ref<Status>("IN_PROGRESS");
const page = ref(1);
const size = 8;
const filters: { value: Status; label: string }[] = [
  { value: "IN_PROGRESS", label: "进行中" },
  { value: "COMPLETED", label: "已完成" },
  { value: "ABANDONED", label: "已放弃" },
];
function reload() {
  void load(() =>
    api.batches({ page: page.value, size, status: status.value }),
  );
}
watch(status, () => {
  page.value = 1;
  reload();
});
onMounted(reload);
function changePage(value: number) {
  page.value = value;
  reload();
}
function localTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
</script>
<template>
  <div class="records-page">
  <section class="page-heading">
    <div>
      <h1>认识专项</h1>
    </div>
    <div class="live-actions"><RouterLink to="/dictation" class="text-button">单词默写</RouterLink><RouterLink to="/sentences" class="text-button">句子英译中</RouterLink><RouterLink to="/weak-words" class="text-button"
      >薄弱词巩固<ArrowRight :size="15"
    /></RouterLink></div>
  </section>
  <div
    class="segmented learning-filters"
    role="group"
    aria-label="批次状态筛选"
  >
    <button
      v-for="filter in filters"
      :key="filter.value"
      :class="{ selected: status === filter.value }"
      :aria-pressed="status === filter.value"
      @click="status = filter.value"
    >
      {{ filter.label }}
    </button>
  </div>
  <StatePanel
    :loading="loading"
    :error="error"
    :empty="data?.total === 0"
    :message="
      status === 'IN_PROGRESS'
        ? '还没有进行中的学习。去词书页，开启你的第一轮吧。'
        : status === 'COMPLETED'
          ? '完成一轮学习后，就能在这里回顾。'
          : '暂无已放弃的批次。'
    "
    @retry="reload"
  />
  <div v-if="!loading && !error" class="batch-list">
    <article
      v-for="batch in data?.records"
      :key="batch.batchId"
      class="batch-card"
    >
      <div class="batch-info">
        <h2>{{ batch.bookName || (batch.bookId === null ? '跨词本专项' : '词书专项') }}</h2>
        <p>
          {{ localTime(batch.createdAt) }} 创建 ·
          {{ batch.selectionType === "BOOK" ? "按词书学习" : "手动选词" }}
        </p>
      </div>
      <div class="batch-numbers">
        <strong>{{ batch.answeredCount }}</strong> / {{ batch.totalCount }} 已答
        <div class="progress-track" aria-hidden="true">
          <span
            :style="{
              width: `${batch.totalCount ? (batch.answeredCount / batch.totalCount) * 100 : 0}%`,
            }"
          />
        </div>
      </div>
      <RouterLink
        v-if="batch.status !== 'ABANDONED'"
        :to="
          batch.status === 'COMPLETED'
            ? `/learning/${batch.batchId}/result`
            : `/study/${batch.batchId}`
        "
        class="btn btn-secondary"
        >{{ batch.status === "COMPLETED" ? "查看结果" : "继续学习"
        }}<ArrowRight :size="16" /></RouterLink
      ><span v-else class="batch-state">已放弃</span>
    </article>
  </div>
  <AppPagination
    v-if="data"
    :page="page"
    :size="size"
    :total="data.total"
    :disabled="loading"
    @change="changePage"
  />
  </div>
</template>
