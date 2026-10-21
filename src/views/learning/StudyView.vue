<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, ArrowRight, Check, HelpCircle, X } from "lucide-vue-next";
import { api } from "../../api";
import { ApiError, errorMessage } from "../../api/http";
import { useBooksStore } from "../../stores/books";
import type { BatchProgress, Result, StudyItem } from "../../types/api";
import AppButton from "../../components/ui/AppButton.vue";
import StatePanel from "../../components/ui/StatePanel.vue";
const route = useRoute();
const router = useRouter();
const id = Number(route.params.batchId);
const progress = ref<BatchProgress>();
const item = ref<StudyItem>();
const bookName = ref("专注学习");
const loading = ref(true);
const loadError = ref("");
const saveError = ref("");
const saving = ref(false);
const pendingAnswer = ref<{ result: Result; requestId: string }>();
const syncAvailable = ref(false);
const choices = [
  { value: 1 as Result, label: "认识", icon: Check },
  { value: 2 as Result, label: "不确定", icon: HelpCircle },
  { value: 3 as Result, label: "不认识", icon: X },
];
const percent = computed(() =>
  progress.value
    ? (progress.value.answeredCount / progress.value.wordCount) * 100
    : 0,
);
async function load() {
  loading.value = true;
  loadError.value = "";
  saveError.value = "";
  syncAvailable.value = false;
  pendingAnswer.value = undefined;
  try {
    const current = await api.progress(id);
    progress.value = current;
    if (current.status === "COMPLETED") {
      await router.replace(`/learning/${id}/result`);
      return;
    }
    if (current.status === "ABANDONED") {
      loadError.value = "本轮已放弃，请返回我的学习选择其他批次。";
      item.value = undefined;
      return;
    }
    if (current.nextItemId === null)
      throw new Error("当前批次没有待答单词，请返回我的学习刷新进度。");
    const details = await api.item(id, current.nextItemId);
    item.value = details;
    if (current.bookId) {
      try {
        bookName.value = (await useBooksStore().find(current.bookId)).name;
      } catch {
        bookName.value = "词书学习";
      }
    }
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
async function answer(result: Result) {
  if (saving.value || syncAvailable.value || !item.value || !progress.value)
    return;
  if (pendingAnswer.value && pendingAnswer.value.result !== result) {
    saveError.value = '上次保存结果尚未确认，请先重试原选择。';
    return;
  }
  pendingAnswer.value ||= { result, requestId: crypto.randomUUID() };
  saving.value = true;
  saveError.value = "";
  try {
    const saved = await api.answer(id, item.value.itemId, result, pendingAnswer.value.requestId);
    pendingAnswer.value = undefined;
    item.value = {
      ...item.value,
      answered: true,
      result: saved.result,
      translation: saved.translation ?? "",
      answeredAt: saved.answeredAt,
      nextItemId: saved.nextItemId,
    };
    progress.value = {
      ...progress.value,
      status: saved.status,
      answeredCount: saved.answeredCount,
      wordCount: saved.wordCount,
      nextItemId: saved.nextItemId,
    };
  } catch (e) {
    saveError.value = errorMessage(e);
    if (e instanceof ApiError && e.status === 409 && e.code !== 'REQUEST_ID_REUSED') {
      syncAvailable.value = true;
      // Reconcile progress without discarding the displayed word or a previously saved answer.
      try {
        progress.value = await api.progress(id);
      } catch {
        /* Keep the actionable original error. */
      }
    }
  } finally {
    saving.value = false;
  }
}
async function next() {
  if (saving.value || syncAvailable.value || !item.value?.answered) return;
  if (!item.value.nextItemId) {
    await router.push(`/learning/${id}/result`);
    return;
  }
  loading.value = true;
  loadError.value = "";
  saveError.value = "";
  try {
    item.value = await api.item(id, item.value.nextItemId);
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <header class="study-topbar">
    <RouterLink to="/learning" class="back-link"
      ><ArrowLeft :size="18" /><span>返回</span></RouterLink
    ><span class="study-book-title">{{ bookName }}</span>
    <div class="study-progress">
      <div
        class="progress-track"
        role="progressbar"
        aria-label="已答进度"
        :aria-valuenow="progress?.answeredCount || 0"
        :aria-valuemax="progress?.wordCount || 1"
      >
        <span :style="{ width: `${percent}%` }" />
      </div>
      <span
        >{{ progress?.answeredCount || 0 }} / {{ progress?.wordCount || "—" }}
        <span class="desktop-inline">已答</span></span
      >
    </div>
  </header>
  <main class="study-main">
    <StatePanel :loading="loading" :error="loadError" @retry="load" /><template
      v-if="!loading && !loadError && item"
      ><div class="study-position eyebrow">
        第 {{ item.sortOrder }} 个 / 共 {{ progress?.wordCount }} 个
      </div>
      <section class="study-word-area" aria-label="当前单词">
        <h1
          :class="['study-word', { 'long-word': item.word.length > 15 }]"
          lang="en"
        >
          {{ item.word }}
        </h1>
        <p v-if="item.phonetic" class="phonetic">{{ item.phonetic }}</p>
      </section>
      <div class="meaning-area" aria-live="polite">
        <span class="meaning-divider" />
        <p v-if="item.answered" class="study-meaning">
          {{ item.translation || "暂无释义" }}
        </p>
        <p v-else class="meaning-placeholder">
          在心里想一想，这个词是什么意思？
        </p>
      </div>
      <div class="study-actions">
        <div class="answer-choices" role="group" aria-label="你认识这个单词吗">
          <button
            v-for="choice in choices"
            :key="choice.value"
            :class="['answer-button', { chosen: item.result === choice.value }]"
            :disabled="saving || item.answered || syncAvailable || (!!pendingAnswer && pendingAnswer.result !== choice.value)"
            :aria-pressed="item.result === choice.value"
            @click="answer(choice.value)"
          >
            <component :is="choice.icon" :size="18" /><span>{{
              choice.label
            }}</span>
          </button>
        </div>
        <div class="correction-slot">
          <button
            v-if="item.answered && item.result === 1"
            class="correction-button"
            :disabled="saving || syncAvailable"
            @click="answer(3)"
          >
            记错了</button
          ><span v-else-if="item.answered" class="saved-note"
            ><Check :size="14" />已保存本次自评</span
          ><span v-else class="saved-note">{{
            saving ? "正在保存…" : ""
          }}</span>
        </div>
        <p v-if="saveError" class="form-error" role="alert">{{ saveError }}</p>
        <button v-if="syncAvailable" class="text-button" @click="load">
          按最新进度恢复
        </button>
        <AppButton
          class="next-button"
          :disabled="!item.answered || syncAvailable || !!pendingAnswer"
          :busy="saving"
          @click="next"
          >{{ item.nextItemId ? "下一个" : "完成本轮" }}<ArrowRight :size="19"
        /></AppButton>
      </div>
</template
    >
  </main>
</template>
