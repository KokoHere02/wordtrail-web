<script setup lang="ts">
import ProgressBar from "../ui/ProgressBar.vue";
defineProps<{
  time: string;
  done: number;
  total: number;
  extra: number;
  mode: "memory" | "dictation";
}>();
</script>
<template>
  <section class="session-stats" aria-label="本轮学习统计">
    <div class="session-stat-grid">
      <div>
        <strong class="tabular-nums">{{ time }}</strong
        ><span>专注时间</span>
      </div>
      <div>
        <strong :key="done" class="tabular-nums number-change"
          >{{ done }} / {{ total }}</strong
        ><span>{{ mode === "memory" ? "已完成单词" : "已练习单词" }}</span>
      </div>
      <div>
        <strong :key="extra" class="tabular-nums number-change">{{
          extra
        }}</strong
        ><span>{{ mode === "memory" ? "忘记次数" : "独立答对" }}</span>
      </div>
    </div>
    <ProgressBar :value="done" :max="total" />
    <p v-if="mode === 'dictation'" class="stats-caption">
      查看答案后的单词，不计入独立答对
    </p>
  </section>
</template>
