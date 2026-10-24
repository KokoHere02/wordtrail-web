import { expect, test } from '@playwright/test';

for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`sentence translation ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    await page.goto('/login'); await page.locator('#username').fill('sentence_visual'); await page.locator('#password').fill('example123'); await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.daily-equation')).toBeVisible();
    await page.evaluate(async () => {
      const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
      const { http } = await import(/* @vite-ignore */ httpPath);
      const { router } = await import(/* @vite-ignore */ routerPath);
      const original = http.defaults.adapter;
      const base = '/sentence-translation';
      const items = [1, 2].map(id => ({ itemId: 600 + id, sentenceId: id, status: 'PENDING', englishText: id === 1 ? 'Although the journey was longer than expected, she continued to read every day.' : 'I missed the bus.', difficulty: 1, source: '原创试用样例', sourceReference: null, linkedWords: [{ wordId: 1001, word: 'abandon' }], attemptId: null as number | null, action: null as string | null, translation: null as string | null, referenceTranslation: null as string | null, explanation: null as string | null, selfAssessment: null as string | null, submittedAt: null as string | null }));
      const progress = () => ({ sessionId: 501, selectionSource: 'BANK', status: items.every(item => item.status === 'DONE') ? 'COMPLETED' : 'IN_PROGRESS', totalCount: 2, submissionCount: items.filter(item => item.action).length, answerCount: items.filter(item => item.action === 'ANSWER').length, revealCount: items.filter(item => item.action === 'REVEAL').length, selfReviewCount: items.filter(item => item.selfAssessment).length, completedCount: items.filter(item => item.status === 'DONE').length, understoodCount: 0, partialCount: items.filter(item => item.selfAssessment === 'PARTIAL').length, notUnderstoodCount: items.filter(item => item.selfAssessment === 'NOT_UNDERSTOOD').length, nextItemId: items.find(item => item.status !== 'DONE')?.itemId ?? null, createdAt: '2026-10-23T23:58:00', completedAt: items.every(item => item.status === 'DONE') ? '2026-10-24T00:02:00' : null });
      // Explicit browser fixtures only. Translation contents are never compared or graded.
      http.defaults.adapter = async (config: { url: string; method: string; data?: string }) => {
        if (!config.url.startsWith(`${base}/`)) return original(config);
        const body = config.data ? JSON.parse(config.data) : undefined;
        const ok = (data: unknown, status = 200) => ({ config, status, headers: {}, data: { code: 'OK', message: '成功', data: structuredClone(data) } });
        if (config.url === `${base}/management/access`) return ok({ canManage: false });
        if (config.url === `${base}/questions`) return ok({ page: 1, size: 10, total: 2, records: items.map(item => ({ sentenceId: item.sentenceId, englishText: item.englishText, difficulty: 1, source: item.source, sourceReference: null, favorite: false })) });
        if (config.url === `${base}/sessions`) return config.method === 'post' ? ok(progress(), 201) : ok({ page: 1, size: 10, total: 1, records: [progress()] });
        if (config.url === `${base}/sessions/501`) return ok(progress());
        if (config.url.endsWith('/current')) return ok(items.find(item => item.status !== 'DONE') || null);
        if (config.url.endsWith('/result')) return ok({ page: 1, size: 10, total: 2, records: items.map(item => ({ ...item, sessionId: 501, learningDate: '2026-10-23', reviewDate: '2026-10-24', reviewedAt: '2026-10-24T00:01:00' })) });
        const item = items.find(item => config.url.includes(`/items/${item.itemId}/`));
        if (!item) throw new Error(`Unexpected fixture endpoint ${config.url}`);
        if (config.url.endsWith('/submission')) Object.assign(item, { status: 'AWAITING_REVIEW', attemptId: item.itemId + 100, action: body.action, translation: body.translation ?? null, referenceTranslation: '这是供对照的参考表达，中文措辞可以不同。', explanation: '先核对句子的核心含义。\n较长的解析在窄屏自然换行，保留原文及段落，不提供客观评分。', submittedAt: '2026-10-23T23:59:30' });
        else if (config.url.endsWith('/self-review')) Object.assign(item, { status: 'DONE', selfAssessment: body.assessment });
        else throw new Error(`Unexpected fixture endpoint ${config.url}`);
        return ok({ ...item, learningDate: '2026-10-23', reviewDate: item.selfAssessment ? '2026-10-24' : null, reviewedAt: item.selfAssessment ? '2026-10-24T00:01:00' : null, progress: progress() });
      };
      await router.push('/sentences');
    });
    await page.getByRole('checkbox', { name: '选择当前页', exact: true }).check();
    await page.getByRole('button', { name: '练习所选 2 句', exact: true }).click();
    await expect(page.locator('#sentence-translation')).toBeEnabled();
    await expect(page.locator('.sentence-reference')).toHaveCount(0);
    await page.locator('#sentence-translation').fill('我的中文译文，保留原始输入。\n第二行。');
    expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/sentence-pending-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '提交译文', exact: true }).click();
    await expect(page.locator('.sentence-reference')).toBeVisible();
    await expect(page.locator('#sentence-translation')).toHaveCount(0);
    await expect(page.locator('.sentence-original')).toHaveText('我的中文译文，保留原始输入。\n第二行。');
    for (const control of await page.locator('.sentence-self-review button').all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/sentence-review-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '部分理解', exact: true }).click();
    await expect(page.locator('#sentence-translation')).toBeEnabled(); await expect(page.locator('#sentence-translation')).toHaveValue('');
    await expect(page.locator('.sentence-reference')).toHaveCount(0);
    await page.getByRole('button', { name: '不会，查看解析', exact: true }).click();
    await page.getByRole('button', { name: '未理解', exact: true }).click();
    await expect(page.locator('.sentence-result-stats dd')).toHaveText(['2', '2', '1', '1', '2', '2']);
    await expect(page.locator('.sentence-assessment-counts')).toContainText('部分理解 1');
    await page.screenshot({ path: `docs/screenshots/sentence-result-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
  });
}

