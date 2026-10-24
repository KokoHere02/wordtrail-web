import { expect, test } from '@playwright/test';

for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`personal book transfer ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(value => localStorage.setItem('wordtrail.theme', value), theme);
    await page.goto('/login');
    await page.locator('#username').fill('transfer_visual');
    await page.locator('#password').fill('example123');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.daily-equation')).toBeVisible();
    await page.evaluate(async () => {
      const apiPath = '/src/api/index.ts', httpPath = '/src/api/http.ts', routerPath = '/src/router/index.ts';
      const { api } = await import(/* @vite-ignore */ apiPath);
      const { http } = await import(/* @vite-ignore */ httpPath);
      const { router } = await import(/* @vite-ignore */ routerPath);
      const book = await api.createBook({ name: '阅读词本', description: '阅读中遇到的单词' });
      const fixture = http.defaults.adapter;
      // Explicit UI fixtures only; other endpoints retain the existing opt-in mock adapter.
      http.defaults.adapter = async (config: { url: string; data: unknown }) => {
        if (config.url.endsWith('/import/preview')) {
          sessionStorage.setItem('transfer-upload-verified', String(config.data instanceof FormData && config.data.get('file') instanceof File));
          const word = (id: number, name: string) => ({ id, word: name, phonetic: null, translation: 'n. 阅读中遇到的词', translationGroups: [{ partOfSpeech: 'n.', meaning: '阅读中遇到的词' }], inBook: false });
          const row = (rowNumber: number, input: string, status: string, candidates: ReturnType<typeof word>[]) => ({ rowNumber, input, word: input, status, candidates, candidateCount: candidates.length, hasMoreCandidates: false, duplicateOfRow: null, message: status === 'NOT_FOUND' ? '词库中没有精确匹配的单词' : '请选择要收录的词条' });
          return { config, status: 200, headers: {}, data: { code: 'OK', message: '成功', data: {
            bookId: book.id, format: config.data instanceof FormData ? 'CSV' : 'TXT', totalCount: 3, matchedCount: 1, alreadyInBookCount: 0, duplicateCount: 0, notFoundCount: 1, ambiguousCount: 1, invalidCount: 0, ignoredBlankCount: 0, ignoredColumns: ['phonetic', 'translation'], readyWordIds: [1001],
            records: [row(1, 'abandon', 'MATCHED', [word(1001, 'abandon')]), row(2, 'lead', 'AMBIGUOUS', [word(1002, 'lead'), word(1003, 'lead')]), row(3, 'a-very-long-unmatched-word-that-must-wrap-on-small-screens', 'NOT_FOUND', [])],
          } } };
        }
        if (config.url.endsWith('/export')) return { config, status: 200, headers: { 'content-type': 'text/csv;charset=UTF-8', 'content-disposition': 'attachment; filename="wordtrail-book.csv"' }, data: new Blob(['\uFEFFword,phonetic,translation\r\n"abandon","","放弃"\r\n'], { type: 'text/csv' }) };
        return fixture(config);
      };
      await router.push(`/books/${book.id}`);
    });
    await page.getByRole('button', { name: '批量导入', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '批量导入词本', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.locator('#import-text').fill('abandon\nlead\nunmatched');
    await dialog.getByRole('button', { name: '预览匹配结果', exact: true }).click();
    await expect(dialog.locator('.import-counts > div')).toHaveCount(6);
    await dialog.locator('.import-candidates summary').click();
    await dialog.getByRole('radio', { name: '选用 lead #1003', exact: true }).check();
    await expect(dialog.getByRole('button', { name: '确认收录 2 词', exact: true })).toBeDisabled();
    await dialog.locator('.import-skip input').check();
    expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/book-import-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    await dialog.getByRole('radio', { name: '上传文件', exact: true }).check();
    await dialog.locator('#import-file').setInputFiles({ name: 'words.CSV', mimeType: 'text/csv', buffer: Buffer.from('\uFEFFword\r\nabandon\r\n') });
    await dialog.getByRole('button', { name: '预览匹配结果', exact: true }).click();
    await expect(dialog.locator('.import-preview')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('transfer-upload-verified'))).toBe('true');
    await dialog.locator('.import-candidates summary').click();
    await dialog.getByRole('radio', { name: '选用 lead #1003', exact: true }).check();
    await dialog.locator('.import-skip input').check();
    await dialog.getByRole('button', { name: '确认收录 2 词', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.live-notice')).toContainText('跳过 1 行');
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 CSV', exact: true }).click();
    expect((await downloadEvent).suggestedFilename()).toBe('wordtrail-book.csv');
    await expect(page.locator('.book-export-notice')).toContainText('已发起下载');
  });
}
