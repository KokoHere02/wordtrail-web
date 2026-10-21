<script setup lang="ts">
import type { DailyStudyItem } from '../../types/daily';
defineProps<{ item: DailyStudyItem; answered?: boolean }>();
</script>
<template>
  <p class="reinforcement-status subtle-copy" role="status">
    <template v-if="item.learningStatus === 'SKIPPED'">已跳过</template>
    <template v-else-if="item.learningStatus === 'DONE'">
      {{ item.completionReason === 'LIMIT_REACHED' ? '当天暂时结束，仍需巩固' : item.completionReason === 'RECALLED' ? '本词今日验证完成' : '本词今日流程已结束' }}
    </template>
    <template v-else>
      <span v-if="item.learningStatus === 'RELEARNING'">{{ item.reinforcementRemaining == null ? '强化中 · 剩余验证次数未记录' : `强化 · 还需 ${item.reinforcementRemaining} 次认识验证` }} · </span>
      <span v-if="item.nextAttemptNo !== null">{{ answered ? '下次第' : '本词第' }} {{ item.nextAttemptNo }} / {{ item.attemptLimit }} 次作答</span>
    </template>
  </p>
</template>
