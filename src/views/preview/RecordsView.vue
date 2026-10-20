<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowRight, ArrowUpRight, BookOpen, Clock3 } from "lucide-vue-next";
import { usePreviewStore } from "../../stores/preview";
const store = usePreviewStore();
const filter = ref("全部");
const records = computed(() =>
  store.records.filter(
    (record) => filter.value === "全部" || record.mode === filter.value,
  ),
);
</script>
<template>
  <div class="records-page">
    <header class="library-heading">
      <div>
        <p class="overline reveal">LITTLE STEPS, LASTING CHANGE</p>
        <h1 class="reveal" style="--delay: 60ms">每一步，都算数。</h1>
        <p class="hero-subtitle reveal" style="--delay: 120ms">
          把一点一滴的积累，留在这里。
        </p>
      </div>
      <RouterLink to="/learn" class="btn btn-primary"
        >继续今日学习<ArrowRight :size="18"
      /></RouterLink>
    </header>
    <nav class="category-tabs">
      <button
        v-for="value in ['全部', '记忆复习', '单词默写']"
        :key="value"
        :class="{ active: filter === value }"
        @click="filter = value"
      >
        {{ value }}
      </button>
    </nav>
    <TransitionGroup tag="div" name="book-grid" class="record-list"
      ><RouterLink
        v-for="record in records"
        :key="record.id"
        :to="`/records/${record.id}`"
        class="record-card"
        ><span class="record-icon"><BookOpen :size="24" /></span>
        <div>
          <span class="learning-badge">{{ record.mode }}</span>
          <h2>{{ record.bookName }}</h2>
          <p>
            {{
              new Date(record.createdAt).toLocaleString("zh-CN", {
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            }}
          </p>
        </div>
        <div class="record-summary">
          <strong>{{ record.total }}<small>词</small></strong
          ><span
            ><Clock3 :size="14" />{{
              Math.floor(record.seconds / 60)
            }}
            分钟</span
          >
        </div>
        <ArrowUpRight :size="22" class="record-arrow" /></RouterLink
    ></TransitionGroup>
    <div v-if="!records.length" class="records-empty">
      <span class="empty-book-icon"
        ><BookOpen :size="38" :stroke-width="1.3"
      /></span>
      <h2>下一次积累，从现在开始。</h2>
      <p>
        完成一轮记忆或默写后，就能在这里回顾。<br />先去和几个单词见见面吧。
      </p>
      <RouterLink to="/learn" class="violet-link"
        >开启今日学习<ArrowRight :size="18"
      /></RouterLink>
    </div>
  </div>
</template>
