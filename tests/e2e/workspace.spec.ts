import { expect, test } from '@playwright/test';

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
    const control = { loseResponse: false, alerts: 0, bodies: [] as Record<string, unknown>[] };
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
    http.defaults.adapter = async (config: { url: string; data?: string }) => {
      const body = config.data ? JSON.parse(config.data) : {};
      const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data: structuredClone(data) } });
      if (config.url === '/learning/today') return ok({ learningDate: '2026-10-25', dailyTarget: 4, activeCount: 4, dueCount: 0, newCount: 4, unassignedCount: 0, canAddMore: false, task: progress() });
      if (config.url === '/learning-batches/90/daily') return ok(progress());
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
          input: null, selfAssessment: body.result, word: words[index], translation: `释义 ${index + 1}`, translationGroups: [], hintUsed: true, extraTraining: false, attemptNo: 1,
          reviewLogId: null, affectsSchedule: false, answeredAt: '2026-10-25T12:00:00', itemStatus: body.result === 1 ? 'DONE' : 'RELEARNING', completionReason: body.result === 1 ? 'RECALLED' : null, progress: progress() };
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
    await ratings.nth(2).click();
    await expect(page.getByRole('status').filter({ hasText: '正在保存' })).toBeVisible();
    await expect(page.locator('.learning-error')).toHaveCount(0);
    await page.evaluate(() => document.querySelectorAll<HTMLButtonElement>('.daily-training-rating button').forEach(button => button.click()));
    await expect(page.locator('.daily-training-feedback')).toBeVisible();
    await page.locator('.daily-training-feedback > .btn').click();
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
  const bodies = await page.evaluate(() => Reflect.get(window, '__recognitionRegression').bodies);
  expect(bodies).toHaveLength(4);
  expect(bodies[3]).toEqual(bodies[2]);
  await page.locator('.daily-training-feedback > .btn').click();
  await expect(page.locator('.daily-training-card .learning-word')).toHaveText('date');
  for (let index = 0; index < 3; index++) await expect(ratings.nth(index)).toBeEnabled();
  await expect(page.locator('.learning-error')).toHaveCount(0);
});

