import { expect, test } from '@playwright/test';

for (const width of [1280, 320]) test(`content navigation keeps parent and child selection at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('手机号或邮箱').fill('13800138000');
  await page.getByLabel('密码', { exact: true }).fill('example123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(url => !url.pathname.includes('login'));
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '内容库' }).click();

  const nav = page.getByRole('navigation', { name: '内容库分类' });
  const words = nav.getByRole('group', { name: '单词分类' });
  const kinds = nav.getByRole('group', { name: '内容类型' });
  for (const viewportWidth of [320, 900, 1280, 1600]) {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    const navBox = await nav.boundingBox(), libraryBox = await page.locator('.library-page').boundingBox();
    expect(Math.abs(navBox!.x - libraryBox!.x)).toBeLessThan(1);
    expect(Math.abs(navBox!.width - libraryBox!.width)).toBeLessThan(1);
  }
  await page.setViewportSize({ width, height: 900 });
  const initialNav = await nav.boundingBox();
  async function expectAligned(selector: string) {
    const navBox = await nav.boundingBox(), contentBox = await page.locator(selector).boundingBox();
    expect(Math.abs(navBox!.x - initialNav!.x)).toBeLessThan(1);
    expect(Math.abs(navBox!.width - initialNav!.width)).toBeLessThan(1);
    expect(Math.abs(navBox!.x - contentBox!.x)).toBeLessThan(1);
    expect(Math.abs(navBox!.width - contentBox!.width)).toBeLessThan(1);
  }
  const entries = [['词书', '/books', '.library-page'], ['学习计划', '/plan', '.plan-page'], ['薄弱词', '/weak-words', '.weak-words-page'], ['错词与错因', '/consolidation/words', '.consolidation-page']] as const;
  for (const [label, path, selector] of entries) {
    await words.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(kinds.getByRole('link', { name: '单词' })).toHaveAttribute('aria-current', 'location');
    await expect(words.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(words.getByRole('link')).toHaveCount(4);
    await expectAligned(selector);
    expect(await page.locator('html').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.reload();
  await expect(words.getByRole('link', { name: '错词与错因' })).toHaveAttribute('aria-current', 'page');

  await kinds.getByRole('link', { name: '句子' }).click();
  await expectAligned('.sentence-library-page');
  await expect(kinds.getByRole('link', { name: '句子' })).toHaveAttribute('aria-current', 'location');
  await expect(words).toHaveCount(0);
  const sentenceTabs = page.getByRole('navigation', { name: '句子范围' });
  await expect(sentenceTabs.getByRole('button', { name: '句子库' })).toHaveAttribute('aria-pressed', 'true');
  await sentenceTabs.getByRole('button', { name: '学习列表' }).click();
  await expect(sentenceTabs.getByRole('button', { name: '学习列表' })).toHaveAttribute('aria-pressed', 'true');
  await sentenceTabs.getByRole('button', { name: '收藏' }).click();
  await expect(sentenceTabs.getByRole('button', { name: '收藏' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: '个人笔记' })).toBeVisible();
  expect(await page.locator('html').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole('link', { name: '个人笔记' }).click();
  await expect(nav.getByRole('group', { name: '句子分类' })).toBeVisible();
  await nav.getByRole('link', { name: '学习列表' }).click();
  await expect(sentenceTabs.getByRole('button', { name: '学习列表' })).toHaveAttribute('aria-pressed', 'true');
  await kinds.getByRole('link', { name: '单词' }).click();
  await expect(words.getByRole('link', { name: '词书' })).toHaveAttribute('aria-current', 'page');
  for (const [path, selector] of [['/books/1', '.book-wordlist-page'], ['/words/1004', '.word-detail-page']] as const) {
    await page.evaluate(async path => { const routerPath = '/src/router/index.ts'; const { router } = await import(/* @vite-ignore */ routerPath); await router.push(path); }, path);
    await expect(page.locator(selector)).toBeVisible();
    await expectAligned(selector);
  }
});
