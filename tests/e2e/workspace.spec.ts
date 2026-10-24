import { expect, test } from '@playwright/test';
for (const width of [1440, 390, 320]) for (const theme of ['dark', 'light']) {
  test(`workspace ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    await page.goto('/login'); await page.locator('#username').fill('workspace_visual'); await page.locator('#password').fill('example123'); await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.daily-equation')).toBeVisible();
    await page.evaluate(async () => {
      const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
      const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
      const original = http.defaults.adapter;
      const groups = [{ partOfSpeech: 'adj.', meaning: '丰富的；充裕的' }];
      const task = { batchId: 91, bookId: null, taskType: 'PRACTICE', practiceMode: 'DICTATION', status: 'IN_PROGRESS', totalCount: 10, completedCount: 3, passedCount: 3, needsPracticeCount: 0, attemptCount: 3, nextItemId: 92, attemptLimit: 6, createdAt: '2026-10-24T12:00:00', completedAt: null };
      const progress = { sessionId: 650, selectionSource: 'BANK', status: 'IN_PROGRESS', totalCount: 10, submissionCount: 2, answerCount: 2, revealCount: 0, selfReviewCount: 2, completedCount: 2, understoodCount: 2, partialCount: 0, notUnderstoodCount: 0, nextItemId: 801, createdAt: '2026-10-24T12:00:00', completedAt: null };
      http.defaults.adapter = async (config: { url: string; method: string }) => {
        const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data: structuredClone(data) } });
        if (config.url === '/learning-plan/words') return ok({ page: 1, size: 10, total: 1, records: [{ wordId: 1001, word: 'abundant', phonetic: '/əˈbʌndənt/', translation: '丰富的；充裕的', translationGroups: groups, planStatus: 'ACTIVE', firstLearnedAt: '2026-10-20T12:00:00' }] });
        if (config.url === '/dictation/batches/91') return ok(task);
        if (config.url === '/dictation/batches/91/next') return ok({ itemId: 92, prompt: '丰富的；充裕的', promptGroups: groups, presentationId: 'visual-only', nextAttemptNo: 1, correctStreak: 0, requiredCorrectStreak: 2, attemptLimit: 6 });
        if (config.url === '/sentence-translation/sessions/650') return ok(progress);
        if (config.url === '/sentence-translation/sessions/650/current') return ok({ itemId: 801, sentenceId: 1, status: 'PENDING', englishText: 'I missed the bus.', difficulty: 1, source: '句子题库 · 入门', sourceReference: null, linkedWords: [], attemptId: null, action: null, translation: null, referenceTranslation: null, explanation: null, selfAssessment: null, submittedAt: null, personalNote: { content: '', errorTags: [], attemptId: null, version: 0, updatedAt: null } });
        if (config.url === '/sentence-translation/sessions') return ok({ page: 1, size: 10, total: 1, records: [progress] });
        return original(config);
      };
      await router.push('/dictation/91');
    });
    await expect(page.locator('#dictation-input')).toBeEnabled();
    await page.locator('#dictation-input').fill('abun');
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/workspace-dictation-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('tab', { name: '跟练拼写', exact: true }).click(); await page.getByRole('button', { name: '开始跟练', exact: true }).click(); await expect(page.locator('#guided-spelling-input')).toBeVisible();
    await expect(page.locator('.guided-spelling .letter-slot')).toHaveCount(8); await expect(page.locator('.guided-spelling input[type=text]')).toHaveCount(1);
    await page.locator('#guided-spelling-input').fill('abun'); expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/workspace-guided-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('tab', { name: '单词默写', exact: true }).click(); await expect(page.locator('#dictation-input')).toHaveValue('abun');
    await page.getByRole('tab', { name: '句子翻译', exact: true }).click(); await page.getByRole('link', { name: '继续练习', exact: true }).click(); await expect(page.locator('#sentence-translation')).toBeEnabled();
    await page.locator('#sentence-translation').fill('试着用自己的话翻译这句话。'); expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/workspace-sentence-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('tab', { name: '跟练拼写', exact: true }).click(); await expect(page.locator('#guided-spelling-input')).toHaveValue('abun');
    await page.locator('#guided-spelling-input').fill('abundant'); await page.locator('#guided-spelling-input').press('Enter'); await expect(page.locator('.guided-original')).toHaveCount(0); await expect(page.locator('#guided-spelling-input')).toHaveValue('');
  });
}
