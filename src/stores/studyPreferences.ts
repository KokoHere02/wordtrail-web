import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const storageKey = 'wordtrail.study.preferences';
interface Preferences { showChinese: boolean; showPhonetic: boolean; autoPronounce: boolean; accent: 'en-US' | 'en-GB' }

export const useStudyPreferences = defineStore('study-preferences', () => {
  let saved: Partial<Preferences> = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') ?? {}; } catch { /* Use defaults if storage is unavailable. */ }
  const showChinese = ref(typeof saved.showChinese === 'boolean' ? saved.showChinese : true);
  const showPhonetic = ref(typeof saved.showPhonetic === 'boolean' ? saved.showPhonetic : true);
  const autoPronounce = ref(saved.autoPronounce === true);
  const accent = ref<Preferences['accent']>(saved.accent === 'en-GB' ? 'en-GB' : 'en-US');
  watch([showChinese, showPhonetic, autoPronounce, accent], () => {
    try { localStorage.setItem(storageKey, JSON.stringify({ showChinese: showChinese.value, showPhonetic: showPhonetic.value, autoPronounce: autoPronounce.value, accent: accent.value })); } catch { /* Preferences also work without storage. */ }
  });
  return { showChinese, showPhonetic, autoPronounce, accent };
});
