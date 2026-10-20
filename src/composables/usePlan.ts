import { computed, onMounted, ref, watch } from 'vue';
import { dailyApi } from '../api/daily';
import { errorMessage } from '../api/http';
import { useResource } from './useResource';
import { useSelection } from './useSelection';
import type { Page } from '../types/api';
import type { PlanWord, PlanStatus, PlanLearningStatus } from '../types/daily';

export function usePlan() {
  const resource = useResource<Page<PlanWord>>();
  const selection = useSelection();
  const status = ref<PlanStatus>('ACTIVE');
  const learningStatus = ref<PlanLearningStatus>('ALL');
  const keyword = ref('');
  const appliedKeyword = ref('');
  const sortOptions = [
    { value: 'joined_desc', label: '最近加入', sortBy: 'joined_at', direction: 'DESC' },
    { value: 'joined_asc', label: '最早加入', sortBy: 'joined_at', direction: 'ASC' },
    { value: 'review_asc', label: '最早到期', sortBy: 'next_review_at', direction: 'ASC' },
    { value: 'review_desc', label: '最晚到期', sortBy: 'next_review_at', direction: 'DESC' },
  ] as const;
  const sort = ref<string>('joined_desc');
  const page = ref(1);
  const size = 15;
  const busy = ref(false);
  const saveError = ref('');
  const notice = ref('');
  const pageIds = computed(() => resource.data.value?.records.map(word => word.wordId) || []);
  const pageSelected = computed(() => pageIds.value.length > 0 && pageIds.value.every(id => selection.selected.value.has(id)));
  function refresh() {
    const order = sortOptions.find(option => option.value === sort.value) || sortOptions[0];
    return resource.load(() => dailyApi.plan({ page: page.value, size, status: status.value, learningStatus: learningStatus.value, keyword: appliedKeyword.value || undefined, sortBy: order.sortBy, direction: order.direction }));
  }
  function resetPage() { if (page.value !== 1) page.value = 1; else void refresh(); }
  function search() { appliedKeyword.value = keyword.value.trim(); resetPage(); }
  watch(status, () => { selection.clear(); notice.value = ''; resetPage(); });
  watch([learningStatus, sort], resetPage);
  watch(page, refresh);
  onMounted(refresh);
  async function change(ids: number[], target: PlanStatus, bulk = false): Promise<boolean> {
    if (busy.value || !ids.length || ids.length > 100) return false;
    busy.value = true; saveError.value = ''; notice.value = '';
    try {
      if (bulk) {
        const result = await dailyApi.updatePlanStatus(ids, target);
        notice.value = `请求 ${result.requestedCount} 词，变更 ${result.changedCount} 词，原状态相同 ${result.unchangedCount} 词。`;
      } else { await dailyApi.updatePlan(ids[0]!, target); notice.value = '计划已更新。'; }
      notice.value += '暂停或移出同步跳过今日明细；只有进行中的今日任务可恢复跳过前状态，已结束任务不会重开。';
      selection.clear();
      await refresh();
      return true;
    } catch (e) { saveError.value = `${errorMessage(e)}；选择已保留，请重新加载核对状态后重试。`; return false; }
    finally { busy.value = false; }
  }
  return { ...resource, ...selection, status, learningStatus, keyword, sortOptions, sort, page, size, busy, saveError, notice, pageIds, pageSelected, refresh, search, change };
}