for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`sentence expansion ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    await page.goto('/login'); await page.locator('#username').fill('sentence_editor_visual'); await page.locator('#password').fill('example123'); await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.daily-equation')).toBeVisible();
    await page.evaluate(async () => {
      const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
      const { http } = await import(/* @vite-ignore */ httpPath);
      const { router } = await import(/* @vite-ignore */ routerPath);
      const original = http.defaults.adapter;
      const base = '/sentence-translation';
      const question = { sentenceId: 1, englishText: 'Although the journey was longer than expected, she continued to read every day.', referenceTranslation: '尽管旅途比预期更长，她依然每天阅读。', explanation: '核对让步关系和时态。'.repeat(20), source: '原创示例', sourceReference: null, status: 'ACTIVE', version: 3, difficulty: 2, wordIds: [1001], linkedWords: [{ wordId: 1001, word: 'abandon' }] };
      const due = { sentenceId: 1, englishText: question.englishText, difficulty: 2, source: question.source, sourceReference: null, reviewLevel: 3, lastAssessment: 'UNDERSTOOD', nextReviewDate: '2026-10-24' };
      http.defaults.adapter = async (config: { url: string; method: string; params?: { days: number } }) => {
        if (!config.url.startsWith(`${base}/`)) return original(config);
        const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data: structuredClone(data) } });
        if (config.url.endsWith('/management/access')) return ok({ canManage: true });
        if (config.url.endsWith('/management/questions')) return ok({ page: 1, size: 10, total: 1, records: [question] });
        if (config.url.endsWith('/management/questions/1')) return ok(question);
        if (config.url.endsWith('/reviews/due')) return ok({ page: 1, size: 10, total: 1, records: [due] });
        if (config.url.endsWith('/statistics')) return ok({ submissionCount: 120, answerCount: 90, revealCount: 30, selfReviewCount: 115, weakSentenceCount: 6, dueSentenceCount: 1, learningDayCount: 32, from: '2026-10-18', to: '2026-10-24', days: Array.from({ length: config.params?.days || 7 }, (_, index) => ({ learningDate: `2026-10-${String(index + 1).padStart(2, '0')}`, submissionCount: index % 5, answerCount: index % 5, revealCount: 0, selfReviewCount: (index + 1) % 5 })) });
        throw new Error(`Unexpected expansion fixture endpoint ${config.url}`);
      };
      await router.push('/sentences/manage');
    });
    for (const [path, selector, name] of [
      ['/sentences/manage', '.sentence-managed-row', 'management'],
      ['/sentences/manage/1/edit', '#sentence-explanation', 'editor'],
      ['/sentences/manage/import', '#sentence-csv-text', 'import'],
      ['/sentences/due', '.sentence-due-date', 'due'],
      ['/sentences/statistics', '.sentence-stat-grid', 'statistics'],
    ]) {
      await page.evaluate(async target => { const modulePath = '/src/router/index.ts'; const { router } = await import(/* @vite-ignore */ modulePath); await router.push(target); }, path!);
      await expect(page.locator(selector!)).toBeVisible();
      expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `docs/screenshots/sentence-${name}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    }
    await page.getByRole('button', { name: '最近 30 天', exact: true }).click();
    await expect(page.locator('.sentence-trend-chart tbody tr')).toHaveCount(30);
    expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
