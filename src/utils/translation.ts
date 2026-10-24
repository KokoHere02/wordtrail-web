import type { TranslationFields } from '../types/translation';

// Presence is significant: an explicitly empty groups array must not use the old string.
export function hasTranslation(value: TranslationFields | null | undefined): boolean {
  return !!value && (value.translationGroups !== undefined || value.translation !== undefined);
}
