import { expect, test, type Page } from '@playwright/test';

// Explicit fixture API; audio tests use the browser's real Audio/WAV decoder and events.
async function setup(page: Page, autoPlay = false) {
  await page.goto('/login');
  await page.locator('#username').fill('expansion_browser_fixture');
  await page.locator('#password').fill('fixture123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.daily-equation')).toBeVisible();
  await page.evaluate(async autoPlay => {
    const httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
    const { http } = await import(/* @vite-ignore */ httpPath), { router } = await import(/* @vite-ignore */ routerPath);
    const original = http.defaults.adapter;
    const control = { requests: [] as { url: string; auth: boolean }[], plays: [] as number[], ended: 0, paused: 0, revoked: 0, created: 0, trainingWrites: 0 };
    Reflect.set(window, '__expansion', control);
    const originalAudio = window.Audio;
    window.Audio = function (source?: string) {
      const audio = new originalAudio(source);
      audio.addEventListener('playing', () => control.plays.push(audio.playbackRate));
      audio.addEventListener('ended', () => control.ended++);
      audio.addEventListener('pause', () => control.paused++);
      return audio;
    } as typeof Audio;
    const createUrl = URL.createObjectURL.bind(URL), revokeUrl = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { control.created++; return createUrl(blob); };
    URL.revokeObjectURL = url => { control.revoked++; revokeUrl(url); };
    let mode = 'LISTEN_DICTATION', version = 1, revealed = false;
    let pronunciation = { autoPlay, accent: 'UK', playbackRate: .75, repeatCount: 2 };
    const progress = () => ({ batchId: 92, taskType: 'PRACTICE', learningDate: null, dailyTarget: 0, status: 'IN_PROGRESS', totalCount: 2, completedCount: 0, skippedCount: 0, answerCount: 0, unfamiliarCount: 0, newCount: 2, reviewCount: 0, nextItemId: 901, studyMode: mode, modeVersion: version, trainingCount: control.trainingWrites });
    // 0.4 seconds of valid PCM; no external network or artificial play() promise.
    function wave() {
      const rate = 8000, samples = 3200, buffer = new ArrayBuffer(44 + samples * 2), view = new DataView(buffer);
      const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
      text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples * 2, true);
      for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * 440 / rate) * 1000, true);
      return new Blob([buffer], { type: 'audio/wav' });
    }
    http.defaults.adapter = async (config: { url: string; method: string; data?: string; params?: { category: string; page: number; size: number }; headers: { get(name: string): string } }) => {
      const body = config.data ? JSON.parse(config.data) : {};
      const ok = (data: unknown) => ({ config, status: 200, headers: {}, data: { code: 'OK', data: structuredClone(data) } });
      if (config.url === '/learning/settings' || config.url === '/learning/settings/pronunciation') {
        if (config.method === 'get' && autoPlay) await new Promise(resolve => setTimeout(resolve, 600));
        if (config.method === 'put') pronunciation = body;
        return ok({ dailyTarget: 30, newWordTarget: 10, reviewLimit: 20, pronunciation });
      }
      if (config.url.includes('/audio?')) { control.requests.push({ url: config.url, auth: config.headers.get('Authorization')?.startsWith('Bearer ') }); return { config, status: 200, headers: { 'content-type': 'audio/wav' }, data: wave() }; }
      if (config.url === '/learning/consolidation/batches/92') return ok(progress());
      if (config.url.endsWith('/92/mode')) { mode = body.mode; version++; return ok(progress()); }
      if (config.url.endsWith('/92/next')) return ok({ itemId: 901, mode, modeVersion: version, presentationId: `current-${version}-${control.trainingWrites}`, attemptNo: control.trainingWrites + 1, phase: 'AWAITING_INPUT', answerRevealed: revealed, hintUsed: revealed, itemStatus: 'PENDING', completionReason: null, extraTraining: false, ...(revealed || mode === 'FOLLOW_TYPING' ? { wordId: 88, word: 'apple', phonetic: '/apple/', translation: '苹果' } : {}), audioUrl: `/api/learning-batches/92/training/items/901/audio?presentationId=current-${version}-${control.trainingWrites}&modeVersion=${version}&accent=UK`, pronunciation, progress: progress() });
      if (config.url.endsWith('/901/answer')) { control.trainingWrites++; revealed = body.action === 'REVEAL'; return ok({ action: body.action, trainingId: control.trainingWrites, word: 'apple', progress: progress() }); }
      if (config.url === '/learning/consolidation/issues') return ok({ page: config.params?.page || 1, size: 20, total: 1, records: [{ wordId: 88, word: 'incomprehensibilities', translation: '难以理解的事物；'.repeat(20), reason: 'SPELLING_ERROR', category: config.params?.category || 'ERROR', lastInput: 'incomprehensibility', mode: 'DICTATION', lastOccurredAt: '2026-10-27T12:00:00', occurrenceCount: 3 }] });
      if (config.url === '/learning/consolidation/summary') return ok(['SPELLING_ERROR', 'ANSWER_REVEALED', 'UNRECOGNIZED', 'ATTEMPT_LIMIT'].map(reason => ({ reason, category: 'ERROR', wordCount: reason === 'SPELLING_ERROR' ? 1 : 0 })));
      if (config.url === '/learning/consolidation/batches') return ok({ page: 1, size: 10, total: 1, records: [progress()] });
      if (config.url === '/me/learning-data/export') return { config, status: 200, headers: { 'content-type': 'application/zip', 'content-disposition': "attachment; filename*=UTF-8''%E5%AD%A6%E4%B9%A0.zip" }, data: new Blob([new Uint8Array([80, 75, 3, 4, 80, 75, 5, 6, ...Array(18).fill(0)])], { type: 'application/zip' }) };
      return original(config);
    };
    await router.push('/consolidation/batches/92');
  }, autoPlay);
  await expect(page.locator('#daily-training-input')).toBeEnabled();
}
test('late settings restore does not cancel the current automatic audio playback', async ({ page }) => {
  await setup(page, true);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__expansion').ended)).toBe(2);
  const audio = await page.evaluate(() => Reflect.get(window, '__expansion'));
  expect(audio.requests).toHaveLength(1); expect(audio.plays).toEqual([.75, .75]); expect(audio.trainingWrites).toBe(0);
});
test('real browser audio applies UK/rate/repeats, stops on mode switch and downloads authenticated ZIP', async ({ page }) => {
  await setup(page);
  await expect(page.locator('.daily-training-card .learning-word')).toHaveCount(0);
  await expect(page.locator('.daily-training-card .word-meaning')).toHaveCount(0);
  await expect(page.locator('.letter-slot')).toHaveCount(1);
  await page.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__expansion').ended)).toBe(2);
  const audio = await page.evaluate(() => Reflect.get(window, '__expansion'));
  expect(audio.plays).toEqual([.75, .75]); expect(audio.requests[0].auth).toBe(true); expect(audio.requests[0].url).toContain('accent=UK'); expect(audio.trainingWrites).toBe(0); expect(audio.revoked).toBe(audio.created);
  await page.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__expansion').plays.length)).toBe(3);
  await page.getByRole('button', { name: '练习设置', exact: true }).click(); await page.getByRole('radio', { name: '跟拼', exact: false }).check();
  await expect(page.locator('.daily-training-card')).toHaveAttribute('data-mode', 'FOLLOW_TYPING');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__expansion').paused)).toBeGreaterThan(0);
  await page.getByRole('button', { name: '关闭练习设置', exact: true }).click();
  await page.getByRole('button', { name: '美式发音', exact: true }).click(); await expect(page.getByRole('button', { name: '美式发音', exact: true })).toHaveAttribute('aria-pressed', 'true'); await page.getByRole('button', { name: '练习设置', exact: true }).click(); await page.getByLabel('播放速度').fill('1.25'); await page.getByLabel('重复次数').fill('1'); await page.getByRole('button', { name: '保存发音设置', exact: true }).click(); await expect(page.getByText('发音设置已保存。')).toBeVisible();
  await page.getByRole('button', { name: '关闭练习设置', exact: true }).click(); await page.getByRole('button', { name: '播放发音', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__expansion').plays.at(-1))).toBe(1.25);
  expect(await page.evaluate(() => Reflect.get(window, '__expansion').requests.at(-1).url)).toContain('accent=US');
  await page.evaluate(async () => { const path = '/src/router/index.ts'; const { router } = await import(/* @vite-ignore */ path); await router.push('/settings'); });
  await page.getByRole('tab', { name: '数据管理', exact: true }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '下载个人学习数据 ZIP', exact: true }).click(); const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('学习.zip'); await expect(page.getByText('导出文件已下载。')).toBeVisible();
});
for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`consolidation/listening/settings ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    await setup(page);
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: '练习设置', exact: true }).click();
    await expect(page.getByRole('radio')).toHaveCount(4); const box = await page.getByRole('region', { name: '练习设置面板' }).boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape'); await page.locator('a[href="/consolidation"]').first().click(); await expect(page.locator('.consolidation-issue')).toBeVisible();
    await expect(page.locator('.consolidation-page h1')).toHaveCount(0);
    await expect(page.getByText('按最近一次相关练习快照整理。', { exact: false })).toHaveCount(0);
    const reasons = page.getByRole('combobox', { name: /筛选原因/ }); await reasons.click();
    const options = page.getByRole('listbox'); await expect(options).toBeVisible();
    const menuBox = await options.boundingBox(); expect(menuBox!.x).toBeGreaterThanOrEqual(0); expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width);
    await reasons.press('End'); await reasons.press('Enter'); await expect(reasons).toContainText('达到强化上限'); await expect(options).toHaveCount(0);
    await reasons.click(); await reasons.press('Home'); await reasons.press('Enter'); await expect(reasons).toContainText('全部原因');
    await page.getByRole('combobox', { name: /练习方式/ }).click(); await expect(page.getByRole('listbox')).toBeVisible();
    await reasons.click(); await expect(page.locator('.consolidation-controls [role=listbox]')).toHaveCount(0); await reasons.press('Escape');
    await page.screenshot({ path: `test-results/consolidation-${theme}-${width}.png`, fullPage: true });
    await expect(page.locator('.consolidation-issue')).toContainText('incomprehensibility'); await expect(page.locator('.consolidation-page [role=tab]')).toHaveCount(0); await expect(page.getByText('待独立验证', { exact: true })).toHaveCount(0); await expect(page.locator('.consolidation-summary > div')).toHaveCount(4);
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('link', { name: '学习设置', exact: true }).click(); await expect(page.locator('#new-word-target')).toBeVisible();
    await expect(page.locator('.header-actions .settings-link')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.main-nav a[aria-current="page"]')).toHaveCount(0);
    await expect(page.getByRole('tab', { selected: true })).toHaveText('每日配额');
    await page.getByRole('button', { name: '增加每日新词', exact: true }).click();
    await expect(page.locator('#new-word-target')).toHaveValue('11');
    await expect(page.locator('.settings-total')).toContainText('31');
    const nav = await page.locator('.settings-nav').boundingBox(), card = await page.locator('.settings-allocation-form').boundingBox();
    if (width === 1440) expect(nav!.x + nav!.width).toBeLessThan(card!.x);
    else expect(nav!.y + nav!.height).toBeLessThan(card!.y);
    await page.screenshot({ path: `test-results/settings-allocation-${theme}-${width}.png`, fullPage: true });
    await page.getByRole('tab', { name: '每日配额', exact: true }).focus(); await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: '发音与播放', exact: true })).toBeFocused();
    await expect(page.getByLabel('播放速度')).toBeVisible();
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/settings-pronunciation-${theme}-${width}.png`, fullPage: true });
    await page.getByRole('tab', { name: '数据管理', exact: true }).click();
    await expect(page.getByRole('button', { name: '下载个人学习数据 ZIP', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '管理', exact: true })).toHaveAttribute('href', '/settings/security');
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/settings-data-${theme}-${width}.png`, fullPage: true });
    await page.getByRole('tab', { name: '每日配额', exact: true }).click();
    await expect(page.locator('#new-word-target')).toHaveValue('11');
    expect(await page.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
