<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-vue-next";
import { usePreviewStore } from "../../stores/preview";
const store = usePreviewStore();
const route = useRoute();
const record = computed(() =>
  store.records.find((record) => record.id === Number(route.params.recordId)),
);
function restart() {
  store.resetMemory();
  store.resetDictation();
}
</script>
<template>
  <div class="preview-result-page">
    <RouterLink to="/records" class="muted-link"
      ><ArrowLeft :size="17" />返回学习记录</RouterLink
    ><template v-if="record"
      ><div class="result-celebration">
        <span class="completion-check"><Check :size="30" /></span>
        <p class="overline">A LITTLE BETTER THAN YESTERDAY</p>
        <h1>今天的你，又进步了一点。</h1>
        <p>{{ record.bookName }} · {{ record.mode }}已完成</p>
      </div>
      <div class="preview-result-stats">
        <div>
          <strong>{{ record.total }}</strong
          ><span>本轮单词</span>
        </div>
        <div>
          <strong>{{ record.known }}</strong
          ><span>{{ record.mode === "记忆复习" ? "认识" : "独立答对" }}</span>
        </div>
        <div>
          <strong>{{ record.uncertain }}</strong
          ><span>模糊</span>
        </div>
        <div>
          <strong>{{ record.forgot }}</strong
          ><span>{{ record.mode === "记忆复习" ? "忘记" : "还需练习" }}</span>
        </div>
      </div>
      <p class="result-disclaimer">
        {{
          record.mode === "记忆复习"
            ? "这是本轮的记忆自评，认识的词，也值得再见。"
            : "查看过答案的词，不计入独立答对。"
        }}
      </p>
      <div class="result-ctas">
        <RouterLink
          :to="record.mode === '记忆复习' ? '/learn' : '/dictation'"
          class="btn btn-secondary"
          @click="restart"
          ><RotateCcw :size="18" />再练习一轮</RouterLink
        ><RouterLink to="/today" class="btn btn-primary"
          >回到今日<ArrowRight :size="18"
        /></RouterLink></div
    ></template>
    <div v-else class="records-empty">
      <h1>还没有这一轮记录</h1>
      <RouterLink to="/records" class="violet-link"
        >查看学习记录<ArrowRight :size="18"
      /></RouterLink>
    </div>
  </div>
</template>
