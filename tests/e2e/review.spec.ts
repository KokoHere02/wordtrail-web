import { expect, test } from '@playwright/test';

for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`retired recognition links ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    await page.goto('/login?redirect=/study/900');
    await page.locator('#username').fill('retired_browser');
    await page.locator('#password').fill('example123');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.getByRole('heading', { name: '独立认读专项已下线' })).toBeVisible();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluate(async () => {
      const apiPath = '/src/api/index.ts', dailyPath = '/src/api/daily.ts', httpPath = '/src/api/http.ts';
      const { api } = await import(/* @vite-ignore */ apiPath);
      const { dailyApi } = await import(/* @vite-ignore */ dailyPath);
      const { http } = await import(/* @vite-ignore */ httpPath);
      await dailyApi.join(1, [1001]);
      // A valid task already exists: old links must neither resume it nor change it.
      const task = await dailyApi.start();
      const words = (await api.words(1, { page: 1, size: 1, learningStatus: 'ALL' })).records;
      const fixturePath = '/tests/helpers/legacy-practice.mjs';
      const { seedHistoricalPractice } = await import(/* @vite-ignore */ fixturePath);
      seedHistoricalPractice(localStorage, 'retired_browser', words);
      const adapter = http.defaults.adapter;
      Object.assign(window, { retirementCalls: [], dailyBefore: task, archivedBefore: localStorage.getItem('wordtrail.mock.retired_browser') });
      http.defaults.adapter = async (config: { method: string; url: string }) => {
        (window as any).retirementCalls.push(`${config.method} ${config.url}`);
        return adapter(config);
      };
    });
    for (const path of ['/learning', '/study/900', '/learning/900/result', '/study/900/items/900001']) {
      await page.evaluate(async value => { const modulePath = '/src/router/index.ts'; const { router } = await import(/* @vite-ignore */ modulePath); await router.push(value); }, path);
      await expect(page.locator('.retired-practice')).toBeVisible();
      await expect(page.locator('.learning-card, .practice-result-page')).toHaveCount(0);
      expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
    }
    expect(await page.evaluate(() => (window as any).retirementCalls)).toEqual([]);
    await page.reload();
    await expect(page.locator('.retired-practice')).toBeVisible();
    await page.getByRole('link', { name: '历史认读统计', exact: true }).click();
    await expect(page.locator('.insights-summary-heading')).toContainText('历史认读专项');
    await expect(page.locator('.insights-practice-note')).toContainText('历史');
    await expect(page.locator('a[href="/learning"]')).toHaveCount(0);
    await page.goto('/weak-words');
    await page.getByRole('button', { name: '历史认读专项', exact: true }).click();
    await expect(page.locator('.weak-word-row')).toHaveCount(1);
    await expect(page.locator('.weak-selection-footer, .practice-launch-notice')).toHaveCount(0);
    await page.getByRole('button', { name: '学习历史', exact: true }).click();
    await expect(page.locator('.history-group')).toContainText('历史认读专项');
    await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
    await page.goto('/books/1');
    await expect(page.locator('.preview-word-row')).toHaveCount(10);
    await expect(page.locator('.live-practice-options')).toHaveCount(0);
    const intact = await page.evaluate(async () => {
      const dailyPath = '/src/api/daily.ts'; const { dailyApi } = await import(/* @vite-ignore */ dailyPath);
      const daily = await dailyApi.today();
      return { completed: daily.task.completedCount, answers: daily.task.answerCount, archive: JSON.parse(localStorage.getItem('wordtrail.mock.retired_browser')!).events.length };
    });
    expect(intact).toEqual({ completed: 0, answers: 0, archive: 1 });
    expect(errors).toEqual([]);
  });
}
