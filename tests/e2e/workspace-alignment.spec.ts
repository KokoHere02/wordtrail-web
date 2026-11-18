import { expect, test } from '@playwright/test';

test('status stays aligned through recognition audio failure and tab changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByLabel('手机号或邮箱').fill('13800138000');
  await page.getByLabel('密码', { exact: true }).fill('example123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(url => !url.pathname.includes('login'));
  await page.evaluate(async () => {
    const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
    const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
    const original = http.defaults.adapter;
    const progress = { batchId: 90, learningDate: '2026-11-15', dailyTarget: 8, taskType: 'DAILY', status: 'IN_PROGRESS', totalCount: 8, completedCount: 0, skippedCount: 0, answerCount: 0, unfamiliarCount: 0, newCount: 8, reviewCount: 0, nextItemId: 901, studyMode: 'RECOGNITION', modeVersion: 0, trainingCount: 0 };
    http.defaults.adapter = async (config: { url: string }) => {
      const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', data: structuredClone(data) } });
      if (config.url === '/learning/today') return ok({ learningDate: '2026-11-15', dailyTarget: 8, activeCount: 8, dueCount: 0, newCount: 8, unassignedCount: 0, canAddMore: false, task: progress });
      if (config.url === '/learning-batches/90/daily') return ok(progress);
      if (config.url.endsWith('/training/next')) return ok({ itemId: 901, wordId: 101, word: 'edition', phonetic: '/ɪˈdɪʃən/', mode: 'RECOGNITION', modeVersion: 0, presentationId: 'sample', attemptNo: 1, phase: 'QUESTION', answerRevealed: false, hintUsed: true, extraTraining: false, itemStatus: 'PENDING', completionReason: null, progress });
      if (config.url.endsWith('/training-answer')) return ok({ trainingId: 1, itemId: 901, wordId: 101, mode: 'RECOGNITION', action: 'ANSWER', verdict: 'SELF_ASSESSED', input: null, selfAssessment: 1, word: 'edition', translation: 'n. 版本', hintUsed: true, extraTraining: false, attemptNo: 1, itemStatus: 'DONE', completionReason: 'RECALLED', reviewLogId: 501, affectsSchedule: false, answeredAt: '2026-11-15T12:00:00', progress });
      if (config.url.startsWith('/words/101/audio?')) throw new Error('测试音频不可用');
      if (config.url === '/sentence-practice/sentences') return ok([{ id: 1, englishText: 'The original edition is great.', referenceTranslation: '原版很好。', available: true }]);
      if (/^\/words\/\d+\/(forms|related|confusables)$/.test(config.url)) return ok([]);
      return original(config);
    };
    await router.push('/learn/90');
  });

  const meta = page.locator('.workspace-exercise > .workspace-meta');
  const word = page.locator('#mode-panel-daily .learning-word');
  async function expectAligned(prompt: typeof word) {
    await expect(meta).toHaveCSS('position', 'absolute');
    await expect.poll(async () => {
      const a = await meta.boundingBox(), b = await prompt.boundingBox();
      return a && b ? Math.abs(a.y + a.height / 2 - b.y - b.height / 2) : Infinity;
    }).toBeLessThan(2);
  }
  await expect(word).toHaveText('edition');
  await expectAligned(word);
  await page.setViewportSize({ width: 1150, height: 900 });
  await word.evaluate(element => { element.textContent = 'settlement'; });
  await expect.poll(() => word.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    return range.getClientRects().length;
  })).toBe(1);
  await word.evaluate(element => { element.textContent = 'internationalization'; });
  await expect(page.locator('.workspace-exercise')).toHaveClass(/has-wide-word/);
  await expect.poll(() => word.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    return range.getClientRects().length;
  })).toBe(1);
  const wordBounds = await word.boundingBox();
  for (const selector of ['.study-directory-toolbar', '.workspace-status-meta .workspace-progress']) {
    const sideBounds = await page.locator(selector).boundingBox();
    expect(sideBounds!.y + sideBounds!.height).toBeLessThanOrEqual(wordBounds!.y);
  }
  await word.evaluate(element => { element.textContent = 'edition'; });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.workspace-exercise')).not.toHaveClass(/has-wide-word/);
  await expectAligned(word);
  await expect(meta.locator('.workspace-source')).toHaveCount(0);
  await expect(page.locator('.is-daily-practice .study-directory-toolbar')).toHaveCSS('border-bottom-style', 'none');
  const navigation = page.getByRole('navigation', { name: '学习导航' });
  await expect(navigation.getByRole('link', { name: '每日单词' })).toHaveAttribute('aria-current', 'page');
  await expect(navigation.locator('.study-directory-heading')).not.toContainText('学习');
  const wordTab = navigation.getByRole('tab', { name: '单词练习' });
  await expect(wordTab.locator('.study-directory-chevron')).toBeVisible();
  await wordTab.click();
  await expect(wordTab).toHaveAttribute('aria-expanded', 'false');
  await expect(navigation.locator('#study-directory-words')).toHaveAttribute('aria-hidden', 'true');
  await expect(navigation.locator('#study-directory-words')).toHaveAttribute('inert', '');
  await wordTab.click();
  await expect(wordTab).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation.getByRole('link', { name: '每日单词' })).toBeVisible();
  await navigation.getByRole('button', { name: '收起学习导航' }).click();
  await expect(navigation).toHaveClass(/is-collapsed/);
  await expect(wordTab.locator('.study-directory-chevron')).toBeHidden();
  await wordTab.click();
  await expect(wordTab).toHaveAttribute('aria-expanded', 'false');
  await wordTab.click();
  await expect(wordTab).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation.getByRole('link', { name: '独立默写专项' })).toBeVisible();
  await navigation.getByRole('link', { name: '独立默写专项' }).hover();
  await expect(navigation.getByRole('link', { name: '独立默写专项' })).toHaveAttribute('data-tooltip', '独立默写专项');
  await expect.poll(() => navigation.getByRole('link', { name: '独立默写专项' }).evaluate(element => getComputedStyle(element, '::after').visibility)).toBe('visible');
  await navigation.getByRole('tab', { name: '句子翻译' }).click();
  await expect(page.locator('.sentence-workspace-card h1')).toBeVisible();
  await navigation.getByRole('tab', { name: '单词练习' }).click();
  await expect(word).toHaveText('edition');
  await expect(navigation).toHaveClass(/is-collapsed/);
  await navigation.getByRole('button', { name: '展开学习导航' }).click();
  await expect(navigation).not.toHaveClass(/is-collapsed/);
  await page.getByRole('button', { name: /认识.*3/ }).click();
  await expect(page.locator('.recognition-feedback .learning-word')).toHaveText('edition');
  await expect(page.locator('.speech-error')).toBeVisible();
  await expectAligned(page.locator('.recognition-feedback .learning-word'));
  await page.getByRole('tab', { name: '句子翻译' }).click();
  const sentence = page.locator('.sentence-workspace-card h1');
  await expect(sentence).toBeVisible();
  await expect(navigation.getByRole('link', { name: '每日单词' })).toBeHidden();
  await expect(meta.getByRole('button', { name: '朗读原句' })).toBeVisible();
  await expect(meta.locator('.workspace-source')).toHaveCount(0);
  await expect.poll(async () => {
    const status = await meta.boundingBox(), prompt = await sentence.boundingBox();
    return status && prompt ? prompt.y - status.y - status.height : -1;
  }).toBeGreaterThanOrEqual(12);
  await page.getByRole('tab', { name: '单词练习' }).click();
  await expect(word).toHaveText('edition');
  await expectAligned(word);

  await page.setViewportSize({ width: 320, height: 900 });
  await expect(meta).toHaveCSS('position', 'static');
  await expect(meta.locator('.workspace-source')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await navigation.getByRole('link', { name: '独立默写专项' }).click();
  await expect(page).toHaveURL(/\/dictation$/);
  await expect(navigation.getByRole('link', { name: '独立默写专项' })).toHaveAttribute('aria-current', 'page');
  await navigation.getByRole('tab', { name: '句子翻译' }).click();
  await navigation.getByRole('tab', { name: '单词练习' }).click();
  await expect(page).toHaveURL(/\/dictation$/);
  await page.evaluate(async () => { const { router } = await import(/* @vite-ignore */ '/src/router/index.ts'); await router.push('/consolidation/study/90'); });
  const consolidationStatus = page.locator('.consolidation-workspace .workspace-status-meta');
  await expect(consolidationStatus.locator('.workspace-progress')).toBeVisible();
  await expect(consolidationStatus.locator('.workspace-source')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '学习导航' }).getByRole('link', { name: '错因与巩固' })).toHaveAttribute('aria-current', 'page');
});
