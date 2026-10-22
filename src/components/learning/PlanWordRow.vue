<script setup lang="ts">
import { computed } from 'vue';
import { Ellipsis } from 'lucide-vue-next';
import type { PlanWord, PlanStatus } from '../../types/daily';
const props = defineProps<{ word: PlanWord; selected: boolean; expanded: boolean; busy: boolean }>();
const emit = defineEmits<{ select: [checked: boolean]; expand: []; history: []; change: [id: number, status: PlanStatus]; remove: [] }>();
const labels = { 1: '认识', 2: '模糊', 3: '不认识' } as const;
const detailId = computed(() => `plan-word-${props.word.wordId}`);
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
  <article :class="['live-plan-row', 'plan-row', { 'is-open': expanded, 'is-selected': selected }]" role="rowgroup">
    <div class="plan-row-main" role="row">
      <div class="plan-check-cell" role="cell"><input v-if="word.planStatus !== 'REMOVED'" type="checkbox" :checked="selected" :disabled="busy" :aria-label="`选择计划单词 ${word.word}`" @change="emit('select', ($event.target as HTMLInputElement).checked)" /></div>
      <div class="plan-word" role="cell"><div class="plan-word-title"><button :aria-expanded="expanded" :aria-controls="detailId" @click="emit('expand')"><strong lang="en">{{ word.word }}</strong></button><span class="plan-phonetic">{{ word.phonetic }}</span></div><p>{{ word.translation || '暂无释义' }}</p></div>
      <div class="plan-memory" role="cell"><div class="plan-level-bars" :aria-label="word.firstLearnedAt ? `复习等级 ${word.reviewLevel}，最高 6 级` : '尚未开始复习'" role="img"><i v-for="level in 7" :key="level" :class="{ filled: word.firstLearnedAt && level <= word.reviewLevel + 1 }" /></div><span>{{ word.firstLearnedAt ? `复习等级 ${word.reviewLevel} / 6` : '新加入' }}</span></div>
      <div class="plan-review" role="cell"><span :class="['plan-review-badge', { 'is-due': schedule.due, 'is-scheduled': word.nextReviewAt && word.planStatus === 'ACTIVE' }]" :title="word.nextReviewAt ? `北京时间 ${word.nextReviewAt.replace('T', ' ')}` : undefined">{{ schedule.label }}</span></div>
      <div class="plan-more" role="cell"><button class="round-icon" :aria-expanded="expanded" :aria-controls="detailId" :aria-label="`${expanded ? '收起' : '展开'} ${word.word} 的操作`" @click="emit('expand')"><Ellipsis :size="22" /></button></div>
    </div>
    <Transition name="plan-details"><div v-if="expanded" :id="detailId" class="plan-row-details" role="row"><div class="plan-detail-cell" role="cell" aria-colspan="5"><div class="plan-record"><p>{{ word.lastResult ? `最近反馈：${labels[word.lastResult]}` : '暂无反馈记录' }}</p><span>{{ word.lastLearnedAt ? `上次学习 ${word.lastLearnedAt.replace('T', ' ')}` : `加入于 ${word.joinedAt.replace('T', ' ')}` }}（北京时间）</span></div><div class="plan-item-actions"><button class="muted-link" @click="emit('history')">学习历史</button><template v-if="word.planStatus !== 'REMOVED'"><button class="muted-link" :disabled="busy" @click="emit('change', word.wordId, word.planStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')">{{ word.planStatus === 'ACTIVE' ? '暂停' : '重新启用' }}</button><button class="muted-link" :disabled="busy" @click="emit('remove')">移出</button></template></div></div></div></Transition>
  </article>
</template>
