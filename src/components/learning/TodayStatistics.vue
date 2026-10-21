<script setup lang="ts">
import { onMounted } from 'vue';
import { dailyApi } from '../../api/daily';
import { useResource } from '../../composables/useResource';
import type { DailyStatistics } from '../../types/daily';
import StatisticsCards from './StatisticsCards.vue';
import StatePanel from '../ui/StatePanel.vue';
const { data, loading, error, load } = useResource<DailyStatistics>();
const refresh = () => load(() => dailyApi.statistics());
onMounted(refresh);
</script>
<template>
  <section class="today-statistics"><div class="plan-heading"><h2>今日统计 <span v-if="data" class="subtle-copy">{{ data.learningDate }}</span></h2><RouterLink to="/statistics" class="violet-link">查看学习日历</RouterLink></div><StatePanel :loading="loading" :error="error" @retry="refresh" /><StatisticsCards v-if="data && !loading && !error" :statistics="data" /></section>
</template>
