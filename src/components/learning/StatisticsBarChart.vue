<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ records: { date: string; count: number; active: boolean }[]; selected: string; noun: string }>();
const emit = defineEmits<{ select: [date: string] }>();
const ceiling = computed(() => Math.max(1, ...props.records.map(row => row.count)));
</script>
<template>
  <div v-if="records.length" class="statistics-bar-scroll">
    <div class="statistics-bars" :class="{ 'is-long': records.length > 7 }" role="group" :aria-label="`每日完成${noun}数`">
      <button v-for="row in records" :key="row.date" type="button" :class="['statistics-bar-column', { selected: row.date === selected }]" :aria-label="`${row.date}，完成 ${row.count} ${noun}，${row.active ? '有学习活动' : '无学习活动'}`" :aria-pressed="row.date === selected" @click="emit('select', row.date)">
        <span class="statistics-bar-plot"><span class="statistics-bar-value" :style="{ bottom: `${row.count / ceiling * 82}%` }">{{ row.count }}</span><span v-if="row.count" class="statistics-bar" :style="{ height: `${row.count / ceiling * 82}%` }" /></span>
        <span class="statistics-bar-date">{{ row.date.slice(5).replace('-', '/') }}</span>
      </button>
    </div>
  </div>
  <p v-else class="subtle-copy" role="status">暂无趋势数据。</p>
</template>
<style scoped>
.statistics-bar-scroll { overflow-x: auto; padding-top: var(--s3); }
.statistics-bars { display: flex; min-width: 0; align-items: stretch; gap: var(--s2); border-bottom: 1px solid var(--line); }
.statistics-bars.is-long { min-width: 930px; }
.statistics-bar-column { flex: 1; min-width: 0; padding: 0 2px; border: 0; background: transparent; color: var(--muted); font-size: var(--text-sm); }
.statistics-bar-plot { position: relative; display: block; height: 205px; background: repeating-linear-gradient(to top, transparent 0, transparent 50px, var(--line) 51px, transparent 52px); }
.statistics-bar { position: absolute; left: 15%; right: 15%; bottom: 0; border-radius: 4px 4px 0 0; background: var(--accent); opacity: .68; }
.statistics-bar-column.selected .statistics-bar { opacity: 1; }
.statistics-bar-value { position: absolute; left: 0; right: 0; margin-bottom: 4px; color: var(--ink); line-height: 1.2; }
.statistics-bar-date { display: block; padding: var(--s3) 0; white-space: nowrap; }
</style>
