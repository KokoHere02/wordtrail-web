import { expect, test } from '@playwright/test';

for (const width of [1440, 320]) {
  test(`random selection can be reviewed at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await page.locator('#username').fill(`random_${width}`);
    await page.locator('#password').fill('example123');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.daily-equation')).toBeVisible();
    await page.goto('/books/1');
    await page.getByRole('button', { name: '随机选词' }).click();
    const dialog = page.getByRole('dialog', { name: '随机挑选单词' });
    await expect(dialog.locator('.random-word').first()).toBeVisible();
    await dialog.locator('#random-word-count').fill('2');
    await dialog.getByRole('button', { name: '重新挑选' }).click();
    await expect(dialog.locator('.random-word')).toHaveCount(2);
    expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.locator('.random-word input').first().uncheck();
    await dialog.getByRole('button', { name: '确认选择 1 词' }).click();
    await expect(page.locator('.selected-count')).toContainText('1');
    await page.getByRole('button', { name: '加入学习计划' }).click();
    await expect(page.locator('.live-notice')).toContainText('新增 1 词');
  });
}
