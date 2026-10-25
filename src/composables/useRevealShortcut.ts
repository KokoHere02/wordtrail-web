import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue';
import { useStudySurface } from './useStudySurface';

export function useRevealShortcut(reveal: () => unknown, enabled: () => boolean) {
  const surface = useStudySurface();
  let active = true;
  onActivated(() => { active = true; });
  onDeactivated(() => { active = false; });
  function keyboard(event: KeyboardEvent) {
    if (event.key !== 'F2' || event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!active || surface?.active.value === false || !enabled() || document.querySelector('[role="dialog"]')) return;
    const target = event.target instanceof HTMLElement ? event.target : undefined;
    if (target?.closest('[data-composing="true"]')) return;
    // Keep settings/search fields independent from the focused word input.
    if (target?.closest('input,select,textarea,[contenteditable=true]') && !target.closest('.letter-input')) return;
    event.preventDefault();
    void reveal();
  }
  onMounted(() => document.addEventListener('keydown', keyboard));
  onBeforeUnmount(() => document.removeEventListener('keydown', keyboard));
}
