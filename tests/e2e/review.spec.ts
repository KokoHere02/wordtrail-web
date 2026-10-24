import { expect, test } from '@playwright/test';
import type { TranslationGroup } from '../../src/types/translation';
const cases: { key: string; word: string; phonetic: string | null; translation: string; groups?: TranslationGroup[] }[] = [
  { key: 'short', word: 'state', phonetic: '/steɪt/', translation: 'n. 状态', groups: [{ partOfSpeech: 'n.', meaning: '状态' }] },
  { key: 'multiple', word: 'state', phonetic: '/steɪt/', translation: '旧字段', groups: [{ partOfSpeech: 'n.', meaning: '州；状态；情形；国家；状况；国事；身份；处境' }, { partOfSpeech: 'a.', meaning: '国家的；正式的；礼仪用的；州的' }, { partOfSpeech: 'vt. & vi.', meaning: '说明；陈述；规定' }, { partOfSpeech: null, meaning: '[计] 状态；状态变量；有限状态机' }] },
  { key: 'long', word: 'pneumonoultramicroscopicsilicovolcanoconiosis', phonetic: null, translation: 'n. ' + '未截断的超长释义与括号说明（e.g. U.S.A. 3.14, original meaning）'.repeat(12) },
  { key: 'legacy', word: 'state', phonetic: null, translation: 'n. 州；状态；情形；国家；身份\\na. 国家的\\nvt. 说明 vi. 陈述\\n[计] 状态' },
  { key: 'fallback', word: 'unknown', phonetic: null, translation: 'xyz. 未识别格式，保留完整原文。e.g. U.S.A. 3.14' },
];
for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark'] as const) {
  test(`learning ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    await page.goto('/login');
    await page.locator('#username').fill('review_visual');
    await page.locator('#password').fill('example123');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.daily-equation')).toBeVisible();
    const dailyBatchId = await page.evaluate(async () => {
      const modulePath = '/src/api/daily.ts';
      const { dailyApi } = await import(/* @vite-ignore */ modulePath);
      await dailyApi.join(1, [1001, 1002]);
      const task = await dailyApi.start();
      const item = await dailyApi.item(task.batchId, task.nextItemId);
      await dailyApi.answer(task.batchId, item.itemId, { result: 2, attemptNo: item.nextAttemptNo, requestId: crypto.randomUUID() });
      return task.batchId;
    });
    await page.goto(`/learn/${dailyBatchId}`);
    await expect(page.locator('.learning-card h1')).toHaveText('absorb');
    await expect(page.locator('.learning-rating button').first()).toBeEnabled();
    await expect(page.locator('.site-header .main-nav')).toHaveCount(1);
    await expect(page.locator('.main-nav a.active')).toHaveText('学习');
    await expect(page.locator('.review-progress-count')).toContainText('剩余 2 词');
    await expect(page.locator('.memory-meaning')).toHaveCount(0);
    await page.getByRole('button', { name: '点击或按 Space 查看释义' }).click();
    await expect(page.locator('.memory-meaning')).toBeVisible();
    await page.getByRole('button', { name: '认识', exact: true }).click();
    await expect(page.getByRole('button', { name: '下一词', exact: true })).toBeEnabled();
    await expect(page.locator('.learning-card h1')).toHaveText('absorb');
    await expect(page.locator('.memory-meaning')).toBeVisible();
    await page.keyboard.press('r');
    await expect(page.getByRole('group', { name: '更正本次反馈', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('group', { name: '更正本次反馈', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '记错了', exact: true }).focus();
    await page.keyboard.press('r');
    await page.keyboard.press('2');
    await expect(page.locator('.recall-uncertain')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.learning-card h1')).toHaveText('absorb');
    await expect(page.locator('.memory-meaning')).toBeVisible();
    // Arrow navigation also works after a mouse click leaves focus on a rating control.
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.learning-card h1')).toHaveText('abandon');
    await expect(page.locator('.learning-rating button').first()).toBeEnabled();
    await expect(page.locator('.memory-meaning')).toHaveCount(0);
    await page.getByRole('button', { name: '上一词', exact: true }).click();
    await expect(page.locator('.learning-card h1')).toHaveText('absorb');
    await expect(page.locator('.learning-rating button').first()).toBeDisabled();
    await page.getByRole('button', { name: '下一词', exact: true }).click();
    await expect(page.locator('.learning-card h1')).toHaveText('abandon');
    await expect(page.locator('.memory-meaning')).toHaveCount(0);
    expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/learning-daily-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    for (const fixture of cases) {
      await page.evaluate(async data => {
        const apiPath = '/src/api/index.ts';
        const httpPath = '/src/api/http.ts';
        const routerPath = '/src/router/index.ts';
        const { api } = await import(/* @vite-ignore */ apiPath);
        const { http } = await import(/* @vite-ignore */ httpPath);
        const { router } = await import(/* @vite-ignore */ routerPath);
        const batch = await api.create({ bookId: 1, selectionType: 'MANUAL', wordIds: [1001] });
        const key = 'wordtrail.mock.review_visual';
        const state = JSON.parse(localStorage.getItem(key)!);
        const item = state.batches.find((entry: { id: number }) => entry.id === batch.batchId).items[0];
        item.word = data.word; item.phonetic = data.phonetic; item.meaning = data.translation;
        if (data.groups !== undefined) item.translationGroups = data.groups; else delete item.translationGroups;
        localStorage.setItem(key, JSON.stringify(state));
        // Explicit fixture: dictionary GET and the batch snapshot represent the same test word.
        const adapter = http.defaults.adapter;
        http.defaults.adapter = async (config: { url: string }) => {
          const response = await adapter(config);
          if (config.url === '/words/1001') {
            const word = response.data.data;
            word.word = data.word; word.phonetic = data.phonetic; word.translation = data.translation;
            if (data.groups !== undefined) word.translationGroups = data.groups; else delete word.translationGroups;
          }
          return response;
        };
        await router.push(`/study/${batch.batchId}`);
      }, fixture);
      await expect(page.locator('.study-word')).toHaveText(fixture.word);
      await expect(page.locator('.learning-rating button').first()).toBeEnabled();
      await expect(page.locator('.study-meaning')).toHaveCount(0);
      const buttons = page.locator('.learning-rating button');
      for (const button of await buttons.all()) await expect(button).toHaveAttribute('aria-pressed', 'false');
      const styles = await buttons.evaluateAll(elements => elements.map(element => {
        const style = getComputedStyle(element);
        return [style.backgroundColor, style.borderColor, style.color].join('|');
      }));
      expect(new Set(styles).size).toBe(1);
      await expect(page.locator('.site-header .main-nav')).toHaveCount(1);
      await expect(page.locator('.main-nav a.active')).toHaveText('学习');
      expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
      if (fixture.key === 'short') await page.screenshot({ path: `docs/screenshots/learning-hidden-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      await page.keyboard.press('Space');
      await expect(page.locator('.study-meaning')).toBeVisible();
      await expect(page.locator('.learning-progress [role="progressbar"]')).toHaveAttribute('aria-valuenow', '0');
      await expect(page.locator('.review-example')).toHaveCount(0);
      for (const button of await buttons.all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      if (fixture.key === 'multiple') {
        await expect(page.locator('.translation-more')).toHaveText('另有 4 项释义');
        await page.getByRole('button', { name: '展开完整释义', exact: true }).click();
        await expect(page.locator('.translation-professional .translation-meaning')).toBeVisible();
        await page.getByRole('button', { name: '收起释义', exact: true }).click();
      }
      await page.getByRole('button', { name: '认识', exact: true }).click();
      await expect(page.getByRole('button', { name: '完成本轮', exact: true })).toBeEnabled();
      await expect(page.locator('.learning-progress [role="progressbar"]')).toHaveAttribute('aria-valuenow', '1');
      expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
      const toggle = page.locator('.appearance-button');
      await toggle.click(); await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'light' ? 'dark' : 'light');
      await toggle.click(); await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.screenshot({ path: `docs/screenshots/learning-answer-${fixture.key}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    }
  });
}
