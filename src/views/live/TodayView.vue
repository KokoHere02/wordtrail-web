<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, ArrowUpRight } from 'lucide-vue-next';
import { dailyApi } from '../../api/daily';
import { useResource } from '../../composables/useResource';
import { useStartDaily } from '../../composables/useStartDaily';
import type { TodayOverview } from '../../types/daily';
import StatePanel from '../../components/ui/StatePanel.vue';
import ProgressBar from '../../components/ui/ProgressBar.vue';
import AppButton from '../../components/ui/AppButton.vue';
import { useDailyGoal } from '../../composables/useDailyGoal';

const router = useRouter();
const { data, loading, error, load } = useResource<TodayOverview>();
const { goal, refresh: refreshGoal } = useDailyGoal(() => data.value?.learningDate, () => data.value?.task?.batchId);
const refresh = async () => { await load(dailyApi.today); if (data.value) await refreshGoal(); };
const { starting, startError, noWords, start } = useStartDaily(undefined, refresh);
function continueLearning() {
  if (data.value?.task?.status === 'IN_PROGRESS') return router.push(`/learn/${data.value.task.batchId}`);
  return start();
}
onMounted(refresh);
</script>

<template>
  <div class="home-today">
    <header class="home-heading">
      <div>
        <p class="home-eyebrow">YOUR DAILY PRACTICE</p>
        <h1>今日学习</h1>
      </div>
      <span v-if="data && !loading && !error" class="home-date">{{ data.learningDate }}</span>
    </header>

    <StatePanel :loading="loading" :error="error" @retry="refresh" />
    <template v-if="data && !loading && !error">
      <div class="home-layout">
        <section class="home-focus today-hero" aria-labelledby="home-focus-title">
          <div class="home-section-label"><span>01</span> 今日进度</div>
          <div class="home-goal-heading">
            <div>
              <h2 id="home-focus-title" :class="{ 'daily-goal-status': goal?.reached }">{{ goal?.reached ? '今日目标已达成' : '把今天，交给一点进步。' }}</h2>
              <p v-if="goal && !goal.reached" class="daily-goal-status">{{ goal.reached ? '保持这份节奏，明天再继续。' : `距离每日目标还差 ${goal.remainingCount} 词` }}</p>
              <p v-else>每天一点，慢慢积累。</p>
            </div>
            <RouterLink to="/settings" class="home-text-link">设置目标 <ArrowUpRight :size="15" /></RouterLink>
          </div>
          <div v-if="goal" class="home-progress">
            <div class="home-progress-copy"><span>已完成 <strong>{{ goal.completedCount }}</strong> 词</span><span>{{ data.task ? '本任务目标' : '今日目标' }} {{ goal.dailyTarget }} 词</span></div>
            <ProgressBar :value="Math.min(goal.completedCount, goal.dailyTarget)" :max="goal.dailyTarget" :aria-valuetext="`完成 ${goal.completedCount} 词，目标 ${goal.dailyTarget} 词`" label="每日目标进度" />
          </div>
          <div v-else class="home-target">{{ data.task ? '本任务目标' : '今日目标' }} {{ data.dailyTarget }} 词</div>

          <div class="home-queue daily-equation" aria-label="今日待学习">
            <div><span>待复习</span><strong>{{ data.dueCount }} <small>词</small></strong></div>
            <div><span>计划内新词</span><strong>{{ data.newCount }} <small>词</small></strong></div>
          </div>

          <p v-if="data.needsMoreWords || noWords" class="home-notice daily-needs-words">请先从词库选词并加入学习计划。</p>
          <div class="home-actions today-cta">
            <RouterLink v-if="data.needsMoreWords || noWords" to="/books" class="btn btn-primary home-primary">添加单词到学习计划 <ArrowRight :size="19" /></RouterLink>
            <AppButton v-else-if="!data.task || data.task.status === 'IN_PROGRESS' || data.canAddMore" class="home-primary" :busy="starting" @click="continueLearning">{{ data.task ? '继续学习' : '开始学习' }} <ArrowRight :size="19" /></AppButton>
            <RouterLink v-else :to="`/records/${data.task.batchId}`" class="btn btn-primary home-primary">{{ data.task.status === 'ABANDONED' ? '查看今日记录' : '查看今日结果' }} <ArrowRight :size="19" /></RouterLink>
            <RouterLink v-if="!data.needsMoreWords && !noWords" to="/books" class="home-text-link">去词库选词 <ArrowUpRight :size="15" /></RouterLink>
          </div>
          <p v-if="startError" class="inline-error" role="alert">{{ startError }}</p>
          <p v-if="data.canAddMore" class="home-note">未安排 {{ data.unassignedCount }} 词 · <RouterLink :to="`/records/${data.task?.batchId}`" class="home-text-link">查看已有结果</RouterLink></p>
          <p v-else-if="data.task?.status === 'COMPLETED'" class="home-note">本组已结束</p>
        </section>

        <aside class="home-aside" aria-label="学习计划与其他练习">
          <section class="home-aside-section">
            <div class="home-section-label"><span>02</span> 学习计划</div>
            <div class="home-plan-line"><p><strong>{{ data.activeCount }}</strong> <span>个启用中的单词</span></p><RouterLink to="/plan" class="home-icon-link" aria-label="管理学习计划"><ArrowUpRight :size="20" /></RouterLink></div>
            <p v-if="data.task" class="home-aside-copy">本组已完成 {{ data.task.completedCount }} / {{ data.task.totalCount }} 词<span v-if="data.task.skippedCount"> · 跳过 {{ data.task.skippedCount }} 词</span></p>
            <details v-if="data.task" class="home-plan-details"><summary>查看本组安排</summary><p class="daily-assigned-counts">新词 {{ data.task.newCount }} · 复习 {{ data.task.reviewCount }}</p></details>
            <p v-else-if="!data.activeCount" class="home-aside-copy">从词库选词并加入学习计划。</p>
            <RouterLink to="/plan" class="home-text-link home-plan-link">管理计划 <ArrowRight :size="15" /></RouterLink>
          </section>
          <section class="home-aside-section home-explore">
            <div class="home-section-label"><span>03</span> 探索更多</div>
            <nav aria-label="其他学习入口">
              <RouterLink to="/follow-typing">跟拼练习 <ArrowUpRight :size="16" /></RouterLink>
              <RouterLink to="/consolidation">错因与巩固 <ArrowUpRight :size="16" /></RouterLink>
              <RouterLink to="/dictation">独立默写专项 <ArrowUpRight :size="16" /></RouterLink>
              <RouterLink to="/sentences">句子英译中 <ArrowUpRight :size="16" /></RouterLink>
            </nav>
          </section>
        </aside>
      </div>
      <footer class="home-footer"><span>每一次练习，都是向前一步。</span><div><RouterLink to="/statistics">学习统计 <ArrowUpRight :size="15" /></RouterLink><RouterLink to="/records">学习记录 <ArrowUpRight :size="15" /></RouterLink></div></footer>
    </template>
  </div>
