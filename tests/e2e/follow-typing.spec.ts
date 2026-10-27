import { expect, test, type Page } from '@playwright/test';

// Explicit HTTP route fixtures persist on the test side across real page reloads.
async function setup(page: Page, existing = false) {
  const daily = { batchId: 50, taskType: 'DAILY', learningDate: '2026-10-27', dailyTarget: 30, studyMode: 'RECOGNITION', modeVersion: 0, status: 'IN_PROGRESS', totalCount: 1, completedCount: 0, skippedCount: 0, answerCount: 0, unfamiliarCount: 0, newCount: 1, reviewCount: 0, nextItemId: 501, trainingCount: 0 };
  const control = { creates: 0, nexts: 0, answers: [] as Record<string, unknown>[], day: '2026-10-27', loseAnswer: false, noWords: false, urls: [] as string[], audioAuth: false, daily };
  const saved = new Map<string, unknown>();
  const pronunciation = { autoPlay: false, accent: 'UK', playbackRate: .75, repeatCount: 1 };
  let task = { batchId: 880, taskType: 'PRACTICE', learningDate: null, dailyTarget: 0, studyMode: 'FOLLOW_TYPING', modeVersion: 0, status: existing ? 'IN_PROGRESS' : 'NONE', totalCount: 1, followTypingTarget: 20, completedCount: 0, skippedCount: 0, answerCount: 0, unfamiliarCount: 0, newCount: 0, reviewCount: 0, nextItemId: 101 as number | null, trainingCount: 0 };
  const user = { id: 7, username: 'follow_browser_fixture', nickname: '跟拼测试' };
  await page.addInitScript(() => sessionStorage.setItem('wordtrail.refresh', 'fixture-refresh'));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const path = url.pathname.slice(4), body = request.postDataJSON();
    control.urls.push(`${request.method()} ${path}`);
    const json = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'OK', data }) });
    if (path === '/auth/refresh') return json({ accessToken: 'fixture-access', refreshToken: 'fixture-refresh', user });
    expect(request.headers()['authorization']).toBe('Bearer fixture-access');
    if (path === '/auth/me') return json(user);
    if (path === '/learning/settings') return json({ dailyTarget: 30, preferredStudyMode: 'RECOGNITION', newWordTarget: 10, reviewLimit: 20, pronunciation });
    if (path === '/learning/today') return json({ learningDate: daily.learningDate, dailyTarget: 30, activeCount: 1, dueCount: 0, newCount: 1, unassignedCount: 0, canAddMore: false, task: daily });
    if (path === '/learning-batches/50/daily') return json(daily);
    if (path === '/learning-batches/50/daily/training/next') return json({ itemId: 501, wordId: 50, word: 'apple', mode: 'RECOGNITION', modeVersion: 0, phase: 'QUESTION', presentationId: 'daily-display', attemptNo: 1, answerRevealed: false, hintUsed: false, extraTraining: false, itemStatus: 'PENDING', completionReason: null, progress: daily });
    if (path.includes('/audio')) {
      control.audioAuth = true; expect(url.searchParams.has('token')).toBe(false); expect(url.searchParams.get('accent')).toBe('UK');
      const data = Buffer.alloc(44 + 1600), text = (offset: number, value: string) => data.write(value, offset);
      text(0, 'RIFF'); data.writeUInt32LE(data.length - 8, 4); text(8, 'WAVE'); text(12, 'fmt '); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(8000, 24); data.writeUInt32LE(16000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); text(36, 'data'); data.writeUInt32LE(1600, 40);
      return route.fulfill({ status: 200, contentType: 'audio/wav', body: data });
    }
    if (path === '/learning/follow-typing/statistics') return json({ learningDate: url.searchParams.get('date') || control.day, answerCount: task.trainingCount, correctCount: task.completedCount, inputAccuracy: task.trainingCount ? task.completedCount / task.trainingCount : null, practicedWordCount: task.trainingCount ? 1 : 0, completedWordCount: task.completedCount, lastPracticedAt: task.trainingCount ? `${control.day}T12:00:00` : null });
    if (path === '/learning/follow-typing/batches') {
      if (request.method() === 'GET') return json({ page: 1, size: 20, total: task.status === 'IN_PROGRESS' ? 1 : 0, records: task.status === 'IN_PROGRESS' ? [task] : [] });
      expect(body.count).toBeGreaterThanOrEqual(10); expect(body.count).toBeLessThanOrEqual(20);
      if (control.noWords) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'NO_FOLLOW_TYPING_WORDS', message: '暂无可用词' }) });
      control.creates++; task = { ...task, batchId: 879 + control.creates, status: 'IN_PROGRESS', followTypingTarget: body.count, trainingCount: 0, completedCount: 0, answerCount: 0, nextItemId: 101 }; return json(task);
    }
    if (path === `/learning/follow-typing/batches/${task.batchId}`) return json(task);
    if (path.endsWith('/next')) {
      control.nexts++;
      return json(task.status === 'COMPLETED' ? null : { itemId: 101, wordId: 88, word: 'incomprehensibilities', phonetic: '/ˌɪnkɒmprɪhensəˈbɪlɪtiz/', translation: '难以理解的事物；复杂事物；'.repeat(5), phase: 'AWAITING_INPUT', mode: 'FOLLOW_TYPING', modeVersion: 0, presentationId: `display-${task.batchId}-${task.trainingCount}`, attemptNo: task.trainingCount + 1, answerRevealed: false, hintUsed: true, extraTraining: false, itemStatus: 'PENDING', completionReason: null, pronunciation, audioUrl: `/api/learning-batches/${task.batchId}/training/items/101/audio?presentationId=display-${task.trainingCount}&modeVersion=0&accent=UK`, progress: task });
    }
    if (path.endsWith('/answer')) {
      control.answers.push(body); expect(Object.keys(body).sort()).toEqual(['action', 'attemptNo', 'input', 'modeVersion', 'presentationId', 'requestId']); expect(body.action).toBe('ANSWER');
      if (saved.has(body.requestId)) return json({ ...saved.get(body.requestId) as object, progress: task });
      expect(body.presentationId).toBe(`display-${task.batchId}-${task.trainingCount}`); expect(body.attemptNo).toBe(task.trainingCount + 1);
      task.trainingCount++; const correct = body.input.trim().toLowerCase() === 'incomprehensibilities';
      if (correct) { task.completedCount = 1; task.answerCount = 1; task.status = 'COMPLETED'; task.nextItemId = null; }
      const answer = { trainingId: task.trainingCount, itemId: 101, wordId: 88, word: 'incomprehensibilities', mode: 'FOLLOW_TYPING', action: 'ANSWER', verdict: correct ? 'CORRECT' : 'INCORRECT', input: body.input, selfAssessment: null, hintUsed: true, extraTraining: false, attemptNo: body.attemptNo, reviewLogId: null, affectsSchedule: false, itemStatus: correct ? 'DONE' : 'PENDING', completionReason: correct ? 'FOLLOW_TYPED' : null, answeredAt: `${control.day}T12:00:00`, progress: structuredClone(task) };
      saved.set(body.requestId, answer);
      if (control.loseAnswer) { control.loseAnswer = false; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'TEMPORARY', message: 'fixture lost response after save' }) }); }
      return json(answer);
    }
    if (path.endsWith('/abandon')) { task.status = 'ABANDONED'; task.nextItemId = null; return json(task); }
    throw new Error(`Unexpected API in isolated follow UI: ${request.method()} ${path}`);
  });
  return control;
}
async function chooseMode(page: Page, label: string) {
  await page.getByRole('button', { name: '练习设置', exact: true }).click();
  await page.getByRole('radio', { name: label, exact: false }).check();
  await page.getByRole('button', { name: '关闭练习设置', exact: true }).click();
  if (label === '跟拼') { await expect(page.locator('#follow-typing-input')).toBeEnabled(); await page.locator('#follow-typing-input').focus(); }
}
test('follow survives reload/cross-day and lost save without duplicate training or DAILY writes', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/follow-typing'); await expect(page.locator('#follow-typing-input')).toBeEnabled(); await expect(page).toHaveURL(/\/learn\?mode=follow&followBatchId=880$/);
  expect(state.creates).toBe(1); expect(state.urls.indexOf('GET /learning/follow-typing/batches')).toBeLessThan(state.urls.indexOf('POST /learning/follow-typing/batches'));
  await page.locator('#follow-typing-input').fill('wrong'); await page.locator('#follow-typing-input').press('Enter'); await expect(page.locator('.follow-input-feedback.is-error')).toContainText('再试一次'); await expect(page.locator('#follow-typing-input')).toBeFocused(); await expect(page.locator('#follow-typing-input')).toHaveValue('wrong');
  state.day = '2026-10-28'; await page.reload(); await expect(page.locator('#follow-typing-input')).toBeEnabled(); expect(state.creates).toBe(1); await expect(page.locator('.workspace-meta')).toContainText('本轮输入 1 次');
  await page.getByRole('button', { name: '朗读单词', exact: true }).click(); await expect.poll(() => state.audioAuth).toBe(true);
  state.loseAnswer = true; await page.locator('#follow-typing-input').fill(' incomprehensibilities '); await page.locator('#follow-typing-input').press('Enter'); await expect(page.getByRole('button', { name: '重试原输入请求', exact: true })).toBeEnabled(); const body = state.answers.at(-1);
  await page.reload(); await expect(page.getByRole('button', { name: '重试原输入请求', exact: true })).toBeEnabled(); await page.getByRole('button', { name: '重试原输入请求', exact: true }).click(); await expect(page.getByRole('heading', { name: '本轮跟拼完成', exact: true })).toBeVisible();
  expect(state.answers.at(-1)).toEqual(body); expect(state.creates).toBe(1); await expect(page.locator('.follow-completion')).toContainText('输入 2 次'); await page.getByRole('button', { name: '学习统计', exact: true }).click(); await expect(page.locator('.follow-date-statistics')).toContainText('50.0%');
  expect(state.urls.every(url => !/\/daily|\/learning\/today|correction|weak-words|consolidation/.test(url))).toBe(true);
  await page.getByRole('combobox', { name: /下一轮词数/ }).click(); await page.getByRole('option', { name: '10 词', exact: true }).click(); await page.getByRole('button', { name: '开始新一轮', exact: true }).click(); await expect(page).toHaveURL(/\/learn\?mode=follow&followBatchId=881$/); await expect(page.locator('.workspace-meta')).toContainText('申请 10 词');
  await page.getByRole('button', { name: '练习设置', exact: true }).click(); await page.getByRole('button', { name: '放弃本轮', exact: true }).click(); await page.getByRole('dialog', { name: '放弃本轮跟拼？', exact: true }).getByRole('button', { name: '放弃本轮', exact: true }).click(); await expect(page.getByRole('heading', { name: '本轮已放弃', exact: true })).toBeVisible(); state.noWords = true;
  await page.getByRole('button', { name: '开始新一轮', exact: true }).click(); await expect(page.locator('.learning-error')).toContainText('冷却'); expect(state.creates).toBe(2);
});
for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`independent follow ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    const state = await setup(page, true); await page.goto('/follow-typing'); await expect(page.locator('#follow-typing-input')).toBeFocused(); expect(state.creates).toBe(0);
    await expect(page.locator('.follow-exercise .learning-word')).toHaveText('incomprehensibilities'); await expect(page.locator('.follow-pronunciation')).toContainText('/'); await expect(page.locator('.word-meaning')).toContainText('难以理解');
    await expect(page.locator('.workspace-meta')).toContainText('实际 1 词（申请 20 词）'); expect(await page.locator('html').evaluate(node => node.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: '完成跟拼', exact: true })).toBeInViewport();
    await expect(page.locator('#follow-detail-panel')).toHaveCount(0);
    await page.locator('#follow-typing-input').fill('draft'); await page.screenshot({ path: `test-results/follow-${theme}-${width}.png`, fullPage: true });
    if (width < 680) {
      await page.getByRole('button', { name: '展开释义', exact: true }).click(); await expect(page.getByRole('button', { name: '收起释义', exact: true })).toHaveAttribute('aria-expanded', 'true');
      await page.getByRole('button', { name: '收起释义', exact: true }).click(); await expect(page.locator('#follow-typing-input')).toHaveValue('draft');
    } else {
      await expect(page.getByRole('button', { name: '展开释义', exact: true })).toHaveCount(0);
    }
    await page.getByRole('button', { name: '学习统计', exact: true }).click(); await expect(page.getByRole('region', { name: '独立跟拼日期统计', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '收起练习详情', exact: true }).click(); await expect(page.getByRole('button', { name: '学习统计', exact: true })).toBeFocused();
    await page.locator('#follow-typing-input').focus();
    const inputBefore = await page.locator('#follow-typing-input').boundingBox();
    const submitBefore = await page.getByRole('button', { name: '完成跟拼', exact: true }).boundingBox();
    await page.locator('#follow-typing-input').press('Enter'); await expect(page.locator('.follow-input-feedback.is-error')).toContainText('再试一次');
    const inputAfter = await page.locator('#follow-typing-input').boundingBox(); expect(inputAfter!.y).toBeCloseTo(inputBefore!.y, 0); await expect(page.locator('#follow-typing-input')).toBeFocused();
    const submitAfter = await page.getByRole('button', { name: '完成跟拼', exact: true }).boundingBox(); expect(submitAfter!.y).toBeCloseTo(submitBefore!.y, 0);
    await page.locator('#follow-typing-input').press('Alt+p'); await expect.poll(() => state.audioAuth).toBe(true);
    await page.getByRole('button', { name: '练习设置', exact: true }).click(); await expect(page.getByRole('region', { name: '练习设置面板', exact: true })).toBeVisible(); await page.getByRole('button', { name: '关闭练习设置', exact: true }).click(); await page.locator('#follow-typing-input').focus();
    await page.locator('#follow-typing-input').fill('incomprehensibilities'); await page.locator('#follow-typing-input').press('Enter'); await expect(page.getByRole('heading', { name: '本轮跟拼完成', exact: true })).toBeVisible();
    await expect(page.locator('.follow-completion')).not.toContainText('已掌握'); await expect(page.locator('.follow-completion')).not.toContainText('每日目标已完成'); expect(state.creates).toBe(0);
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('one word tab switches practice modes and preserves masks, drafts and daily progress', async ({ page }) => {
  const state = await setup(page, true);
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio { constructor(src?: string) { super(src); Reflect.set(window, '__followAudio', this); } };
  });
  await page.goto('/learn?mode=follow');
  await expect(page.locator('#follow-typing-input')).toBeFocused();
  await expect(page.getByRole('tab', { name: '单词练习', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: '跟拼练习', exact: true })).toHaveCount(0);
  const panel = page.locator('#mode-panel-follow');
  await page.locator('#follow-typing-input').fill('draft');
  const callsBeforeMask = state.urls.length;
  await page.getByRole('button', { name: '显示英文拼写', exact: true }).click();
  await page.getByRole('button', { name: '显示中文释义', exact: true }).click();
  await expect(panel.locator('.learning-word')).toHaveCount(0);
  await expect(panel.locator('.word-meaning')).toHaveCount(0);
  await expect(panel.locator('.follow-pronunciation [lang=en]')).toHaveCount(0);
  await expect(panel.locator('.letter-slot')).toHaveCount(6);
  await expect(page.locator('#follow-typing-input')).toHaveValue('draft');
  expect(state.urls.length).toBe(callsBeforeMask);
  expect(state.answers).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole('button', { name: '显示英文拼写', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: '显示中文释义', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(panel.locator('.learning-word')).toHaveCount(0);
  await expect(panel.locator('.word-meaning')).toHaveCount(0);
  expect(state.creates).toBe(0);
  await page.locator('#follow-typing-input').fill('draft');
  await page.evaluate(() => Reflect.set(document.querySelector('.study-workspace')!, '__sharedWorkspace', true));
  await page.getByRole('button', { name: '朗读单词', exact: true }).click();
  await expect.poll(() => state.audioAuth).toBe(true);
  await chooseMode(page, '单词拼读');
  await expect(page.locator('.daily-training-card')).toBeVisible();
  await expect.poll(() => page.evaluate(() => { const audio = Reflect.get(window, '__followAudio') as HTMLAudioElement | undefined; return !audio || audio.paused; })).toBe(true);
  await expect(page.locator('#follow-typing-input')).toBeDisabled();
  await chooseMode(page, '跟拼');
  await expect(page.locator('#follow-typing-input')).toBeFocused();
  await expect(page.locator('#follow-typing-input')).toHaveValue('draft');
  expect(await page.evaluate(() => Reflect.get(document.querySelector('.study-workspace')!, '__sharedWorkspace'))).toBe(true);
  await page.getByRole('button', { name: '显示英文拼写', exact: true }).click();
  await page.getByRole('button', { name: '显示中文释义', exact: true }).click();
  await expect(panel.locator('.learning-word')).toHaveText('incomprehensibilities');
  await expect(panel.locator('.word-meaning')).toContainText('难以理解');
  await page.locator('#follow-typing-input').fill('incomprehensibilities');
  await page.locator('#follow-typing-input').press('Enter');
  await expect(panel.getByRole('heading', { name: '本轮跟拼完成', exact: true })).toBeVisible();
  expect(state.daily.completedCount).toBe(0); expect(state.daily.trainingCount).toBe(0); expect(state.creates).toBe(0);
  expect(state.urls.filter(url => /learning-batches\/50/.test(url)).every(url => url.startsWith('GET ') || url.endsWith('/training/next'))).toBe(true);
  await chooseMode(page, '单词拼读');
  await expect(page.locator('.daily-training-card .learning-word')).toHaveText('apple');
});
