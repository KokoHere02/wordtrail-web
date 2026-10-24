<script setup lang="ts">
import type { SentenceHistory } from '../../types/sentences';
import { sentenceAssessmentLabel } from '../../types/sentences';
import { ref } from 'vue';
import SentenceScheduleDialog from './SentenceScheduleDialog.vue';
defineProps<{ records: SentenceHistory[] }>();
const scheduleId = ref<number | null>(null);
const scheduleOpen = ref(false);
</script>
<template>
  <div class="sentence-history-rows"><article v-for="entry in records" :key="entry.attemptId" class="sentence-history-row"><p lang="en" class="sentence-english">{{ entry.englishText }}</p><span class="learning-badge">{{ sentenceAssessmentLabel(entry.selfAssessment) }}</span><dl class="sentence-comparison"><div><dt>{{ entry.action === 'REVEAL' ? '本次操作' : '你的译文' }}</dt><dd>{{ entry.action === 'REVEAL' ? '不会，查看解析' : entry.translation }}</dd></div><div><dt>参考译文</dt><dd>{{ entry.referenceTranslation }}</dd></div><div><dt>参考解析</dt><dd>{{ entry.explanation }}</dd></div></dl><p class="subtle-copy">提交：{{ entry.submittedAt.replace('T', ' ') }} · 学习日 {{ entry.learningDate }}</p><p v-if="entry.reviewedAt" class="subtle-copy">自评：{{ entry.reviewedAt.replace('T', ' ') }} · 自评日 {{ entry.reviewDate }}</p><p v-else class="subtle-copy">尚未保存自评</p><button type="button" class="muted-link" @click="scheduleId = entry.sentenceId; scheduleOpen = true">当前复习安排</button></article><SentenceScheduleDialog v-model="scheduleOpen" :sentence-id="scheduleId" /></div>
</template>
