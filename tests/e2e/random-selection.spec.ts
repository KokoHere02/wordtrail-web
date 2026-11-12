import { expect, test } from '@playwright/test';

test('random sentences can be reviewed, retained across pages, and added in one batch', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#account').fill('13800138000');
  await page.locator('#password').fill('example123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.daily-equation')).toBeVisible();
  await page.evaluate(async () => {
    const { http } = await import(/* @vite-ignore */ '/src/api/http.ts');
    const { router } = await import(/* @vite-ignore */ '/src/router/index.ts');
    const fallback = http.defaults.adapter;
    const rows = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, englishText: `Sentence ${i + 1}`, referenceTranslation: `译文 ${i + 1}`, learning: false, favorite: false, available: true, tags: [] }));
    http.defaults.adapter = async (config: { url: string; method: string; params?: Record<string, string>; data?: string }) => {
      const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', data: structuredClone(data) } });
      if (config.url === '/sentence-practice/tags') return ok([]);
      if (config.url === '/sentence-translation/management/access') return ok({ canManage: false });
      if (config.url === '/sentence-practice/sentences/random') return ok(rows.slice(0, Number(config.params?.count)));
      if (config.url === '/sentence-practice/sentences') { const offset = Number(config.params?.offset || 0); return ok(rows.slice(offset, offset + 50)); }
      if (config.url === '/sentence-practice/learning/batch') { const ids = JSON.parse(config.data || '{}').sentenceIds as number[]; Reflect.set(window, '__batchIds', ids); return ok(ids.length); }
      return fallback(config);
    };
    await router.push('/sentences');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '随机选句' }).click();
  const dialog = page.getByRole('dialog', { name: '随机挑选句子' });
  await expect(dialog.locator('.random-sentence')).toHaveCount(100);
  await expect(dialog.locator('#random-sentence-count')).toHaveValue('100');
  await dialog.locator('.random-sentence input').first().uncheck();
  await dialog.getByRole('button', { name: '确认选择 99 句' }).click();
  await expect(page.locator('.selection-summary')).toContainText('已选择 99 句');
  await page.getByRole('button', { name: '下一页' }).click();
  await expect(page.locator('.selection-summary')).toContainText('已选择 99 句');
  expect(await page.locator('html').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '将所选句子加入学习列表（99）' }).click();
  await expect(page.locator('.selection-summary')).toContainText('新增 99 句');
  expect(await page.evaluate(() => Reflect.get(window, '__batchIds').length)).toBe(99);
});