// Explicit test responses, isolated from dev:api. No production fallback is installed.
for (const width of [1440, 390, 320]) for (const theme of ['dark', 'light']) {
  test(`unified daily ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    await page.goto('/login');
    await page.locator('#username').fill('daily_training_visual');
    await page.locator('#password').fill('example123');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.daily-equation')).toBeVisible();
    await page.evaluate(async () => {
      const spoken: { text: string; lang: string }[] = [];
      Reflect.set(window, '__studySpeech', spoken);
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class {
        text: string; lang = ''; rate = 1;
        constructor(text: string) { this.text = text; }
      } });
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
        cancel() {}, getVoices: () => [],
        speak: (utterance: { text: string; lang: string }) => spoken.push({ text: utterance.text, lang: utterance.lang }),
      } });
      const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
      const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
      const original = http.defaults.adapter;
      let mode = 'DICTATION', version = 0, count = 0;
      const revealedModes = new Set<string>();
      const groups = [{ partOfSpeech: 'n.', meaning: '难以理解的事物；复杂事物；'.repeat(20) }, { partOfSpeech: null, meaning: '保留后端释义顺序。' }];
      const progress = () => ({ batchId: 50, learningDate: '2026-10-25', dailyTarget: 20, taskType: 'DAILY', status: 'IN_PROGRESS', totalCount: 20, completedCount: 6, skippedCount: 0, answerCount: 6, unfamiliarCount: 0, newCount: 20, reviewCount: 0, nextItemId: 51, studyMode: mode, modeVersion: version, trainingCount: count });
      http.defaults.adapter = async (config: { url: string; method: string; data?: string }) => {
        const body = config.data ? JSON.parse(config.data) : {};
        const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data: structuredClone(data) } });
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
    await expect(page.locator('.daily-training-card .letter-slot')).toHaveCount(1);
    await expect(page.getByRole('tab')).toHaveCount(2);
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
    await page.screenshot({ path: `docs/screenshots/daily-dictation-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await changeMode('跟拼');
    await expect(page.locator('.daily-training-card .learning-word')).toHaveText('incomprehensibilities');
    await expect(page.locator('.daily-training-card .letter-slot')).toHaveCount(21);
    await expect(page.locator('.daily-word-phonetic')).toBeVisible();
    await page.getByRole('button', { name: '显示音标', exact: true }).click();
    await expect(page.locator('.daily-word-phonetic')).toHaveCount(0);
    await page.getByRole('button', { name: '显示音标', exact: true }).click();
    await expect(page.locator('.daily-word-phonetic')).toBeVisible();
    await page.getByRole('button', { name: '朗读单词', exact: true }).click();
    expect(await page.evaluate(() => Reflect.get(window, '__studySpeech').at(-1))).toEqual({ text: 'incomprehensibilities', lang: 'en-US' });
    await page.getByRole('button', { name: '练习设置', exact: true }).click();
    await page.getByRole('combobox', { name: '发音口音' }).selectOption('en-GB');
    await page.getByRole('switch', { name: '自动朗读单词' }).check();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__studySpeech').at(-1)?.lang)).toBe('en-GB');
    const panel = await page.getByRole('region', { name: '练习设置面板' }).boundingBox();
    expect(panel).not.toBeNull();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `docs/screenshots/daily-settings-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: '练习设置面板' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '练习设置', exact: true })).toBeFocused();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wordtrail.study.preferences') || '{}'))).toMatchObject({ accent: 'en-GB', autoPronounce: true });
    await page.locator('#daily-training-input').fill('incom');
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/daily-follow-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '显示中文释义', exact: true }).click();
    await expect(page.locator('.daily-training-card .word-meaning')).toHaveCount(0);
    await page.getByRole('button', { name: '显示中文释义', exact: true }).click();
    await expect(page.locator('.daily-training-card .word-meaning')).toBeVisible();
    await changeMode('单词默写');
    await expect(page.getByRole('button', { name: '朗读单词', exact: true })).toBeDisabled();
    await expect(page.locator('#daily-training-input')).toHaveValue('draft');
    await page.locator('#daily-training-input').press('Enter');
    await expect(page.locator('.daily-training-feedback.is-incorrect')).toBeVisible();
    await expect(page.locator('.daily-feedback-error')).toContainText('拼写错误');
    await expect(page.locator('.daily-submitted.is-incorrect del')).toHaveText('draft');
    await expect(page.locator('.daily-feedback-answer-label')).toHaveText('正确拼写');
    const feedbackColor = await page.locator('.daily-feedback-error').evaluate(node => {
      const color = getComputedStyle(node).color.match(/\d+/g)?.map(Number) ?? [];
      return color[0]! > color[1]! && color[0]! > color[2]!;
    });
    expect(feedbackColor).toBe(true);
    await page.screenshot({ path: `docs/screenshots/daily-dictation-error-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.locator('.daily-training-feedback > .btn').click();
    await expect(page.locator('#daily-training-input')).toBeFocused();
    await expect(page.locator('#daily-training-input')).toHaveValue('');
    await expect(page.locator('.daily-training-card .letter-slot')).toHaveCount(1);
    await page.keyboard.type('draft');
    await expect(page.locator('#daily-training-input')).toHaveValue('draft');
    await expect(page.getByRole('button', { name: '不会／看答案', exact: true })).toHaveAttribute('aria-keyshortcuts', 'F2');
    await page.locator('#daily-training-input').press('F2');
    await expect(page.locator('.daily-assisted-note')).toBeVisible();
    await expect(page.locator('.daily-training-card .learning-word')).toHaveText('incomprehensibilities');
    await expect(page.getByRole('button', { name: '已查看答案', exact: true })).toBeDisabled();
    await expect(page.locator('#daily-training-input')).toHaveValue('draft');
    await page.screenshot({ path: `docs/screenshots/daily-assisted-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await changeMode('单词拼读');
    await expect(page.locator('.daily-training-card .word-meaning')).toHaveCount(0);
    await page.locator('.daily-training-card').click(); await page.keyboard.press('Space');
    await expect(page.locator('.daily-training-card .word-meaning')).toBeVisible();
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/daily-recognition-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
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
    await expect(page.locator('.insights-today-status.recorded')).toBeVisible();
    await expect(page.locator('.calendar-day.has-activity')).toHaveAttribute('aria-label', /训练 1 次.*作答 0 次.*完成 0 词.*有学习活动/);
    await expect(page.locator('.trend-zero-note')).toHaveCount(0);
    await expect(page.locator('.trend-readout')).toContainText('训练 1 次');
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/training-statistics-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
  });
}
