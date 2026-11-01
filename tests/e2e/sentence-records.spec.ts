import { expect, test } from '@playwright/test';

test('sentence records show both translations without a detail dialog', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#username').fill('sentence_records_reader');
  await page.locator('#password').fill('example123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.daily-equation')).toBeVisible();
  await page.evaluate(async () => {
    const { http } = await import(/* @vite-ignore */ '/src/api/http.ts');
    const { router } = await import(/* @vite-ignore */ '/src/router/index.ts');
    const fallback = http.defaults.adapter;
    http.defaults.adapter = async (config: { url: string }) => {
      if (config.url === '/sentence-practice/records') return { config, status: 200, headers: {}, data: { code: 'OK', data: { page: 1, size: 20, total: 1, records: [{ id: 1, sentenceId: 1, englishText: 'An example sentence.', translation: '我的译文', referenceTranslation: '参考译文', explanation: '解析', createdAt: '2026-11-01T12:00:00' }] } } };
      return fallback(config);
    };
    await router.push('/records?type=SENTENCE');
  });
  const row = page.locator('.sentence-record-row');
  await expect(row).toContainText('An example sentence.');
  await expect(row.locator('.sentence-record-translation')).toHaveText('我的翻译：我的译文');
  await expect(row.locator('.sentence-record-reference')).toHaveText('参考翻译：参考译文');
  expect(await row.locator('.sentence-record-translation').evaluate(el => getComputedStyle(el).color)).not.toBe(await row.locator('.sentence-record-reference').evaluate(el => getComputedStyle(el).color));
  await expect(row.getByRole('button', { name: '查看详情' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(row.locator('.sentence-record-reference')).toBeVisible();
  expect(await page.locator('html').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
});
