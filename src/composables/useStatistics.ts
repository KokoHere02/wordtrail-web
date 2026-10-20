import { onMounted, ref } from 'vue';
import { dailyApi } from '../api/daily';
import { useResource } from './useResource';
import type { Page } from '../types/api';
import type { DailyStatistics, LearningCalendar, StatisticsWord } from '../types/daily';

function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function useStatistics(initialDate?: string) {
  const daily = useResource<DailyStatistics>();
  const calendar = useResource<LearningCalendar>();
  const words = useResource<Page<StatisticsWord>>();
  const selectedDate = ref('');
  const dateInput = ref('');
  const monthInput = ref('');
  const inputError = ref('');
  const page = ref(1);
  const size = 15;
  let dateGeneration = 0;
  function loadWords() {
    if (!selectedDate.value) return;
    const date = selectedDate.value;
    return words.load(() => dailyApi.statisticsWords({ date, page: page.value, size }));
  }
  async function selectDate(date?: string) {
    const current = ++dateGeneration;
    selectedDate.value = date || '';
    dateInput.value = date || '';
    words.data.value = undefined;
    await daily.load(() => dailyApi.statistics(date));
    if (current !== dateGeneration || !daily.data.value) return;
    selectedDate.value = daily.data.value.learningDate;
    dateInput.value = selectedDate.value;
    page.value = 1;
    await loadWords();
  }
  async function loadMonth(month?: string) {
    await calendar.load(() => dailyApi.calendar(month));
    if (calendar.data.value) monthInput.value = calendar.data.value.month;
  }
  function changeMonth(amount: number) {
    const month = calendar.data.value?.month;
    if (!month) return;
    const [year, index] = month.split('-').map(Number);
    const absolute = year! * 12 + index! - 1 + amount;
    const nextYear = Math.floor(absolute / 12);
    if (nextYear < 1000 || nextYear > 9999) return;
    void loadMonth(`${nextYear}-${String(absolute % 12 + 1).padStart(2, '0')}`);
  }
  function applyDate() {
    inputError.value = '';
    const value = dateInput.value;
    if (!validDate(value)) { inputError.value = '请选择 1000～9999 年内的有效日期。'; return; }
    void selectDate(value);
  }
  function applyMonth() {
    inputError.value = '';
    if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(monthInput.value)) { inputError.value = '请选择 1000～9999 年内的有效月份。'; return; }
    void loadMonth(monthInput.value);
  }
  function changePage(value: number) { page.value = value; void loadWords(); }
  onMounted(() => {
    const date = initialDate && validDate(initialDate) ? initialDate : undefined;
    if (initialDate && !date) inputError.value = '链接中的日期无效，已查询服务端今日。';
    void selectDate(date); void loadMonth(date?.slice(0, 7));
  });
  return { daily, calendar, words, selectedDate, dateInput, monthInput, inputError, page, size, selectDate, loadMonth, changeMonth, applyDate, applyMonth, loadWords, changePage };
}
