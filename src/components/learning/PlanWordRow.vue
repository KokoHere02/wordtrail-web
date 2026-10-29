<script setup lang="ts">
import { computed } from 'vue';
import { History, ListMinus, Pause, Play } from 'lucide-vue-next';
import type { PlanWord, PlanStatus } from '../../types/daily';
import WordMeaning from '../word/WordMeaning.vue';
const props = defineProps<{ word: PlanWord; selected: boolean; busy: boolean }>();
const emit = defineEmits<{ select: [checked: boolean]; history: []; change: [id: number, status: PlanStatus]; remove: [] }>();
const schedule = computed(() => {
  const word = props.word;
  if (word.planStatus === 'PAUSED') return { label: '已暂停', due: false };
  if (word.planStatus === 'REMOVED') return { label: '已移出', due: false };
  if (!word.nextReviewAt) return { label: word.firstLearnedAt ? '待安排' : '尚未开始', due: false };
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
  const tomorrow = new Date(`${today}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const day = word.nextReviewAt.slice(0, 10);
  if (day < today) return { label: '已到期待复习', due: true };
  if (day === today) return { label: '今天复习', due: true };
  if (day === tomorrow.toISOString().slice(0, 10)) return { label: '明天复习', due: false };
  return { label: `${day.slice(0, 4) === today.slice(0, 4) ? '' : `${day.slice(0, 4)} 年 `}${Number(day.slice(5, 7))} 月 ${Number(day.slice(8, 10))} 日`, due: false };
});
</script>
<template>
  <article :class="['live-plan-row', 'plan-row', { 'is-selected': selected }]" role="rowgroup">
    <div class="plan-row-main" role="row">
      <div class="plan-check-cell" role="cell"><input v-if="word.planStatus !== 'REMOVED'" type="checkbox" :checked="selected" :disabled="busy" :aria-label="`选择计划单词 ${word.word}`" @change="emit('select', ($event.target as HTMLInputElement).checked)" /></div>
      <div class="plan-word" role="cell"><div class="plan-word-title"><RouterLink :to="`/words/${word.wordId}`"><strong lang="en">{{ word.word }}</strong></RouterLink><span class="plan-phonetic">{{ word.phonetic }}</span></div><WordMeaning :translation="word.translation" :translation-groups="word.translationGroups" /></div>
      <div class="plan-memory" role="cell"><div class="plan-level-bars" :aria-label="word.firstLearnedAt ? `复习等级 ${word.reviewLevel}，最高 6 级` : '尚未开始复习'" role="img"><i v-for="level in 7" :key="level" :class="{ filled: word.firstLearnedAt && level <= word.reviewLevel + 1 }" /></div><span>{{ word.firstLearnedAt ? `复习等级 ${word.reviewLevel} / 6` : '新加入' }}</span></div>
      <div class="plan-review" role="cell"><span :class="['plan-review-badge', { 'is-due': schedule.due, 'is-scheduled': word.nextReviewAt && word.planStatus === 'ACTIVE' }]" :title="word.nextReviewAt ? `北京时间 ${word.nextReviewAt.replace('T', ' ')}` : undefined">{{ schedule.label }}</span></div>
      <div class="plan-item-actions" role="cell"><button type="button" class="plan-action plan-action-history" @click="emit('history')"><History :size="15" aria-hidden="true" />学习历史</button><template v-if="word.planStatus !== 'REMOVED'"><button type="button" :class="['plan-action', word.planStatus === 'ACTIVE' ? 'plan-action-pause' : 'plan-action-resume']" :disabled="busy" @click="emit('change', word.wordId, word.planStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')"><Pause v-if="word.planStatus === 'ACTIVE'" :size="15" aria-hidden="true" /><Play v-else :size="15" aria-hidden="true" />{{ word.planStatus === 'ACTIVE' ? '暂停' : '重新启用' }}</button><button type="button" class="plan-action plan-action-remove" :disabled="busy" @click="emit('remove')"><ListMinus :size="15" aria-hidden="true" />移出</button></template></div>
    </div>
  </article>
</template>
