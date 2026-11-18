import { defineConfig } from '@playwright/test';
import reviewConfig from './playwright.review.config';

export default defineConfig({ ...reviewConfig, testMatch: ['content-navigation.spec.ts', 'word-detail.spec.ts'] });
