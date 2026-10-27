import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const storageKey = 'wordtrail.study.preferences';
interface Preferences { showChinese: boolean; showPhonetic: boolean; showFollowWord: boolean; showFollowChinese: boolean }

export const useStudyPreferences = defineStore('study-preferences', () => {
  let saved: Partial<Preferences> = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') ?? {}; } catch { /* Use defaults if storage is unavailable. */ }
  const showChinese = ref(typeof saved.showChinese === 'boolean' ? saved.showChinese : true);
  const showPhonetic = ref(typeof saved.showPhonetic === 'boolean' ? saved.showPhonetic : true);
  const showFollowWord = ref(typeof saved.showFollowWord === 'boolean' ? saved.showFollowWord : true);
  const showFollowChinese = ref(typeof saved.showFollowChinese === 'boolean' ? saved.showFollowChinese : true);
  watch([showChinese, showPhonetic, showFollowWord, showFollowChinese], () => {
    try { localStorage.setItem(storageKey, JSON.stringify({ showChinese: showChinese.value, showPhonetic: showPhonetic.value, showFollowWord: showFollowWord.value, showFollowChinese: showFollowChinese.value })); } catch { /* Preferences also work without storage. */ }
  });
  return { showChinese, showPhonetic, showFollowWord, showFollowChinese };
});
