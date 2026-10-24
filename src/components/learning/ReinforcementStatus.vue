<script setup lang="ts">
import type { DailyStudyItem } from '../../types/daily';
defineProps<{ item: DailyStudyItem }>();
</script>
<template>
  <p v-if="item.learningStatus !== 'PENDING'" class="reinforcement-status subtle-copy" role="status">
    <template v-if="item.learningStatus === 'SKIPPED'">已跳过</template>
    <template v-else-if="item.learningStatus === 'DONE'">
      {{ item.completionReason === 'LIMIT_REACHED' ? '当天暂时结束，仍需巩固' : '本词今日已完成' }}
    </template>
    <template v-else>
      {{ item.reinforcementRemaining == null ? '巩固次数暂未提供' : `还需巩固 ${item.reinforcementRemaining} 次` }}
    </template>
  </p>
</template>
