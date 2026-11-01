import { defineConfig } from '@playwright/test';
import reviewConfig from './playwright.review.config';
export default defineConfig({ ...reviewConfig, testMatch: 'sentence-learning.spec.ts' });
