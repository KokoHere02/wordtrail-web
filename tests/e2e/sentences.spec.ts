import { expect, test } from '@playwright/test';

for (const [width, theme] of [[1440, 'light'], [390, 'dark'], [320, 'light']] as const) {
  test(`sentence library tabs and controls ${theme} ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(theme => localStorage.setItem('wordtrail.theme', theme), theme);
    await page.goto('/login'); await page.locator('#username').fill('sentence_library_reader'); await page.locator('#password').fill('example123'); await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.daily-equation')).toBeVisible();
    await page.evaluate(async () => {
      const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
      const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
      const fallback = http.defaults.adapter, base = '/sentence-translation';
      const calls: unknown[] = []; Reflect.set(window, '__sentenceLibraryCalls', calls);
      const favorite = new Set([1]);
      let note = { content: '核对否定范围，再看句子时态。', errorTags: ['NEGATION'], attemptId: 77, version: 1, updatedAt: '2026-10-28T12:00:00' };
      const questions = [1, 2, 3].map(id => ({ sentenceId: id, englishText: id === 1 ? 'Although the journey was longer than expected, she continued to read every day.' : `I read an interesting book in the library today, sentence ${id}.`, referenceTranslation: '尽管旅途比预期更长，她仍然每天阅读。', explanation: '核对让步关系、句子结构和时态。', difficulty: id === 1 ? 2 : 1, source: '阅读笔记', sourceReference: '章节示例', status: 'ACTIVE', version: 3, wordIds: id === 1 ? [1001] : [], linkedWords: id === 1 ? [{ wordId: 1001, word: 'abandon' }] : [] }));
      const history = { attemptId: 77, sessionId: 650, itemId: 850, sentenceId: 1, englishText: questions[0]!.englishText, action: 'ANSWER', translation: '虽然路程更长，她还是每天阅读。', referenceTranslation: questions[0]!.referenceTranslation, explanation: questions[0]!.explanation, selfAssessment: 'PARTIAL', learningDate: '2026-10-28', submittedAt: '2026-10-28T12:00:00', reviewDate: '2026-10-28', reviewedAt: '2026-10-28T12:01:00' };
      http.defaults.adapter = async (config: { url: string; method: string; params?: Record<string, string | number>; data?: string }) => {
        const body = config.data ? JSON.parse(config.data) : undefined;
        calls.push({ url: config.url, method: config.method, params: config.params, body });
        const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', data: structuredClone(data) } });
        const paged = (rows: unknown[]) => ok({ page: 1, size: 10, total: rows.length, records: rows });
        if (config.url === '/words') return paged([{ id: 1001, word: 'abandon', phonetic: '/əˈbændən/', translation: '放弃；遗弃' }]);
        if (config.url === `${base}/management/access`) return ok({ canManage: true });
        if (config.url === `${base}/questions` || config.url === `${base}/favorites`) return paged(questions.filter(row => (!config.params?.difficulty || row.difficulty === config.params.difficulty) && (!config.params?.wordId || row.wordIds.includes(Number(config.params.wordId))) && (config.url.endsWith('/questions') || favorite.has(row.sentenceId))).map(row => ({ ...row, favorite: favorite.has(row.sentenceId) })));
        if (config.url.endsWith('/favorite')) { const id = Number(config.url.split('/')[3]); if (body.favorite) favorite.add(id); else favorite.delete(id); return ok({ sentenceId: id, favorite: body.favorite }); }
        if (config.url === `${base}/review-queue`) return paged([{ sentenceId: 1, englishText: questions[0]!.englishText, difficulty: 2, available: true, attemptId: 77, selfAssessment: 'PARTIAL', reviewedAt: '2026-10-28T12:01:00' }]);
        if (config.url === `${base}/reviews/due`) return paged([{ ...questions[0], reviewLevel: 2, lastAssessment: 'PARTIAL', nextReviewDate: '2026-10-28' }]);
        if (config.url === `${base}/notes`) return paged([{ sentenceId: 1, englishText: questions[0]!.englishText, available: true, note }]);
        if (config.url.endsWith('/questions/1/note')) { if (config.method === 'put') note = { ...body, version: note.version + 1, updatedAt: '2026-10-28T12:05:00' }; return ok(note); }
        if (config.url.endsWith('/questions/1/history')) return paged([history]);
        if (config.url.endsWith('/questions/1/schedule')) return ok({ sentenceId: 1, lastAttemptId: 77, reviewLevel: 2, lastAssessment: 'PARTIAL', reviewedAt: '2026-10-28T12:01:00', nextReviewDate: '2026-10-29' });
        if (config.url === `${base}/management/questions`) return paged(questions);
        if (config.url === `${base}/management/questions/1`) return ok(questions[0]);
        return fallback(config);
      };
      await router.push('/sentences');
    });
    const nav = page.getByRole('navigation', { name: '句子练习导航' });
    const noOverflow = async () => expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('.sentence-question-row')).toHaveCount(3);
    const difficulty = page.getByRole('combobox', { name: /^难度/ });
    await difficulty.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await expect(difficulty).toContainText('进阶'); await page.getByRole('button', { name: '应用筛选', exact: true }).click();
    await expect(page.locator('.sentence-question-row')).toHaveCount(1);
    expect(await page.evaluate(() => (Reflect.get(window, '__sentenceLibraryCalls') as { url: string; params?: { difficulty?: number } }[]).filter(call => call.url === '/sentence-translation/questions').at(-1)?.params?.difficulty)).toBe(2);
    await difficulty.click(); await page.keyboard.press('Escape'); await expect(page.getByRole('listbox')).toHaveCount(0);
    await page.getByRole('button', { name: '选择关联单词', exact: true }).click();
    const picker = page.getByRole('dialog', { name: '选择关联单词', exact: true });
    await expect(picker.getByRole('searchbox')).toBeFocused(); await picker.getByRole('searchbox').fill('aban'); await picker.getByRole('button', { name: '查找', exact: true }).click();
    await expect(picker.locator('.sentence-word-option')).toHaveCount(1); await noOverflow();
    await page.screenshot({ path: testInfo.outputPath('word-picker.png'), animations: 'disabled' });
    await picker.getByRole('button', { name: '选用 abandon', exact: true }).click(); await expect(picker).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'abandon', exact: true })).toBeFocused();
    await page.locator('.sentence-question-row').first().getByRole('button', { name: '作答历史', exact: true }).click();
    const history = page.getByRole('dialog', { name: '单句作答历史', exact: true });
    await expect(history.locator('.sentence-history-row')).toHaveCount(1); await history.getByRole('button', { name: '当前复习安排', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '个人复习安排', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(2); await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(1); expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await expect(history.getByRole('button', { name: '当前复习安排', exact: true })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('sentence-history.png'), animations: 'disabled' });
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    for (const [label, selector] of [['收藏', '.sentence-question-row'], ['待巩固', '.sentence-question-row'], ['到期复习', '.sentence-due-date'], ['个人笔记', '.sentence-note-row']] as const) {
      await nav.getByRole('link', { name: label, exact: true }).click(); await expect(page.locator(selector).first()).toBeVisible();
      await expect(nav.locator('[aria-current="page"]')).toHaveText(label); await noOverflow();
      await page.screenshot({ path: testInfo.outputPath(`${label}.png`), animations: 'disabled' });
    }
    await page.getByRole('button', { name: '编辑笔记', exact: true }).click();
    await expect(page.locator('#sentence-note-1')).toBeEnabled(); await page.locator('#sentence-note-1').fill('<b>纯文本笔记</b>\n核对否定范围。');
    await page.getByRole('checkbox', { name: '时态', exact: true }).check();
    const attempt = page.getByRole('combobox', { name: /^关联作答/ }); await attempt.click(); await page.getByRole('option', { name: '不关联作答', exact: true }).click();
    await attempt.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
    await expect(attempt).toContainText('原关联作答 #77'); await page.getByRole('button', { name: '保存笔记', exact: true }).click();
    await expect(page.locator('.sentence-note-content')).toContainText('<b>纯文本笔记</b>'); await expect(page.locator('.sentence-note-content b')).toHaveCount(0);
    expect(await page.evaluate(() => (Reflect.get(window, '__sentenceLibraryCalls') as { method: string; url: string; body?: { attemptId: unknown } }[]).filter(call => call.method === 'put' && call.url.endsWith('/note')).at(-1)?.body?.attemptId)).toBe(77);
    await nav.getByRole('link', { name: '题库维护', exact: true }).click(); await expect(page.locator('.sentence-managed-row')).toHaveCount(3); await noOverflow();
    await page.screenshot({ path: testInfo.outputPath('management.png'), animations: 'disabled' });
    await page.locator('.sentence-managed-row').first().getByRole('link').click(); await expect(page.locator('#sentence-english')).toHaveValue(/Although/); await noOverflow();
    await expect(page.getByRole('combobox', { name: /^难度/ })).toContainText('进阶');
    await page.screenshot({ path: testInfo.outputPath('editor.png'), animations: 'disabled' });
    await page.getByRole('link', { name: '返回题库维护', exact: true }).click(); await page.getByRole('link', { name: 'CSV 导入', exact: true }).click();
    await page.locator('#sentence-csv-text').fill('englishText,referenceTranslation,explanation,difficulty,source\nA sample sentence.,示例,解析,1,阅读笔记');
    await page.getByRole('button', { name: '上传 CSV', exact: true }).click(); await expect(page.locator('#sentence-csv-file')).toBeVisible(); await noOverflow();
    await page.screenshot({ path: testInfo.outputPath('csv-import.png'), animations: 'disabled' });
  });
}

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
        if (config.url.endsWith('/statistics/calendar')) return ok({ month: '2026-10', days: [{ date: '2026-10-24', hasActivity: true, submissionCount: 1, answerCount: 1, revealCount: 0, selfReviewCount: 1 }] });
        if (config.url.endsWith('/statistics/daily')) return ok({ date: '2026-10-24', hasActivity: true, submissionCount: 1, answerCount: 1, revealCount: 0, selfReviewCount: 1 });
        if (config.url.endsWith('/statistics')) return ok({ currentStreak: 3, longestStreak: 5, submissionCount: 120, answerCount: 90, revealCount: 30, selfReviewCount: 115, weakSentenceCount: 6, dueSentenceCount: 1, learningDayCount: 32, from: '2026-10-18', to: '2026-10-24', days: Array.from({ length: config.params?.days || 7 }, (_, index) => ({ learningDate: `2026-10-${String(index + 1).padStart(2, '0')}`, submissionCount: index % 5, answerCount: index % 5, revealCount: 0, selfReviewCount: (index + 1) % 5 })) });
        throw new Error(`Unexpected expansion fixture endpoint ${config.url}`);
      };
      await router.push('/sentences/manage');
    });
    for (const [path, selector, name] of [
      ['/sentences/manage', '.sentence-managed-row', 'management'],
      ['/sentences/manage/1/edit', '#sentence-explanation', 'editor'],
      ['/sentences/manage/import', '#sentence-csv-text', 'import'],
      ['/sentences/due', '.sentence-due-date', 'due'],
      ['/sentences/statistics', '.overview-streaks', 'statistics'],
    ]) {
      await page.evaluate(async target => { const modulePath = '/src/router/index.ts'; const { router } = await import(/* @vite-ignore */ modulePath); await router.push(target); }, path!);
      await expect(page.locator(selector!)).toBeVisible();
      expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `docs/screenshots/sentence-${name}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    }
    await page.getByRole('button', { name: '最近 30 天', exact: true }).click();
    await expect(page.locator('.statistics-bar-column')).toHaveCount(30);
    expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
