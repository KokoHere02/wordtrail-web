import { computed, ref } from 'vue';
type Theme = 'light' | 'dark';
const theme = ref<Theme>('light');
const storageKey = 'wordtrail.theme';
let initialized = false;
function apply(value: Theme) {
  theme.value = value;
  document.documentElement.dataset.theme = value;
}
export function initializeTheme() {
  if (initialized) return;
  initialized = true;
  let saved: string | null = null;
  try { saved = localStorage.getItem(storageKey); } catch { /* Theme switching also works without storage. */ }
  apply(saved === 'light' || saved === 'dark' ? saved : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
export function useTheme() {
  initializeTheme();
  const isDark = computed(() => theme.value === 'dark');
  function toggleTheme() {
    apply(isDark.value ? 'light' : 'dark');
    try { localStorage.setItem(storageKey, theme.value); } catch { /* Keep the active theme for this session. */ }
  }
  return { theme, isDark, toggleTheme };
}
