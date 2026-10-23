export interface TranslationGroup {
  partOfSpeech: string | null;
  meaning: string;
}
export interface TranslationFields {
  translation?: string | null;
  translationGroups?: readonly TranslationGroup[];
}
