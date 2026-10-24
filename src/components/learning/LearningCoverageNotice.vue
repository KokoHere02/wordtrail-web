<script setup lang="ts">
import type { LearningCoverage } from '../../types/insights';
defineProps<{ coverage: LearningCoverage }>();
const time = (value: string | null) => value ? value.replace('T', ' ') : '未记录';
</script>
<template>
  <div class="insights-coverage">
    <template v-if="!coverage.statisticsComplete"><p class="insights-coverage-warning" role="status">基于已记录事件，部分历史缺少记录（{{ coverage.incompleteWordCount }} 个词）。</p><p v-if="coverage.firstRecordedAt || coverage.lastRecordedAt">记录范围：{{ time(coverage.firstRecordedAt) }} — {{ time(coverage.lastRecordedAt) }}（北京时间）</p><p v-else>暂无已记录的正常作答时间，零不表示从未学习。</p></template>
    <details class="copy-note"><summary>统计范围</summary><p v-if="coverage.statisticsComplete">记录范围：{{ coverage.firstRecordedAt || coverage.lastRecordedAt ? `${time(coverage.firstRecordedAt)} — ${time(coverage.lastRecordedAt)}（北京时间）` : '暂无已记录的正常作答时间' }}</p><p>完整性覆盖本来源全部保留明细，不限于当前 7／30 天；已有记录不能保证覆盖更早的全部历史。</p><p>{{ coverage.dataScope === 'RECORDED_ANSWERS_AND_DAILY_ITEMS' ? '完成词数取每日明细，作答与连续天数只取正常事件。' : '专项完成词数、作答与连续天数只取正常事件。' }}</p></details>
  </div>
</template>