</template>

<style scoped>
.home-today { width: min(100% - 48px, 1080px); margin: 0 auto; padding: clamp(40px, 6vw, 82px) 0 48px; }
.home-heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding-bottom: 27px; border-bottom: 1px solid var(--line); }
.home-eyebrow { color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: .16em; }
.home-heading h1 { margin-top: 10px; font-size: clamp(38px, 4.3vw, 58px); letter-spacing: -.055em; line-height: 1.15; }
.home-date { color: var(--muted); font-size: 14px; font-variant-numeric: tabular-nums; padding-bottom: 5px; }
.home-layout { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: clamp(60px, 9vw, 130px); padding-top: 55px; }
.home-section-label { display: flex; gap: 12px; align-items: center; color: var(--muted); font-size: 12px; font-weight: 600; letter-spacing: .05em; }
.home-section-label span { color: var(--accent); font-family: var(--font-serif); font-size: 13px; }
.home-focus.today-hero { text-align: left; padding: 0; }
.home-goal-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-top: 32px; }
.home-goal-heading h2 { margin: 0; font-size: clamp(23px, 2.4vw, 31px); letter-spacing: -.04em; line-height: 1.35; }
.home-goal-heading p { color: var(--muted); margin-top: 9px; font-size: 14px; }
.home-text-link { display: inline-flex; align-items: center; gap: 5px; color: var(--accent-strong); font-size: 13px; font-weight: 650; white-space: nowrap; }
.home-text-link:hover, .home-footer a:hover { text-decoration: underline; text-underline-offset: 4px; }
.home-goal-heading > .home-text-link { margin-top: 9px; }
.home-progress, .home-target { margin-top: 38px; }
.home-progress-copy { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; color: var(--muted); font-size: 13px; margin-bottom: 12px; }
.home-progress-copy strong { color: var(--ink); font-size: 20px; font-variant-numeric: tabular-nums; }
.home-progress :deep(.violet-progress) { height: 4px; background: var(--progress-track); }
.home-target { color: var(--muted); font-size: 14px; }
.home-queue { display: flex; align-items: flex-start; justify-content: flex-start; gap: clamp(56px, 9vw, 115px); margin-top: 43px; }
.home-queue > div { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; gap: 5px; }
.home-queue span { color: var(--muted); font-size: 13px; margin: 0; }
.home-queue strong { font-family: var(--font-serif); font-size: 45px; font-weight: 500; letter-spacing: -.04em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.home-queue small { color: var(--muted); font-family: var(--font-sans); font-size: 13px; font-weight: 400; letter-spacing: 0; }
.home-actions { display: flex; align-items: center; justify-content: flex-start; flex-wrap: wrap; gap: 24px; margin-top: 44px; }
.home-actions .home-primary { min-height: 52px; min-width: 190px; justify-content: space-between; gap: 22px; padding: 0 22px; font-size: 15px; }
.home-notice, .home-note { color: var(--muted); font-size: 13px; line-height: 1.7; margin-top: 20px; }
.home-aside { border-left: 1px solid var(--line); padding-left: 40px; }
.home-plan-line { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-top: 26px; }
.home-plan-line strong { font-family: var(--font-serif); font-size: 36px; font-weight: 500; line-height: 1; font-variant-numeric: tabular-nums; }
.home-plan-line span, .home-aside-copy { color: var(--muted); font-size: 13px; }
.home-icon-link { display: inline-flex; color: var(--accent); }
.home-aside-copy { margin-top: 12px; line-height: 1.7; }
.home-plan-link { margin-top: 20px; }
.home-plan-details { color: var(--muted); font-size: 13px; margin-top: 12px; }
.home-plan-details summary { cursor: pointer; width: fit-content; }
.home-plan-details p { margin-top: 6px; }
.home-explore { border-top: 1px solid var(--line); margin-top: 42px; padding-top: 30px; }
.home-explore nav { margin-top: 17px; }
.home-explore nav a { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; color: var(--ink); font-size: 14px; }
.home-explore nav a svg { color: var(--muted); transition: transform var(--motion-fast); }
.home-explore nav a:hover svg { transform: translate(3px, -3px); color: var(--accent); }
.home-footer { display: flex; align-items: center; justify-content: space-between; gap: 24px; border-top: 1px solid var(--line); margin-top: 72px; padding-top: 21px; color: var(--muted); font-size: 12px; }
.home-footer div { display: flex; flex-wrap: wrap; gap: 24px; }
.home-footer a { display: inline-flex; align-items: center; gap: 5px; color: var(--accent-strong); font-weight: 600; }
@media (max-width: 760px) {
  .home-today { width: min(100% - 40px, 600px); padding-top: 36px; }
  .home-layout { grid-template-columns: 1fr; gap: 48px; padding-top: 38px; }
  .home-aside { border-left: 0; border-top: 1px solid var(--line); padding: 32px 0 0; }
  .home-explore { margin-top: 32px; padding-top: 25px; }
  .home-explore nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; }
  .home-footer { margin-top: 44px; }
}
@media (max-width: 420px) {
  .home-heading { align-items: start; }
  .home-date { padding-top: 4px; font-size: 12px; }
  .home-focus.today-hero { text-align: left; padding: 0; }
.home-goal-heading { flex-direction: column; gap: 10px; }
  .home-goal-heading > .home-text-link { margin-top: 0; }
  .home-queue { gap: 60px; }
  .home-actions { gap: 18px; }
  .home-footer { align-items: flex-start; flex-direction: column; gap: 12px; }
}
</style>
