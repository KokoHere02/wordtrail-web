<script setup lang="ts">
import { onMounted } from 'vue';
import { ArrowRight, ArrowUpRight } from 'lucide-vue-next';
import { dailyApi } from '../../api/daily';
import { useResource } from '../../composables/useResource';
import type { TodayOverview } from '../../types/daily';
import StatePanel from '../../components/ui/StatePanel.vue';
import ProgressBar from '../../components/ui/ProgressBar.vue';
import TodayStatistics from '../../components/learning/TodayStatistics.vue';
const { data, loading, error, load } = useResource<TodayOverview>();
const refresh = () => load(dailyApi.today);
onMounted(refresh);
</script>
<template>
  <div class="today-page">
    <section class="today-hero">
      <p class="overline reveal">A LITTLE EVERY DAY</p><h1 class="reveal" style="--delay: 60ms">一点点，记得更久。</h1>
      <p class="hero-subtitle reveal" style="--delay: 120ms">今天也给英语留一点时间。</p>
      <StatePanel :loading="loading" :error="error" @retry="refresh" />
      <template v-if="data && !loading && !error">
        <p class="live-date">{{ data.learningDate }} · {{ data.task ? '本任务目标' : '今日目标' }} {{ data.dailyTarget }} 词 · <RouterLink to="/settings" class="violet-link">设置目标</RouterLink></p>
        <div class="daily-equation reveal" style="--delay: 180ms">
          <div><strong>{{ data.dueCount }}</strong><span>到期待复习</span></div><b>·</b>
          <div><strong>{{ data.newCount }}</strong><span>计划内新词</span></div><b>·</b>
          <div><strong>{{ data.task ? data.task.totalCount : '—' }}</strong><span>{{ data.task ? '今日已安排' : '开始后安排' }}</span></div>
        </div>
        <div class="today-cta reveal" style="--delay: 240ms">
          <RouterLink :to="data.task && data.task.status !== 'IN_PROGRESS' ? `/records/${data.task.batchId}` : '/learn'" class="btn btn-primary btn-hero">{{ data.task?.status === 'COMPLETED' ? '查看今日结果' : data.task?.status === 'ABANDONED' ? '查看今日记录' : data.task ? '继续今日学习' : '开始今日学习' }}<ArrowRight :size="21" /></RouterLink>
          <RouterLink to="/books" class="btn btn-secondary btn-hero">去词库选词</RouterLink>
        </div>
        <p class="hero-hint">先安排到期复习，再补充新词；候选数量不等于今日实际安排。</p>
      </template>
    </section>
    <section v-if="data && !loading && !error" class="today-plan reveal" style="--delay: 280ms">
      <div class="today-plan-content">
        <div class="plan-heading"><h2>我的长期学习计划</h2><RouterLink to="/plan" class="violet-link">管理计划<ArrowRight :size="19" /></RouterLink></div>
        <p>当前有 {{ data.activeCount }} 个启用中的单词 · 每日从整个计划安排学习</p>
        <div v-if="data.task" class="plan-progress"><ProgressBar :value="data.task.completedCount" :max="data.task.totalCount" label="今日完成进度" /><span>今日完成 {{ data.task.completedCount }} / {{ data.task.totalCount }} 词 · 跳过 {{ data.task.skippedCount }} 词</span></div>
        <p v-else class="subtle-copy">{{ data.activeCount ? '准备好后开始今日任务，加入的新词会按服务端调度安排。' : '还没有启用中的单词，先去词库把想学的词加入计划。' }}</p>
      </div>
    </section>
    <TodayStatistics />
    <div class="today-streak"><span>每次自评，都是下一次复习的依据。</span><RouterLink to="/records" class="muted-link">查看学习记录<ArrowUpRight :size="18" /></RouterLink></div>
  </div>
</template>
