import { inject, type ComputedRef, type InjectionKey } from 'vue';
export type StudyMode = 'recognition' | 'dictation' | 'spelling' | 'listen' | 'sentences';
export interface StudySurfaceState { source: string; completed: number; total: number; remaining: number; noun: string; settings: boolean }
export interface StudySurface { active: ComputedRef<boolean>; state: StudySurfaceState }
export const studySurfaceKey: InjectionKey<StudySurface> = Symbol('study-surface');
export const useStudySurface = () => inject(studySurfaceKey, undefined);
