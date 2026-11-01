import { defineConfig } from '@playwright/test';
import reviewConfig from './playwright.review.config';

export default defineConfig({ ...reviewConfig, testMatch: ['sentence-tags.spec.ts', 'sentence-records.spec.ts'] });
