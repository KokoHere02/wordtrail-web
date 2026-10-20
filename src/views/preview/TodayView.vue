<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Keyboard,
} from "lucide-vue-next";
import { usePreviewStore } from "../../stores/preview";
import BookCover from "../../components/word/BookCover.vue";
import ProgressBar from "../../components/ui/ProgressBar.vue";
const store = usePreviewStore();
const router = useRouter();
const total = computed(() => 32 + store.dailyNew);
function keyboard(event: KeyboardEvent) {
  if (
    event.key === "Enter" &&
    !(
      event.target instanceof HTMLElement &&
      event.target.closest("button,a,input,select,textarea")
    ) &&
    !store.settingsOpen &&
    !store.profileOpen
  ) {
    event.preventDefault();
    void router.push("/learn");
  }
}
onMounted(() => document.addEventListener("keydown", keyboard));
onBeforeUnmount(() => document.removeEventListener("keydown", keyboard));
</script>
<template>
  <div class="today-page">
    <section class="today-hero">
      <p class="overline reveal">A LITTLE EVERY DAY</p>
      <h1 class="reveal" style="--delay: 60ms">一点点，记得更久。</h1>
      <p class="hero-subtitle reveal" style="--delay: 120ms">
        今天也给英语留一点时间。
      </p>
      <div class="daily-equation reveal" style="--delay: 180ms">
        <div><strong>32</strong><span>待复习</span></div>
        <b>+</b>
        <div>
          <strong :key="store.dailyNew" class="number-change">{{
            store.dailyNew
          }}</strong
          ><span>待学新词</span>
        </div>
        <b>=</b>
        <div>
          <strong :key="total" class="number-change">{{ total }}</strong
          ><span>今日单词</span>
        </div>
      </div>
      <div class="today-cta reveal" style="--delay: 240ms">
        <RouterLink to="/learn" class="btn btn-primary btn-hero"
          >开始今日学习<ArrowRight :size="21" /></RouterLink
        ><RouterLink to="/dictation" class="btn btn-secondary btn-hero"
          ><Keyboard :size="25" />默写练习</RouterLink
        >
      </div>
      <p class="hero-hint reveal" style="--delay: 280ms">
        优先复习，再学新词。
      </p>
    </section>
    <section class="today-plan reveal" style="--delay: 330ms">
      <BookCover :label="store.activeBook.label" />
      <div class="today-plan-content">
        <div class="plan-heading">
          <h2>{{ store.activeBook.name }}</h2>
          <RouterLink :to="`/books/${store.activeBookId}`" class="violet-link"
            >调整词单<ArrowRight :size="19"
          /></RouterLink>
        </div>
        <p>
          已选择 {{ store.selectedCount }} 词<span> · </span>每日新词
          {{ store.dailyNew }} 个
        </p>
        <div class="plan-progress">
          <ProgressBar
            :value="store.planLearned"
            :max="store.selectedCount"
            label="词单学习进度"
          /><span
            >已学习 {{ store.planLearned }} / {{ store.selectedCount }} 词</span
          >
        </div>
      </div>
    </section>
    <div class="today-streak reveal" style="--delay: 380ms">
      <span><CalendarDays :size="23" />已连续学习 7 天</span
      ><RouterLink to="/records" class="muted-link"
        >查看学习记录<ArrowUpRight :size="18"
      /></RouterLink>
    </div>
  </div>
</template>
