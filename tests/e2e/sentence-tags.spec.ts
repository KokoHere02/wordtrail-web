import { expect, test } from '@playwright/test';

test('sentence tag filter supports keyboard, rapid changes and mobile', async ({ page }, testInfo) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#username').fill('tag_filter_reader');
  await page.locator('#password').fill('example123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.daily-equation')).toBeVisible();
  await page.evaluate(async () => {
    const { http } = await import(/* @vite-ignore */ '/src/api/http.ts');
    const { router } = await import(/* @vite-ignore */ '/src/router/index.ts');
    const fallback = http.defaults.adapter;
    const tags = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, category: i < 7 ? '语法知识' : i < 11 ? '话题与场景' : '交际功能', name: `标签 ${i + 1}` }));
    http.defaults.adapter = async (config: { url: string; params?: Record<string, string> }) => {
      const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', data } });
      if (config.url === '/sentence-practice/tags') return ok(tags);
      if (config.url === '/sentence-translation/management/access') return ok({ canManage: false });
      if (config.url === '/sentence-practice/sentences') {
        const tag = String(config.params?.tagId || '');
        if (tag === '1') await new Promise(resolve => setTimeout(resolve, 350));
        if (tag === '2') await new Promise(resolve => setTimeout(resolve, 20));
        return ok([{ id: 1, englishText: `Result ${tag || 'all'}`, referenceTranslation: '参考翻译', explanation: null, source: 'test', sourceReference: null, learning: false, favorite: false, available: true, tags: [tags[0], tags[8], tags[12]] }]);
      }
      return fallback(config);
    };
    await router.push('/sentences');
  });

  await expect(page.getByRole('list', { name: '句子标签' }).getByRole('listitem')).toHaveText(['标签 1', '标签 9', '标签 13']);
  const filter = page.getByRole('combobox', { name: /筛选标签/ });
  await expect(filter).toContainText('全部标签');
  await filter.click();
  await expect(page.getByRole('option')).toHaveCount(15);
  await expect(page.locator('.app-select-group')).toHaveText(['语法知识', '话题与场景', '交际功能']);
  await page.getByRole('option', { name: '标签 14', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('option', { name: '标签 14', exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: '搜索标签' });
  await search.fill('标签 10');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.locator('.app-select-group')).toHaveText(['话题与场景']);
  await search.fill('不存在');
  await expect(page.getByText('没有找到匹配的标签')).toBeVisible();
  await search.fill('');
  await page.screenshot({ path: testInfo.outputPath('tag-filter-desktop.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '切换浅色主题' }).click();
  await filter.click();
  await page.screenshot({ path: testInfo.outputPath('tag-filter-light.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '切换深色主题' }).click();
  await filter.click();
  await page.getByRole('option', { name: '标签 1', exact: true }).click();
  await filter.click();
  await page.getByRole('option', { name: '标签 2', exact: true }).click();
  await expect(page.getByText('Result 2')).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByText('Result 2')).toBeVisible();

  await filter.focus();
  await page.keyboard.press('ArrowDown');
  await filter.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(filter).toContainText('全部标签');
  await expect(page.getByText('Result all')).toBeVisible();

  await page.setViewportSize({ width: 320, height: 720 });
  await filter.click();
  await expect(page.getByRole('option', { name: '标签 1', exact: true })).toBeVisible();
  expect(await page.locator('html').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('tag-filter-mobile.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(filter).toHaveAttribute('aria-expanded', 'false');
});
