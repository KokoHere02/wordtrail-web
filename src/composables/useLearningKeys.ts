import { onActivated, onDeactivated, onBeforeUnmount, onMounted } from 'vue';
import { useStudySurface } from './useStudySurface';
import type { Result } from '../types/api';

export function useLearningKeys(actions: {
  reveal: () => unknown; pronounce: () => unknown; rate: (result: Result) => unknown;
  previous: () => unknown; next: () => unknown; correct: () => unknown; cancelCorrection: () => unknown;
}) {
  const surface = useStudySurface();
  let active = true;
  onActivated(() => { active = true; });
  onDeactivated(() => { active = false; });
  function keyboard(event: KeyboardEvent) {
    if (!active || surface && !surface.active.value) return;
    if (event.repeat || event.isComposing || document.querySelector('[role="dialog"]')) return;
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      void actions.pronounce();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof HTMLElement ? event.target : undefined;
    const shortcutOnLearningButton = ['ArrowLeft', 'ArrowRight', '1', '2', '3', 'r', 'R', 'Escape'].includes(event.key)
      && target?.closest('button') && target.closest('.learning-card, .learning-controls, .daily-training-feedback');
    if (target?.closest('input,select,textarea,button,a,summary,[contenteditable=true]') && !shortcutOnLearningButton) return;
    const result = ({ '1': 3, '2': 2, '3': 1 } as const)[event.key as '1' | '2' | '3'];
    if (event.code === 'Space' || event.key === ' ') { event.preventDefault(); void actions.reveal(); }
    else if (event.key.toLowerCase() === 'p') { event.preventDefault(); void actions.pronounce(); }
    else if (event.key.toLowerCase() === 'r') { event.preventDefault(); void actions.correct(); }
    else if (event.key === 'Escape') { event.preventDefault(); void actions.cancelCorrection(); }
    else if (result) { event.preventDefault(); void actions.rate(result); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); void actions.previous(); }
    else if (event.key === 'ArrowRight' || event.key === 'Enter') { event.preventDefault(); void actions.next(); }
  }
  onMounted(() => document.addEventListener('keydown', keyboard));
  onBeforeUnmount(() => document.removeEventListener('keydown', keyboard));
}
