import { expect, test } from '@playwright/test';

for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`dictation ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    await page.goto('/login');
    await page.locator('#username').fill('dictation_visual');
    await page.locator('#password').fill('example123');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.daily-equation')).toBeVisible();
    await page.evaluate(async () => {
      const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
      const { http } = await import(/* @vite-ignore */ httpPath);
      const { router } = await import(/* @vite-ignore */ routerPath);
      const original = http.defaults.adapter;
      const task = { batchId: 90001, bookId: null, taskType: 'PRACTICE', practiceMode: 'DICTATION', status: 'IN_PROGRESS', totalCount: 1, completedCount: 0, passedCount: 0, needsPracticeCount: 0, attemptCount: 0, nextItemId: 11 as number | null, attemptLimit: 6, createdAt: '2026-10-24T09:00:00', completedAt: null as string | null };
      const promptGroups = [{ partOfSpeech: 'v.', meaning: '放弃；舍弃；中止某事；停止做某事；不再保留或继续。较长的释义在窄屏自然换行，完整保留后端提示。' }];
      const planQueries: unknown[] = [];
      Reflect.set(window, '__dictationPlanQueries', planQueries);
      let step = 0;
      // Canned server outcomes, not a client judge. Only this browser test installs these fixtures.
      http.defaults.adapter = async (config: { url: string; method: string; data?: string; params?: { page: number; size: number } }) => {
        const body = config.data ? JSON.parse(config.data) : undefined;
        const ok = (data: unknown, status = 200) => ({ config, status, headers: {}, data: { code: 'OK', message: '成功', data: structuredClone(data) } });
        if (config.url === '/learning-plan/words' && config.method === 'get') { planQueries.push(structuredClone(config.params)); return ok({ page: 1, size: 10, total: 1, records: [{ wordId: 1001, word: 'abandon', translation: 'v. 放弃', translationGroups: promptGroups, planStatus: 'ACTIVE', firstLearnedAt: '2026-01-01T00:00:00', lastLearnedAt: '2026-10-23T00:00:00' }] }); }
        if (!config.url.startsWith('/dictation/')) return original(config);
        if (config.url === '/dictation/batches' && config.method === 'post') return ok(task, 201);
        if (config.url === '/dictation/batches') return ok({ page: 1, size: 8, total: 2, records: [{ ...task, batchId: 89999, totalCount: 12, completedCount: 3, attemptCount: 5 }, { ...task, batchId: 89998, status: 'COMPLETED', totalCount: 8, completedCount: 8, nextItemId: null }] });
        if (config.url === '/dictation/mistakes') return ok({ page: 1, size: 10, total: 0, records: [] });
        if (config.url === '/dictation/batches/90001') return ok(task);
        if (config.url.endsWith('/next')) {
          if (document.querySelector('.dictation-expected') || (document.querySelector('#dictation-input') as HTMLInputElement | null)?.value) throw new Error('Previous answer/input visible when next was requested');
          return ok({ itemId: 11, prompt: 'v. 放弃', promptGroups, presentationId: `server-presentation-${step}`, nextAttemptNo: step + 1, correctStreak: step === 2 ? 1 : 0, requiredCorrectStreak: step ? 2 : 1, attemptLimit: 6 });
        }
        if (config.url.endsWith('/answer')) {
          if (body.presentationId !== `server-presentation-${step}` || body.attemptNo !== step + 1) throw new Error('Wrong server issuance fields');
          const current = ++step;
          const done = current === 3;
          Object.assign(task, { completedCount: done ? 1 : 0, passedCount: done ? 1 : 0, attemptCount: current, nextItemId: done ? null : 11, status: done ? 'COMPLETED' : 'IN_PROGRESS', completedAt: done ? '2026-10-24T10:00:00' : null });
          return ok({ logId: current, itemId: 11, action: body.action, submittedAnswer: body.input ?? null, expectedWord: 'abandon', translation: 'v. 放弃', translationGroups: promptGroups, verdict: current === 1 ? 'REVEALED' : 'CORRECT', attemptNo: current, correctStreak: current - 1, itemStatus: done ? 'DONE' : 'RELEARNING', completionReason: done ? 'RECALLED' : null, answeredAt: '2026-10-24T10:00:00', affectsSchedule: false, progress: task });
        }
        if (config.url.endsWith('/result/words')) return ok({ page: 1, size: 10, total: 1, records: [{ itemId: 11, wordId: 1001, word: 'abandon', translation: 'v. 放弃', translationGroups: promptGroups, lastVerdict: 'CORRECT', lastInput: 'abandon', attemptCount: 3, correctStreak: 2, learningStatus: 'DONE', completionReason: 'RECALLED', learningDate: '2026-10-24', answeredAt: '2026-10-24T10:00:00' }] });
        throw new Error(`Unexpected fixture endpoint ${config.url}`);
      };
      await router.push('/dictation');
    });
    await expect(page.getByRole('group', { name: '内容范围', exact: true })).toBeVisible();
    await expect(page.locator('.dictation-picker select')).toHaveCount(0);
    await expect(page.getByText('根据释义，写出英文', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '继续默写', exact: true })).toBeVisible();
    await expect(page.locator('.dictation-task-row h3')).toContainText('单词默写 · 12 词');
    await expect(page.locator('.dictation-task-number')).toHaveText('#89999');
    await expect(page.locator('.dictation-resume .dictation-task-row')).toHaveCount(1);
    await expect(page.locator('.dictation-resume a[href="/dictation/89998/result"]')).toHaveCount(0);
    await expect(page.getByText('跨词本默写', { exact: true })).toHaveCount(0);
    await page.getByRole('searchbox', { name: '搜索默写计划词' }).fill('aban');
    await page.locator('.dictation-search').getByRole('button', { name: '搜索', exact: true }).click();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__dictationPlanQueries').at(-1)?.keyword)).toBe('aban');
    expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/dictation-picker-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '待巩固词', exact: true }).click();
    await expect(page.locator('.dictation-picker .dictation-mistakes')).toBeVisible();
    await expect(page.locator('.dictation-picker .dictation-home')).not.toBeVisible();
    await page.getByRole('button', { name: '计划单词', exact: true }).click();
    await page.getByRole('checkbox', { name: '默写选词 abandon', exact: true }).check();
    await page.getByRole('button', { name: '默写所选 1 词', exact: true }).click();
    await expect(page.locator('#dictation-input')).toBeEnabled();
    await page.locator('#dictation-input').fill('draft');
    await page.getByRole('button', { name: '重新选词', exact: true }).click();
    await expect(page.getByRole('searchbox', { name: '搜索默写计划词' })).toBeVisible();
    await expect(page.locator('#dictation-input')).not.toBeVisible();
    await page.getByRole('searchbox', { name: '搜索默写计划词' }).press('F2');
    await expect(page.locator('.dictation-expected')).toHaveCount(0);
    await page.getByRole('button', { name: '返回当前练习', exact: true }).click();
    await expect(page.locator('#dictation-input')).toBeFocused();
    await expect(page.locator('#dictation-input')).toHaveValue('draft');
    await page.locator('#dictation-input').fill('');
    await expect(page.locator('.dictation-prompt')).toContainText('放弃');
    await expect(page.locator('.dictation-expected')).toHaveCount(0);
    expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/dictation-question-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await expect(page.getByRole('button', { name: '不会／看答案', exact: true })).toHaveAttribute('aria-keyshortcuts', 'F2');
    await page.locator('#dictation-input').dispatchEvent('compositionstart');
    await page.locator('#dictation-input').press('F2');
    await expect(page.locator('.dictation-expected')).toHaveCount(0);
    await page.locator('#dictation-input').dispatchEvent('compositionend');
    await page.locator('#dictation-input').press('F2');
    await expect(page.locator('.dictation-verdict')).toHaveText('已查看答案');
    await expect(page.locator('.dictation-expected')).toHaveText('abandon');
    await page.screenshot({ path: `docs/screenshots/dictation-feedback-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    for (let index = 0; index < 2; index++) {
      await page.getByRole('button', { name: '隐藏答案，下一题', exact: true }).click();
      await expect(page.locator('#dictation-input')).toBeEnabled();
      await expect(page.locator('#dictation-input')).toHaveValue('');
      await expect(page.locator('.dictation-expected')).toHaveCount(0);
      await page.locator('#dictation-input').fill(' AbAnDoN ');
      await page.locator('#dictation-input').press('Enter');
      await expect(page.locator('.dictation-verdict')).toHaveText('拼写命中');
      expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.getByRole('button', { name: '查看默写结果', exact: true }).click();
    await expect(page.locator('.dictation-stats dd')).toHaveText(['1', '1', '1', '0', '3']);
    await page.screenshot({ path: `docs/screenshots/dictation-result-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.locator('.dictation-result-actions a[href="/dictation"]').click();
    await expect(page.locator('.dictation-resume')).toHaveCount(0);
  });
}
