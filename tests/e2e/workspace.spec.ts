import { expect, test } from '@playwright/test';

for (const width of [1280, 320]) test(`unified learning records filters and destinations ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.locator('#username').fill('unified_record_reader');
  await page.locator('#password').fill('example123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.daily-equation')).toBeVisible();
  await page.evaluate(async () => {
    const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
    const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
    const original = http.defaults.adapter;
    const calls: unknown[] = []; Reflect.set(window, '__unifiedRecordCalls', calls);
    const base = { recordDate: '2026-10-30', createdAt: '2026-10-30T14:30:00', rawStatus: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS', canContinue: true, completedCount: 2, totalCount: 10, skippedCount: null, newCount: null, reviewCount: null, dailyTarget: null, goalReached: null, source: null, bookId: null, singleAttempt: null };
    const rows = [
      { ...base, type: 'DAILY', businessId: 1, newCount: 5, reviewCount: 5 },
      { ...base, type: 'DICTATION', businessId: 1, rawStatus: 'COMPLETED', displayStatus: 'COMPLETED', canContinue: false, singleAttempt: true },
      ...['BANK', 'REVIEW', 'FAVORITES', 'DUE', 'UNKNOWN'].map((source, index) => ({ ...base, type: 'SENTENCE', businessId: index + 2, source })),
      { ...base, type: 'DAILY', businessId: 20, recordDate: '2026-10-29', createdAt: '2026-10-29T09:00:00', displayStatus: 'INCOMPLETE', canContinue: false },
      { ...base, type: 'DICTATION', businessId: 21, recordDate: '2026-10-29', displayStatus: 'INCOMPLETE', canContinue: false, singleAttempt: false },
      { ...base, type: 'DAILY', businessId: 22, recordDate: '2026-10-29', rawStatus: 'ABANDONED', displayStatus: 'ABANDONED', canContinue: false },
      ...Array.from({ length: 11 }, (_, index) => ({ ...base, type: 'SENTENCE', businessId: 100 + index, recordDate: '2026-10-29', source: 'BANK' })),
    ];
    http.defaults.adapter = async (config: { url: string; params?: { type?: string; status?: string; page?: number; size?: number } }) => {
      if (config.url !== '/learning/records') return original(config);
      const params = config.params ?? {}; calls.push({ ...params });
      const selected = rows.filter(row => (params.type === 'ALL' || row.type === params.type) && (params.status === 'ALL' || row.displayStatus === params.status));
      const current = params.page ?? 1, size = params.size ?? 20;
      return { config, status: 200, headers: {}, data: { code: 'OK', data: { page: current, size, total: selected.length, records: selected.slice((current - 1) * size, current * size) } } };
    };
    await router.push('/records');
  });
  await expect(page.locator('.unified-record-row')).toHaveCount(20);
  await expect(page.locator('.records-date-group')).toHaveCount(2);
  await expect(page.locator('.unified-record-row').nth(0)).toContainText('每日单词学习');
  await expect(page.locator('.unified-record-row').nth(0)).toContainText('14:30');
  await expect(page.locator('.unified-record-row').nth(0).locator('a')).toHaveAttribute('href', '/learn/1');
  await expect(page.locator('.unified-record-row').nth(1)).toContainText('独立默写');
  await expect(page.locator('.unified-record-row').nth(1).locator('a')).toHaveAttribute('href', '/dictation/1/result');
  for (const [index, name] of ['句子题库练习', '薄弱句子练习', '收藏句子练习', '到期句子复习'].entries()) await expect(page.locator('.unified-record-row').nth(index + 2).locator('.record-name')).toHaveText(name);
  await expect(page.locator('.unified-record-row').nth(6).locator('.record-name')).toHaveText('句子练习');
  await expect(page.locator('.unified-record-row').nth(7).locator('a')).toHaveAttribute('href', '/records/20');
  await expect(page.locator('.unified-record-row').nth(8).locator('a')).toHaveAttribute('href', '/dictation/21/result');
  await expect(page.locator('.unified-record-row').nth(9).locator('a')).toHaveCount(0);
  await page.getByRole('button', { name: '下一页' }).click();
  await expect(page.locator('.unified-record-row')).toHaveCount(1);
  expect(await page.evaluate(() => Reflect.get(window, '__unifiedRecordCalls').at(-1))).toMatchObject({ page: 2, type: 'ALL', status: 'ALL' });
  await page.getByRole('button', { name: '单词默写', exact: true }).click();
  await expect(page.locator('.unified-record-row')).toHaveCount(2);
  await page.getByRole('combobox', { name: /记录状态/ }).click();
  await page.getByRole('option', { name: '未完成' }).click();
  await expect(page.locator('.unified-record-row')).toHaveCount(1);
  expect(await page.evaluate(() => Reflect.get(window, '__unifiedRecordCalls').at(-1))).toMatchObject({ type: 'DICTATION', status: 'INCOMPLETE', page: 1, size: 20 });
  expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const [width, theme] of [[1280, 'light'], [900, 'light'], [320, 'dark']] as const) test(`plan actions and readable word history ${theme} ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(theme => localStorage.setItem('wordtrail.theme', theme), theme);
  await page.goto('/login'); await page.locator('#username').fill('plan_history_reader'); await page.locator('#password').fill('example123'); await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.daily-equation')).toBeVisible();
  await page.evaluate(async () => {
    const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
    const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
    const fallback = http.defaults.adapter, writes: unknown[] = []; Reflect.set(window, '__planHistoryWrites', writes);
    const records = ['apple', 'banana', 'cherry', 'date'].map((word, index) => ({ wordId: 101 + index, word, phonetic: '/ˈæp.əl/', translation: '单词释义', planStatus: ['ACTIVE', 'PAUSED', 'REMOVED', 'ACTIVE'][index], joinedAt: '2026-10-21T16:34:03', firstLearnedAt: '2026-10-22T12:00:00', lastLearnedAt: '2026-10-28T15:42:57', lastResult: 2, nextReviewAt: '2026-10-30T00:00:00', reviewLevel: 3 }));
    const history = Array.from({ length: 11 }, (_, index) => ({ logId: 1000 + index, batchId: 700, itemId: 701, learningDate: '2026-10-28', answeredAt: '2026-10-28T15:42:57', result: index === 2 ? 3 : 2, taskType: index === 2 || index === 10 ? 'PRACTICE' : 'DAILY', eventType: index === 0 ? 'CORRECTION' : 'ANSWER', correctsLogId: index === 0 ? 999 : null, attemptNo: index + 1, affectsSchedule: index === 0, scheduleAvailable: index === 0, scheduleBefore: index === 0 ? { reviewLevel: 3, nextReviewAt: '2026-11-04T00:00:00' } : null, scheduleAfter: index === 0 ? { reviewLevel: 0, nextReviewAt: '2026-10-29T00:00:00' } : null }));
    http.defaults.adapter = async (config: { url: string; method: string; params?: { status?: string; page?: number; size?: number }; data?: string }) => {
      const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', data: structuredClone(data) } });
      const paged = (rows: unknown[]) => { const page = config.params?.page ?? 1, size = config.params?.size ?? 10; return ok({ page, size, total: rows.length, records: rows.slice((page - 1) * size, page * size) }); };
      if (config.url === '/learning-plan/words') return paged(records.filter(row => row.planStatus === config.params?.status));
      if (config.url === '/learning-plan/words/101' && config.method === 'patch') { const body = JSON.parse(config.data ?? '{}'); writes.push(body); records[0]!.planStatus = body.status; return ok(null); }
      if (config.url === '/learning-plan/words/101/history') return paged(history);
      if (config.url === '/dictation/words/101/history') return paged([{ logId: 2000, batchId: 900, itemId: 901, taskType: 'PRACTICE', practiceMode: 'DICTATION', action: 'ANSWER', input: 'aple', expectedWord: 'apple', verdict: 'INCORRECT', attemptNo: 1, learningDate: '2026-10-28', answeredAt: '2026-10-28T15:00:00', affectsSchedule: false }]);
      return fallback(config);
    };
    await router.push('/plan');
  });
  const actions = page.locator('.plan-row').first().locator('.plan-item-actions');
  await expect(page.locator('.plan-row')).toHaveCount(2);
  await expect(page.locator('.plan-more, .plan-row-details, button[aria-label*="的操作"]')).toHaveCount(0);
  for (const row of await page.locator('.plan-row').all()) {
    await expect(row.getByRole('button', { name: '学习历史', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: '暂停', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: '移出', exact: true })).toBeVisible();
  }
  await expect(page.locator('.plan-word-title a').first()).toHaveAttribute('href', '/words/101');
  await expect(actions.getByRole('button', { name: '学习历史', exact: true })).toBeVisible();
  await expect(actions.locator('button svg')).toHaveCount(3);
  await expect(actions.locator('.plan-action-pause')).toHaveText('暂停');
  await expect(actions.locator('.plan-action-remove')).toHaveText('移出');
  await page.screenshot({ path: testInfo.outputPath('plan-actions.png'), animations: 'disabled' });
  await actions.getByRole('button', { name: '学习历史', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'apple · 学习历史', exact: true });
  await expect(dialog.locator('.word-history-event')).toHaveCount(10);
  await expect(dialog).not.toContainText(/队列|原始反馈|reviewLevel/);
  await expect(dialog.locator('.history-group').first()).not.toContainText('模糊');
  await expect(dialog.locator('.history-group').last()).toContainText('不认识');
  await dialog.locator('.word-history-event').first().locator('summary').click();
  await expect(dialog.locator('.word-history-schedules')).toContainText('2026-11-04');
  await expect(dialog.locator('.word-history-schedules')).toContainText('2026-10-29');
  await page.screenshot({ path: testInfo.outputPath('word-history.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: '下一页', exact: true }).click(); await expect(dialog.locator('.word-history-event')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: '学习记录', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: '默写记录', exact: true }).click();
  await expect(dialog.locator('.dictation-history-event')).toHaveCount(1); await expect(dialog.locator('.dictation-history-input')).toContainText('aple');
  await page.screenshot({ path: testInfo.outputPath('dictation-history.png'), animations: 'disabled' });
  expect(await page.evaluate(() => Reflect.get(window, '__planHistoryWrites'))).toEqual([]);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(actions.getByRole('button', { name: '学习历史', exact: true })).toBeFocused();
  await actions.getByRole('button', { name: '暂停', exact: true }).click(); await expect(page.locator('.plan-row')).toHaveCount(1);
  await page.getByRole('button', { name: '已暂停', exact: true }).click(); await expect(page.locator('.plan-row')).toHaveCount(2);
  await expect(page.locator('.plan-action-resume')).toHaveCount(2);
  await expect(actions.getByRole('button', { name: '重新启用', exact: true })).toBeVisible();
  await actions.getByRole('button', { name: '移出', exact: true }).click(); await expect(page.getByRole('dialog', { name: '移出学习计划？', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); expect(await page.evaluate(() => Reflect.get(window, '__planHistoryWrites'))).toEqual([{ status: 'PAUSED' }]);
  await actions.getByRole('button', { name: '重新启用', exact: true }).click();
  await expect(page.locator('.plan-row')).toHaveCount(1);
  expect(await page.evaluate(() => Reflect.get(window, '__planHistoryWrites'))).toEqual([{ status: 'PAUSED' }, { status: 'ACTIVE' }]);
  await page.getByRole('button', { name: '已移出', exact: true }).click();
  await expect(page.locator('.plan-row')).toHaveCount(1);
  await expect(actions.getByRole('button', { name: '学习历史', exact: true })).toBeVisible();
  await expect(actions.getByRole('button', { name: '移出', exact: true })).toHaveCount(0);
  await expect(actions.getByRole('button', { name: '重新启用', exact: true })).toHaveCount(0);
  expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const width of [1280, 375]) test(`weak words select across pages for independent dictation at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.locator('#username').fill('weak_words_reader');
  await page.locator('#password').fill('example123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.daily-equation')).toBeVisible();
  await page.evaluate(async () => {
    const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
    const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
    const original = http.defaults.adapter;
    const sentenceCalls: string[] = []; Reflect.set(window, '__weakSentenceCalls', sentenceCalls);
    const creates: unknown[] = []; Reflect.set(window, '__weakDictationCreates', creates);
    const records = Array.from({ length: 12 }, (_, index) => ({ wordId: 1001 + index, word: `word${index + 1}`, translation: '单词释义', phonetic: null, lastResult: 2, answerCount: 2, lastAnsweredAt: '2026-10-28T15:42:57', statisticsComplete: true }));
    http.defaults.adapter = async (config: { url: string; method?: string; data?: string; params?: { page: number; size: number } }) => {
      if (config.url.startsWith('/sentence-translation')) sentenceCalls.push(config.url);
      if (config.url === '/learning/weak-words') {
        const { page = 1, size = 10 } = config.params ?? {};
        return { config, status: 200, headers: {}, data: { code: 'OK', data: { source: 'DAILY', page, size, total: 12, statisticsComplete: true, incompleteWordCount: 0, firstRecordedAt: '2026-10-21T16:34:03', lastRecordedAt: '2026-10-28T15:42:57', records: records.slice((page - 1) * size, page * size) } } };
      }
      if (config.url === '/dictation/batches' && config.method === 'post') { creates.push(JSON.parse(config.data ?? '{}')); throw new Error('test response unavailable'); }
      return original(config);
    };
    await router.push('/weak-words');
  });
  await expect(page.locator('.weak-word-row')).toHaveCount(10);
  await expect(page.locator('.weak-words-page')).not.toContainText(/记录范围|本轮句数|句子数量|难度|关联句子/);
  await expect(page.locator('.weak-words-page input:not([type="checkbox"]), .weak-words-page select')).toHaveCount(0);
  await expect(page.locator('.weak-word-row').first()).toContainText('单词释义');
  await expect(page.locator('.weak-word-row').first().getByRole('link')).toHaveAttribute('href', '/words/1001');
  await expect(page.locator('.weak-word-row').first().getByRole('button', { name: '学习历史' })).toBeEnabled();
  const start = page.getByRole('button', { name: '默写所选', exact: true });
  await expect(start).toBeDisabled();
  await page.locator('.weak-word-row').first().getByRole('checkbox').check();
  await page.locator('.weak-word-row').last().getByRole('checkbox').check();
  await expect(page.locator('.weak-selected-count')).toHaveText('已选 2 词');
  await expect(start).toBeEnabled();
  await expect(start).toBeInViewport();
  const refresh = page.getByRole('button', { name: '刷新', exact: true });
  await expect(refresh).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('weak-word-list.png'), animations: 'disabled' });
  await page.locator('.weak-words-sheet button[aria-label="下一页"]').click();
  await expect(page.locator('.weak-word-row')).toHaveCount(2);
  await expect(page.locator('.weak-word-row').first().getByRole('link')).toHaveText('word11');
  await page.locator('.weak-word-row').first().getByRole('checkbox').check();
  await expect(page.locator('.weak-selected-count')).toHaveText('已选 3 词');
  await refresh.click();
  await expect(page.locator('.weak-word-row')).toHaveCount(2);
  await expect(page.locator('.weak-selected-count')).toHaveText('已选 3 词');
  await start.click();
  await expect(page.locator('.dictation-launch-error')).toContainText('创建结果尚未确认');
  await expect(start).toBeDisabled();
  await expect(page.locator('.weak-word-row').first().getByRole('checkbox')).toBeDisabled();
  expect(await page.evaluate(() => Reflect.get(window, '__weakDictationCreates'))).toEqual([{ source: 'PLAN', wordIds: [1001, 1010, 1011] }]);
  expect(await page.evaluate(() => Reflect.get(window, '__weakSentenceCalls'))).toEqual([]);
  expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const [width, theme] of [[1280, 'light'], [375, 'dark'], [320, 'light']] as const) test(`content library navigation remains visible and highlights the current page at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.locator('#username').fill('content_navigation_reader');
  await page.locator('#password').fill('example123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.daily-equation')).toBeVisible();
  await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '内容库', exact: true }).click();
  const nav = page.getByRole('navigation', { name: '内容库分类', exact: true });
  const entries = [['单词', '/books'], ['句子', '/sentences'], ['学习计划', '/plan'], ['薄弱词', '/weak-words']] as const;
  async function expectActive(label: string) {
    await expect(nav.locator('a')).toHaveCount(4);
    await expect(nav.getByRole('link', { name: '默写待巩固', exact: true })).toHaveCount(0);
    for (const [name] of entries) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    await expect(nav.locator('a.active')).toHaveText(label);
    await expect(nav.locator('a[aria-current="page"]')).toHaveText(label);
    await expect(page.locator('.app-main-nav a.active')).toHaveText('内容库');
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
  }
  for (const [label, path] of entries) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expectActive(label);
    await expect(page.locator('#main h1')).toHaveCount(0);
    if (path === '/weak-words') {
      await expect(page.getByRole('group', { name: '薄弱词来源' })).toHaveCount(0);
      await expect(page.locator('.weak-words-page')).not.toContainText('历史认读专项');
    }
  }
  await nav.getByRole('link', { name: '句子', exact: true }).click();
  await expectActive('句子');
  await nav.getByRole('link', { name: '学习计划', exact: true }).click();
  await expectActive('学习计划');
  await page.goBack(); await expectActive('句子');
  await page.goForward(); await expectActive('学习计划');
  await page.reload(); await expectActive('学习计划');
  for (const [path, label] of [['/books/1', '单词'], ['/words/1004', '单词'], ['/sentences/favorites', '句子'], ['/sentences/notes', '句子'], ['/weak-words?source=DAILY', '薄弱词']] as const) {
    await page.evaluate(async path => { const routerPath = '/src/router/index.ts'; const { router } = await import(/* @vite-ignore */ routerPath); await router.push(path); }, path);
    await expectActive(label);
  }
  await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
  await nav.getByRole('link', { name: '句子', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expectActive('句子');
  await page.screenshot({ path: testInfo.outputPath('content-navigation.png'), animations: 'disabled' });
});

for (const width of [1280, 375]) test(`daily record detail stays concise and paginates at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.locator('#username').fill('record_layout_reader');
  await page.locator('#password').fill('example123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.daily-equation')).toBeVisible();
  await page.evaluate(async () => {
    const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
    const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
    const original = http.defaults.adapter;
    const writes: string[] = [];
    Reflect.set(window, '__recordWrites', writes);
    const task = { batchId: 930, learningDate: '2099-10-27', dailyTarget: 20, taskType: 'DAILY', status: 'IN_PROGRESS', totalCount: 21, completedCount: 18, skippedCount: 0, answerCount: 123, unfamiliarCount: 2, newCount: 10, reviewCount: 11, nextItemId: null, studyMode: 'DICTATION', modeVersion: 0, trainingCount: 46 };
    const items = Array.from({ length: 21 }, (_, index) => ({ itemId: 1000 + index, sortOrder: index + 1, itemStatus: index < 18 ? 'DONE' : 'PENDING', completionReason: index < 18 ? 'RECALLED' : null, current: false, canExtraTrain: false, word: index < 18 ? ['apple', 'banana', 'cherry'][index % 3] : null, translation: index < 18 ? '单词释义' : null, phonetic: null, trainingCount: 2, answerCount: 12 }));
    const attempts = Array.from({ length: 21 }, (_, index) => ({ trainingId: index + 1, itemId: 1000, wordId: 1, mode: 'DICTATION', action: 'ANSWER', verdict: index % 2 ? 'INCORRECT' : 'CORRECT', input: index % 2 ? 'aple' : 'apple', selfAssessment: null, word: 'apple', translation: '苹果', hintUsed: false, extraTraining: false, attemptNo: index + 1, itemStatus: 'DONE', completionReason: 'RECALLED', answeredAt: '2099-10-27T12:00:00' }));
    http.defaults.adapter = async (config: { url: string; method: string; params?: { page?: number; size?: number } }) => {
      if (config.method !== 'get') writes.push(config.url);
      const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', data: structuredClone(data) } });
      const paged = (rows: unknown[]) => { const page = config.params?.page ?? 1, size = config.params?.size ?? 20; return ok({ page, size, total: rows.length, records: rows.slice((page - 1) * size, page * size) }); };
      if (config.url === '/learning/today') return ok({ learningDate: '2099-10-28', dailyTarget: 20, task: null, canAddMore: false, needsMoreWords: false });
      if (config.url === '/learning/records') return paged([930, 931].map((id, index) => ({ type: 'DAILY', businessId: id, recordDate: task.learningDate, createdAt: `${task.learningDate}T12:00:00`, rawStatus: 'IN_PROGRESS', displayStatus: 'INCOMPLETE', canContinue: false, completedCount: 18, totalCount: 21, skippedCount: index, newCount: 10, reviewCount: 11, dailyTarget: 20, goalReached: false, source: null, bookId: null, singleAttempt: null })));
      if (config.url === '/learning-batches/930/daily') return ok(task);
      if (config.url.endsWith('/training/items')) return paged(items);
      if (config.url.endsWith('/training/attempts')) return paged(attempts);
      return original(config);
    };
    await router.push('/records');
  });
  await expect(page.locator('.unified-record-row')).toHaveCount(2);
  await expect(page.locator('.unified-record-row').first().locator('.record-progress')).toHaveText('18 / 21 词');
  await expect(page.locator('.unified-record-row').first().locator('.record-status')).toHaveText('未完成');
  await page.locator('.unified-record-row').first().getByRole('link', { name: '查看详情' }).click();
  await expect(page.locator('.daily-record-heading h1')).toHaveText('2099-10-27 学习记录');
  await expect(page.locator('.daily-record-heading .learning-badge')).toHaveText('已结束 · 未完成');
  await expect(page.locator('.daily-record-progress')).toContainText('18 / 21');
  await expect(page.locator('.daily-record-counts')).toContainText('46次');
  await expect(page.locator('#record-words .training-item-row')).toHaveCount(20);
  await expect(page.locator('.live-daily-result')).not.toContainText(/队列|有效反馈|本任务目标|服务端测评统计|跳过 0 词/);
  await expect(page.getByRole('link', { name: '继续学习', exact: true })).toHaveCount(0);
  await expect(page.locator('.training-item-footer button')).toHaveCount(0);
  await expect(page.locator('[data-item-id="1018"] [lang="en"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('record-words.png'), fullPage: true, animations: 'disabled' });
  await page.locator('#record-words button[aria-label="下一页"]').click();
  await expect(page.locator('#record-words .training-item-order')).toHaveText('21');
  await page.getByRole('button', { name: '练习记录', exact: true }).click();
  await expect(page.locator('#record-words')).toBeHidden();
  await expect(page.locator('#record-history')).toBeVisible();
  await expect(page.locator('.training-history-row')).toHaveCount(20);
  await expect(page.locator('.training-history-row').first()).toContainText('当前状态：回忆完成');
  await page.locator('#record-history button[aria-label="下一页"]').click();
  await expect(page.locator('.training-history-row')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('record-history.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '单词列表', exact: true }).click();
  await expect(page.locator('#record-words .training-item-order')).toHaveText('21');
  expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => Reflect.get(window, '__recordWrites'))).toEqual([]);
});

test('recognition advances without locked ratings or transient error alerts; failed writes remain retryable', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#username').fill('recognition_regression');
  await page.locator('#password').fill('example123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.daily-equation')).toBeVisible();
  await page.evaluate(async () => {
    const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
    const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
    const original = http.defaults.adapter;
    const control = { loseResponse: false, alerts: 0, bodies: [] as Record<string, unknown>[], corrections: [] as Record<string, unknown>[], audio: [] as string[], detailRequests: [] as string[] };
    Reflect.set(window, '__recognitionRegression', control);
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches('.learning-error') || node.querySelector('.learning-error'))) control.alerts++;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const words = ['apple', 'banana', 'cherry', 'date'];
    let position = 0, trainingCount = 0, completedCount = 0;
    const saved = new Map<string, unknown>();
    const progress = () => ({ batchId: 90, learningDate: '2026-10-25', dailyTarget: 4, taskType: 'DAILY', status: 'IN_PROGRESS', totalCount: 4, completedCount, skippedCount: 0, answerCount: trainingCount, unfamiliarCount: 0, newCount: 4, reviewCount: 0, nextItemId: 901 + position, studyMode: 'RECOGNITION', modeVersion: 0, trainingCount });
    http.defaults.adapter = async (config: { url: string; data?: string; params?: { term?: string } }) => {
      const body = config.data ? JSON.parse(config.data) : {};
      const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data: structuredClone(data) } });
      if (/^\/words\/\d+\/forms$/.test(config.url)) { control.detailRequests.push(config.url); return ok([{ form: 'apples', formType: 'PLURAL' }]); }
      if (config.url === '/words/lookup') return ok(config.params?.term === 'apples' ? [{ id: 101, word: 'apple', phonetic: '/ˈæpəl/', translation: 'n. 苹果' }] : []);
      if (config.url === '/learning/settings') return ok({ dailyTarget: 20, newWordTarget: 10, reviewLimit: 10, pronunciation: { autoPlay: false, accent: 'US', playbackRate: 1, repeatCount: 1 } });
      if (config.url === '/sentence-practice/sentences') { control.detailRequests.push(config.url); return ok([{ id: 1, englishText: 'I like apples.', referenceTranslation: '我喜欢苹果。' }]); }
      if (/^\/words\/\d+\/audio\?/.test(config.url)) { control.audio.push(config.url); return { config, status: 200, headers: { 'content-type': 'audio/wav' }, data: new Blob([new Uint8Array([1])], { type: 'audio/wav' }) }; }
      if (config.url === '/learning/today') return ok({ learningDate: '2026-10-25', dailyTarget: 4, activeCount: 4, dueCount: 0, newCount: 4, unassignedCount: 0, canAddMore: false, task: progress() });
      if (config.url === '/learning-batches/90/daily') return ok(progress());
      if (config.url.endsWith('/correction')) { control.corrections.push(structuredClone(body)); return ok({ itemId: 901, logId: 600 + control.corrections.length, result: body.result, correction: true, progress: progress() }); }
      if (config.url.endsWith('/training/next')) {
        await new Promise(resolve => setTimeout(resolve, 80));
        return ok({ itemId: 901 + position, wordId: 101 + position, word: words[position], phonetic: null, mode: 'RECOGNITION', modeVersion: 0,
          presentationId: `recognition-${position}-${trainingCount}`, attemptNo: 1, phase: 'QUESTION', answerRevealed: false, hintUsed: true, extraTraining: false, itemStatus: 'PENDING', completionReason: null, progress: progress() });
      }
      if (config.url.endsWith('/training-answer')) {
        control.bodies.push(structuredClone(body));
        await new Promise(resolve => setTimeout(resolve, 250));
        if (saved.has(body.requestId)) return ok(saved.get(body.requestId));
        const index = position; position++; trainingCount++; if (body.result === 1) completedCount++;
        const answer = { trainingId: trainingCount, itemId: 901 + index, wordId: 101 + index, mode: 'RECOGNITION', action: body.action, verdict: 'SELF_ASSESSED',
          input: null, selfAssessment: body.result, word: words[index], translation: `释义 ${index + 1}`, translationGroups: [{ partOfSpeech: 'n.', meaning: '苹果；水果；果实；苹果树；第五种含义；第六种含义' }, { partOfSpeech: null, meaning: '[法] 专业释义完整内容' }], hintUsed: true, extraTraining: false, attemptNo: 1,
          reviewLogId: 500 + index, affectsSchedule: false, answeredAt: '2026-10-25T12:00:00', itemStatus: body.result === 1 ? 'DONE' : 'RELEARNING', completionReason: body.result === 1 ? 'RECALLED' : null, progress: progress() };
        saved.set(body.requestId, answer);
        if (control.loseResponse) { control.loseResponse = false; throw new Error('test response lost after save'); }
        return ok(answer);
      }
      return original(config);
    };
    await router.push('/learn/90');
  });
  const ratings = page.locator('.daily-training-rating button');
  for (const word of ['apple', 'banana']) {
    await expect(page.locator('.daily-training-card .learning-word')).toHaveText(word);
    for (let index = 0; index < 3; index++) await expect(ratings.nth(index)).toBeEnabled();
    await expect(page.locator('.daily-training-card .word-meaning')).toHaveCount(0);
    if (word === 'apple') expect(await page.evaluate(() => Reflect.get(window, '__recognitionRegression').detailRequests)).toHaveLength(0);
    await expect(page.locator('.daily-training-card')).toHaveCSS('padding-top', '8px');
    if (word === 'apple') { await page.locator('#mode-panel-words').focus(); await expect(page.locator('#mode-panel-words')).toHaveCSS('outline-style', 'none'); await page.keyboard.press('3'); } else { await ratings.nth(1).click(); }
    await expect(page.getByRole('status').filter({ hasText: '正在保存' })).toBeVisible();
    await expect(page.locator('.learning-error')).toHaveCount(0);
    await page.evaluate(() => document.querySelectorAll<HTMLButtonElement>('.daily-training-rating button').forEach(button => button.click()));
    await expect(page.locator('.daily-training-feedback')).toBeVisible();
    if (word === 'apple') {
      await expect(page.getByRole('region', { name: '释义与词形' })).toContainText('复数');
      await expect(page.getByRole('region', { name: '释义与词形' })).toContainText('第六种含义');
      await expect(page.getByRole('region', { name: '释义与词形' })).toContainText('专业释义完整内容');
      await expect(page.getByRole('region', { name: '双语例句' })).toContainText('我喜欢苹果。');
      await expect(page.locator('.example-english .is-match')).toHaveText('apples');
      await page.getByRole('button', { name: '查询 apples' }).click();
      const lookup = page.getByRole('region', { name: 'apples 的词典释义' });
      await expect(lookup).toContainText('apple');
      await expect(lookup).toContainText('/ˈæpəl/');
      await expect(lookup).toContainText('苹果');
      await expect.poll(() => page.evaluate(() => Reflect.get(window, '__recognitionRegression').audio.length)).toBe(1);
      await lookup.getByRole('button', { name: '朗读 apple' }).click();
      await expect.poll(() => page.evaluate(() => Reflect.get(window, '__recognitionRegression').audio.length)).toBe(2);
      expect(await page.evaluate(() => Reflect.get(window, '__recognitionRegression').audio.at(-1))).toContain('/words/101/audio?');
      await page.evaluate(() => Reflect.get(window, '__recognitionRegression').audio.pop());
      const wordBox = await page.getByRole('button', { name: '查询 apples' }).boundingBox();
      const lookupBox = await lookup.boundingBox();
      expect(wordBox && lookupBox && lookupBox.y >= wordBox.y + wordBox.height).toBeTruthy();
      await lookup.getByRole('button', { name: '关闭释义' }).click();
      await expect(lookup).toHaveCount(0);
      await page.getByRole('button', { name: '查询 apples' }).click();
      await page.locator('.example-chinese').click();
      await expect(lookup).toHaveCount(0);
      await page.getByRole('button', { name: '查询 like' }).click();
      await expect(page.getByRole('region', { name: 'like 的词典释义' })).toContainText('词库中未找到');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('region', { name: 'like 的词典释义' })).toHaveCount(0);
      await page.setViewportSize({ width: 375, height: 800 });
      await page.getByRole('button', { name: '查询 apples' }).click();
      const mobileLookup = await page.getByRole('region', { name: 'apples 的词典释义' }).boundingBox();
      expect(mobileLookup && mobileLookup.x >= 0 && mobileLookup.x + mobileLookup.width <= 375).toBeTruthy();
      await page.getByRole('button', { name: '关闭释义' }).click();
      expect(await page.locator('html').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    await expect(page.locator('.daily-training-feedback')).toHaveCSS('padding-top', '8px');
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__recognitionRegression').audio.length)).toBe(word === 'apple' ? 1 : 2);
    await expect(ratings).toHaveCount(3);
    await expect(ratings.nth(word === 'apple' ? 2 : 1)).toHaveAttribute('aria-pressed', 'true');
    if (word === 'apple') {
      await ratings.nth(0).click(); await expect(ratings.nth(0)).toHaveAttribute('aria-pressed', 'true');
      await ratings.nth(1).click(); await expect(ratings.nth(1)).toHaveAttribute('aria-pressed', 'true');
      await ratings.nth(2).click(); await expect(ratings.nth(2)).toHaveAttribute('aria-pressed', 'true');
      const corrections = await page.evaluate(() => Reflect.get(window, '__recognitionRegression').corrections);
      expect(corrections.map((c: { result: number }) => c.result)).toEqual([3, 2, 1]);
      expect(corrections.every((c: { logId: number }) => c.logId === 500)).toBe(true);
    }
    await expect(page.locator('.recognition-feedback-actions .recognition-next')).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('.daily-training-card .learning-word')).toHaveText('cherry');
  expect(await page.evaluate(() => Reflect.get(window, '__recognitionRegression').alerts)).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, '__recognitionRegression').bodies.map((body: { action: string }) => body.action))).toEqual(['ANSWER', 'ANSWER']);
  await page.evaluate(() => { Reflect.get(window, '__recognitionRegression').loseResponse = true; });
  await ratings.nth(0).click();
  await expect(page.locator('.learning-error')).toContainText('保存结果尚未确认');
  for (let index = 0; index < 3; index++) await expect(ratings.nth(index)).toBeDisabled();
  await page.getByRole('button', { name: '重试原请求', exact: true }).click();
  await expect(page.locator('.daily-training-feedback')).toBeVisible();
  await expect(ratings.nth(0)).toHaveAttribute('aria-pressed', 'true');
  const bodies = await page.evaluate(() => Reflect.get(window, '__recognitionRegression').bodies);
  expect(bodies).toHaveLength(4);
  expect(bodies[3]).toEqual(bodies[2]);
  await page.locator('.recognition-feedback-actions .recognition-next').click();
  await expect(page.locator('.daily-training-card .learning-word')).toHaveText('date');
  for (let index = 0; index < 3; index++) await expect(ratings.nth(index)).toBeEnabled();
  await expect(page.locator('.learning-error')).toHaveCount(0);
});

// Explicit test responses, isolated from dev:api. No production fallback is installed.
for (const width of [1440, 390, 320]) for (const theme of ['dark', 'light']) {
  test(`unified daily ${theme} ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    await page.goto('/login');
    await page.locator('#username').fill('daily_training_visual');
    await page.locator('#password').fill('example123');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.daily-equation')).toBeVisible();
    await page.evaluate(async () => {
      const audioCalls: { src: string; rate: number }[] = [], audioRequests: string[] = [];
      Reflect.set(window, '__studyAudio', audioCalls); Reflect.set(window, '__studyAudioRequests', audioRequests);
      Object.defineProperty(window, 'Audio', { configurable: true, value: class {
        src: string; playbackRate = 1; currentTime = 0; readyState = 4; onended = null; onerror = null;
        constructor(src: string) { this.src = src; }
        play() { audioCalls.push({ src: this.src, rate: this.playbackRate }); return Promise.resolve(); }
        pause() {} removeAttribute() {} load() {}
      } });
      const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
      const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
      const original = http.defaults.adapter;
      let mode = 'DICTATION', version = 0, count = 0;
      let pronunciation = { autoPlay: false, accent: 'US', playbackRate: 1, repeatCount: 1 };
      const revealedModes = new Set<string>();
      const groups = [{ partOfSpeech: 'n.', meaning: '难以理解的事物；复杂事物；'.repeat(20) }, { partOfSpeech: null, meaning: '保留后端释义顺序。' }];
      const progress = () => ({ batchId: 50, learningDate: '2026-10-25', dailyTarget: 20, taskType: 'DAILY', status: 'IN_PROGRESS', totalCount: 20, completedCount: 6, skippedCount: 0, answerCount: 6, unfamiliarCount: 0, newCount: 20, reviewCount: 0, nextItemId: 51, studyMode: mode, modeVersion: version, trainingCount: count });
      http.defaults.adapter = async (config: { url: string; method: string; data?: string }) => {
        const body = config.data ? JSON.parse(config.data) : {};
        const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data: structuredClone(data) } });
        if (config.url === '/learning/settings' || config.url === '/learning/settings/pronunciation') {
          if (config.method === 'put') pronunciation = body;
          return ok({ dailyTarget: 20, newWordTarget: 10, reviewLimit: 10, pronunciation });
        }
        if (config.url === '/words/1') return ok({ id: 1, word: 'incomprehensibilities', phonetic: '/ˌɪnkɒmprɪhensəˈbɪlɪtiz/' });
        if (config.url.includes('/audio?')) { audioRequests.push(config.url); return { config, status: 200, headers: { 'content-type': 'audio/mpeg' }, data: new Blob(['fixture audio'], { type: 'audio/mpeg' }) }; }
        if (config.url === '/learning/today') return ok({ learningDate: '2026-10-25', dailyTarget: 20, activeCount: 20, dueCount: 0, newCount: 20, unassignedCount: 0, canAddMore: false, task: progress() });
        if (config.url === '/learning-batches/50/daily') return ok(progress());
        if (config.url.endsWith('/daily/mode')) { mode = body.mode; version++; return ok(progress()); }
        if (config.url.endsWith('/training/next')) return ok({ itemId: 51, mode, modeVersion: version, presentationId: `test-${version}-${count}`, attemptNo: count + 1,
          phase: mode === 'RECOGNITION' ? revealedModes.has(mode) ? 'AWAITING_SELF_ASSESSMENT' : 'QUESTION' : 'AWAITING_INPUT', answerRevealed: revealedModes.has(mode), itemStatus: 'PENDING', completionReason: null,
          ...(mode !== 'DICTATION' || revealedModes.has(mode) ? { wordId: 1, word: 'incomprehensibilities', phonetic: '/ˌɪnkɒmprɪhensəˈbɪlɪtiz/' } : {}),
          ...(mode !== 'RECOGNITION' || revealedModes.has(mode) ? { translationGroups: groups } : {}), hintUsed: true, extraTraining: false, progress: progress() });
        if (config.url.endsWith('/training-answer')) { count++; if (body.action === 'REVEAL') revealedModes.add(mode); else revealedModes.delete(mode); return ok({ trainingId: count, itemId: 51, wordId: 1, mode, action: body.action, verdict: body.action === 'REVEAL' ? 'REVEALED' : mode === 'RECOGNITION' ? 'SELF_ASSESSED' : body.input?.trim().toLowerCase() === 'incomprehensibilities' ? 'CORRECT' : 'INCORRECT', input: body.input ?? null, selfAssessment: body.result ?? null, word: 'incomprehensibilities', translationGroups: groups, hintUsed: true, extraTraining: false, attemptNo: count, itemStatus: 'PENDING', completionReason: null, reviewLogId: null, affectsSchedule: false, answeredAt: '2026-10-25T12:00:00', progress: progress() }); }
        return original(config);
      };
      await router.push('/learn/50');
    });
    await expect(page.locator('#daily-training-input')).toBeEnabled();
    await expect(page.locator('#daily-training-input')).toBeFocused();
    await expect(page.getByText('回想拼写，输入你记得的单词', { exact: true })).toHaveCount(0);
    await expect(page.locator('.daily-training-card .letter-slot')).toHaveCount(1);
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(page.locator('.workspace-items')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '专项历史', exact: true })).toHaveCount(0);
    const meaningTool = await page.getByRole('button', { name: '显示中文释义', exact: true }).boundingBox();
    const accentTool = await page.getByRole('button', { name: '英式发音', exact: true }).boundingBox();
    expect(accentTool!.y).toBeCloseTo(meaningTool!.y, 0);
    await expect(page.getByRole('tab', { name: '跟拼练习', exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: '单词练习', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: '朗读单词', exact: true })).toBeDisabled();
    const changeMode = async (label: string) => {
      await page.getByRole('button', { name: '练习设置', exact: true }).click();
      await page.getByRole('radio', { name: label, exact: false }).check();
      await expect(page.locator('.word-practice-modes')).toBeEnabled();
      await page.getByRole('button', { name: '关闭练习设置', exact: true }).click();
    };
    await expect(page.locator('.daily-training-card .learning-word')).toHaveCount(0);
    await page.locator('#daily-training-input').fill('draft');
    await expect(page.locator('.daily-training-card .letter-slot')).toHaveCount(6);
    expect(await page.locator('#daily-training-input').evaluate(node => getComputedStyle(node).outlineStyle)).toBe('none');
    expect(await page.locator('.daily-training-card .letter-slots').evaluate(node => getComputedStyle(node).outlineStyle)).toBe('none');
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`daily-dictation-${theme}-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.locator('#daily-training-input').press('F2');
    await expect(page.locator('.daily-assisted-note')).toBeVisible();
    await expect(page.locator('.daily-training-card .learning-word')).toHaveText('incomprehensibilities');
    await expect(page.locator('.daily-training-card .letter-slot')).toHaveCount(21);
    await expect(page.locator('.daily-word-phonetic')).toBeVisible();
    await page.getByRole('button', { name: '显示音标', exact: true }).click();
    await expect(page.locator('.daily-word-phonetic')).toHaveCount(0);
    await page.getByRole('button', { name: '显示音标', exact: true }).click();
    await expect(page.locator('.daily-word-phonetic')).toBeVisible();
    await page.getByRole('button', { name: '朗读单词', exact: true }).click();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__studyAudioRequests').at(-1))).toContain('accent=US');
    await page.getByRole('button', { name: '英式发音', exact: true }).click();
    await expect(page.getByRole('button', { name: '英式发音', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '练习设置', exact: true }).click();
    await page.getByRole('checkbox', { name: '自动播放', exact: true }).check();
    await page.getByRole('button', { name: '保存发音设置', exact: true }).click();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__studyAudioRequests').at(-1))).toContain('accent=UK');
    const panel = await page.getByRole('region', { name: '练习设置面板' }).boundingBox();
    expect(panel).not.toBeNull();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`daily-settings-${theme}-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: '练习设置面板' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '练习设置', exact: true })).toBeFocused();
    expect(await page.evaluate(() => Reflect.get(window, '__studyAudio').at(-1).src)).toMatch(/^blob:/);
    await page.locator('#daily-training-input').fill('incom');
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`daily-follow-${theme}-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '显示中文释义', exact: true }).click();
    await expect(page.locator('.daily-training-card .word-meaning')).toHaveCount(0);
    await page.getByRole('button', { name: '显示中文释义', exact: true }).click();
    await expect(page.locator('.daily-training-card .word-meaning')).toBeVisible();
    await page.getByRole('button', { name: '显示中文释义', exact: true }).click();
    await expect(page.locator('.daily-training-card .word-meaning')).toHaveCount(0);
    await changeMode('单词拼读');
    await changeMode('单词默写');
    await expect(page.locator('.daily-training-card .word-meaning')).toBeVisible();
    await expect(page.locator('.workspace-history')).toHaveCount(0);
    await expect(page.getByText('学习计划与任务设置', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '朗读单词', exact: true })).toBeEnabled();
    await expect(page.locator('#daily-training-input')).toHaveValue('incom');
    await page.locator('#daily-training-input').fill('draft');
    await page.locator('#daily-training-input').press('Enter');
    await expect(page.locator('.daily-training-feedback.is-incorrect')).toBeVisible();
    await expect(page.locator('.dictation-submitted-word')).toHaveText('draft');
    await expect(page.locator('.dictation-answer-verdict')).toHaveText('拼写错误');
    await expect(page.locator('.dictation-feedback-answer .learning-word')).toHaveText('incomprehensibilities');
    await expect(page.locator('.dictation-feedback-answer .daily-word-phonetic')).toHaveText('/ˌɪnkɒmprɪhensəˈbɪlɪtiz/');
    await expect(page.locator('.dictation-feedback-heading .training-play')).toBeVisible();
    const answerY = (await page.locator('.dictation-feedback-answer').boundingBox())!.y;
    const meaningY = (await page.locator('.dictation-answer-feedback .word-meaning').boundingBox())!.y;
    const inputY = (await page.locator('.dictation-submitted-word').boundingBox())!.y;
    expect(answerY).toBeLessThan(meaningY); expect(meaningY).toBeLessThan(inputY);
    await expect(page.locator('.dictation-answer-feedback .workspace-answer-actions button')).toHaveCount(1);
    const feedbackColor = await page.locator('.dictation-submitted-word').evaluate(node => {
      const color = getComputedStyle(node).color.match(/\d+/g)?.map(Number) ?? [];
      return color[0]! > color[1]! && color[0]! > color[2]!;
    });
    expect(feedbackColor).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`daily-dictation-error-${theme}-${width}.png`), fullPage: true, animations: 'disabled' });
    await expect(page.getByRole('button', { name: '下一个 Enter' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#daily-training-input')).toBeFocused();
    await expect(page.locator('#daily-training-input')).toHaveValue('');
    await expect(page.locator('.daily-training-card .letter-slot')).toHaveCount(1);
    await page.locator('#daily-training-input').fill('incomprehensibilities');
    await page.locator('#daily-training-input').press('Enter');
    await expect(page.locator('.dictation-submitted-word')).toHaveText('incomprehensibilities');
    await expect(page.locator('.dictation-answer-verdict')).toHaveText('拼写正确');
    const correctColor = await page.locator('.dictation-submitted-word').evaluate(node => {
      const color = getComputedStyle(node).color.match(/\d+/g)?.map(Number) ?? [];
      return color[1]! > color[0]!;
    });
    expect(correctColor).toBe(true);
    await expect(page.getByRole('button', { name: '下一个 Enter' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#daily-training-input')).toBeFocused();
    await page.keyboard.type('draft');
    await expect(page.locator('#daily-training-input')).toHaveValue('draft');
    await expect(page.getByRole('button', { name: '不会／看答案', exact: true })).toHaveAttribute('aria-keyshortcuts', 'F2');
    await page.locator('#daily-training-input').press('F2');
    await expect(page.locator('.daily-assisted-note')).toBeVisible();
    await expect(page.locator('.daily-training-card .learning-word')).toHaveText('incomprehensibilities');
    await expect(page.getByRole('button', { name: '已查看答案', exact: true })).toBeDisabled();
    await expect(page.locator('#daily-training-input')).toHaveValue('draft');
    await page.screenshot({ path: testInfo.outputPath(`daily-assisted-${theme}-${width}.png`), fullPage: true, animations: 'disabled' });
    await changeMode('单词拼读');
    await expect(page.locator('.daily-training-card .word-meaning')).toHaveCount(0);
    await page.locator('#mode-panel-words').focus(); await page.keyboard.press('Space');
    await expect(page.locator('.daily-training-card .word-meaning')).toBeVisible();
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`daily-recognition-${theme}-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.evaluate(async () => {
      const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
      const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
      const original = http.defaults.adapter;
      const day = { learningDate: '2026-10-25', trainingCount: 1, answerCount: 0, studiedCount: 1, completedCount: 0, recalledCount: 0, hasLearningActivity: true, hasRecordedAnswers: false, statisticsComplete: true, incompleteWordCount: 0 };
      const coverage = { dataScope: 'RECORDED_ANSWERS_AND_DAILY_ITEMS', coverageScope: 'ALL_RETAINED_SOURCE_ITEMS', statisticsComplete: true, incompleteWordCount: 0, firstRecordedAt: '2026-10-25T12:00:00', lastRecordedAt: '2026-10-25T12:00:00' };
      http.defaults.adapter = async (config: { url: string; params?: { days?: number } }) => {
        const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data } });
        if (config.url.endsWith('/statistics/summary')) return ok({ learningDate: day.learningDate, source: 'DAILY', hasStudiedToday: true, todayTrainingCount: 1, todayAnswerCount: 0, todayStudiedCount: 1, todayCompletedCount: 0, todayRecalledCount: 0, currentStreak: 1, longestStreak: 1, totalStudyDays: 1, goal: { dailyTarget: 20, completedCount: 0, remainingCount: 20, reached: false, targetSource: 'TASK_SNAPSHOT', batchId: 50, taskStatus: 'IN_PROGRESS' }, coverage });
        if (config.url.endsWith('/statistics/trends')) return ok({ source: 'DAILY', days: 7, from: '2026-10-19', to: day.learningDate, totalTrainingCount: 1, totalAnswerCount: 0, totalCompletedCount: 0, totalRecalledCount: 0, coverage, records: Array.from({ length: 7 }, (_, index) => ({ ...day, learningDate: `2026-10-${19 + index}`, ...(index === 6 ? {} : { trainingCount: 0, studiedCount: 0, hasLearningActivity: false }) })) });
        if (config.url.endsWith('/statistics/daily')) return ok({ ...day, newCompletedCount: 0, reviewCompletedCount: 0, unfamiliarCount: 0 });
        if (config.url.endsWith('/statistics/calendar')) return ok({ month: '2026-10', statisticsComplete: true, days: Array.from({ length: 31 }, (_, index) => ({ ...day, learningDate: `2026-10-${String(index + 1).padStart(2, '0')}`, ...(index === 24 ? {} : { trainingCount: 0, studiedCount: 0, hasLearningActivity: false }) })) });
        if (config.url.endsWith('/statistics/training')) return ok({ learningDate: day.learningDate, completedWordCount: 0, modes: [] });
        if (config.url.endsWith('/statistics/words')) return ok({ page: 1, size: 15, total: 0, records: [] });
        return original(config);
      };
      await router.push('/statistics');
    });
    await expect(page.locator('.overview-day')).toContainText('当天有学习活动');
    await expect(page.locator('.overview-calendar-grid button[aria-label*="2026-10-25"]')).toHaveAttribute('aria-label', /完成 0 词.*有学习活动/);
    await expect(page.locator('.statistics-bar-column').last()).toHaveAttribute('aria-label', /完成 0 词.*有学习活动/);
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`training-statistics-${theme}-${width}.png`), fullPage: true, animations: 'disabled' });
  });
}
