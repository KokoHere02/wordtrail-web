import { expect, test } from '@playwright/test';
for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`learning links ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    await page.goto('/login'); await page.locator('#username').fill('links_visual'); await page.locator('#password').fill('example123'); await page.locator('#device-name').fill('自定义测试设备'); await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.daily-equation')).toBeVisible();
    await page.evaluate(async () => {
      const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
      const { http } = await import(/* @vite-ignore */ httpPath);
      const { router } = await import(/* @vite-ignore */ routerPath);
      const fallback = http.defaults.adapter;
      const note = { content: '先核对否定范围，再看时态。\n'.repeat(8), errorTags: ['NEGATION', 'TENSE'], attemptId: null, version: 5, updatedAt: '2026-10-24T12:00:00' };
      const progress = { sessionId: 650, selectionSource: 'BANK', status: 'IN_PROGRESS', totalCount: 2, submissionCount: 0, answerCount: 0, revealCount: 0, selfReviewCount: 0, completedCount: 0, understoodCount: 0, partialCount: 0, notUnderstoodCount: 0, nextItemId: 850, createdAt: '2026-10-24T12:00:00', completedAt: null };
      http.defaults.adapter = async (config: { url: string; method: string; params?: { page: number; size: number } }) => {
        const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data: structuredClone(data) } });
        const records = (items: unknown[]) => ok({ page: 1, size: 10, total: items.length, records: items });
        if (config.url === '/auth/sessions') return records([{ sessionId: '000000000000000000000000000000ab', deviceName: '我的自定义设备名称（工作电脑）', current: true, createdAt: '2026-10-24T01:00:00', lastRefreshedAt: '2026-10-24T02:00:00Z', expiresAt: '2026-11-24T01:00:00' }]);
        if (config.url.endsWith('/management/access')) return ok({ canManage: false });
        if (config.url === '/sentence-translation/notes') return records([{ sentenceId: 1, englishText: 'Although the journey was longer than expected, she continued to read every day.', available: false, note }]);
        if (config.url.endsWith('/questions/1/note')) return ok(note);
        if (config.url === '/sentence-translation/sessions/650') return ok(progress);
        if (config.url === '/sentence-translation/sessions/650/current') return ok({ itemId: 850, sentenceId: 1, status: 'PENDING', englishText: 'Although the journey was longer than expected, she continued to read every day.', difficulty: 2, source: '原创', sourceReference: null, linkedWords: [{ wordId: 1001, word: 'abandon' }], personalNote: note, attemptId: null, action: null, translation: null, referenceTranslation: null, explanation: null, selfAssessment: null, submittedAt: null });
        if (/^\/words\/\d+\/sentences$/.test(config.url)) return records([{ sentenceId: 1, englishText: 'Although the journey was longer than expected, she continued to read every day.', difficulty: 2, source: '原创', sourceReference: null, favorite: false }]);
        return fallback(config);
      };
      await router.push('/settings/security');
    });
    for (const [path, selector, name] of [ ['/settings/security', '.account-device-row', 'security'], ['/words/1001', '.word-sentence-row', 'word-links'], ['/sentences/notes', '.sentence-note-row', 'notes'], ['/sentences/sessions/650', '#sentence-translation', 'study-note'] ]) {
      await page.evaluate(async target => { const path = '/src/router/index.ts'; const { router } = await import(/* @vite-ignore */ path); await router.push(target); }, path!);
      await expect(page.locator(selector!)).toBeVisible();
      expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `docs/screenshots/links-${name}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    }
    await expect(page.locator('.sentence-reference')).toHaveCount(0);
    await page.getByRole('button', { name: '编辑笔记', exact: true }).click(); await expect(page.locator('#sentence-note-1')).toBeVisible();
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/links-note-editor-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
  });
}
