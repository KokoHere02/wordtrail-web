import { expect, test } from '@playwright/test';

for (const width of [1440, 320]) {
  for (const theme of ['light', 'dark']) {
    for (const relatedCount of [5, 6]) {
    test(`word rows remain readable at ${width}px in ${theme} theme with ${relatedCount} related words`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/login');
      await page.evaluate(async ({ theme, relatedCount }) => {
        document.documentElement.dataset.theme = theme;
        const vuePath = '/node_modules/.vite/deps/vue.js';
        const componentPath = '/src/components/learning/WordLearningDetails.vue';
        const httpPath = '/src/api/http.ts';
        const [{ createApp, h }, { default: component }, { http }] = await Promise.all([
          import(/* @vite-ignore */ vuePath), import(/* @vite-ignore */ componentPath), import(/* @vite-ignore */ httpPath),
        ]);
        Reflect.set(window, '__relatedAudioRequests', []);
        http.defaults.adapter = async (config: { url: string }) => {
          if (config.url.startsWith('/words/21/audio')) {
            Reflect.get(window, '__relatedAudioRequests').push(config.url);
            throw new Error('音频测试失败');
          }
          return ({
          config, status: 200, headers: {}, data: { code: 'OK', message: 'ok', data: config.url.endsWith('/confusables') ? [
            { id: 1, word: 'commute', phonetic: '/kəˈmjuːt/', translation: 'v. 通勤；减轻' },
            { id: 2, word: 'extraordinarilylongunbreakableword', phonetic: null, translation: 'n. 这是一条较长的释义，应该自然换行而不是挤出屏幕。\nv. 保持内容完整。' },
            { id: 3, word: 'compute', phonetic: '/kəmˈpjuːt/', translation: null },
          ] : config.url.endsWith('/related') ? [
            { id: 21, word: 'action', phonetic: '/ˈækʃən/', translation: 'n. 行动；行为；活动；作用；动作；措施；行动的过程和结果\nvt. 对……起诉；采取行动\n[计] 方式，需要完整查看。' },
            { id: 22, word: 'active', phonetic: null, translation: 'adj. 活跃的；积极的' },
            { id: 23, word: 'actor', phonetic: null, translation: 'n. 演员' },
            { id: 24, word: 'activity', phonetic: null, translation: 'n. 活动' },
            { id: 25, word: 'activate', phonetic: null, translation: 'v. 激活' },
            { id: 26, word: 'react', phonetic: null, translation: 'v. 反应' },
          ].slice(0, relatedCount) : config.url === '/learning/settings' ? { pronunciation: { autoPlay: false, accent: 'US', playbackRate: 1, repeatCount: 1 } } : [] },
        }); };
        document.body.innerHTML = '<main id="layout-test"></main>';
        const app = createApp(component, { wordId: 10, word: 'computer', wordKey: 10, translation: '计算机' });
        app.component('RouterLink', { setup: (_props: unknown, { slots }: { slots: { default?: () => unknown } }) => () => h('a', slots.default?.()) });
        app.mount('#layout-test');
      }, { theme, relatedCount });
      const rows = page.locator('.confusable-words li');
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(1)).toContainText('保持内容完整');
      await expect(rows.nth(2)).toContainText('暂无释义');
      const firstWord = await rows.first().locator('strong').boundingBox();
      const firstAudio = await rows.first().getByRole('button', { name: '朗读 commute' }).boundingBox();
      const firstPhonetic = await rows.first().locator('.word-row-phonetic').boundingBox();
      expect(firstWord && firstAudio && firstPhonetic).toBeTruthy();
      expect(firstAudio!.x - (firstWord!.x + firstWord!.width)).toBeGreaterThanOrEqual(13);
      expect(firstPhonetic!.x - (firstAudio!.x + firstAudio!.width)).toBeLessThanOrEqual(7);
      expect(await rows.first().locator('.word-meaning').evaluate(node => getComputedStyle(node).color)).toBe(await page.evaluate(() => {
        const probe = document.createElement('span'); probe.style.color = 'var(--ink)'; document.body.appendChild(probe);
        const color = getComputedStyle(probe).color; probe.remove(); return color;
      }));
      expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
      for (const row of await rows.all()) {
        const box = await row.boundingBox();
        const heading = await row.locator('.confusable-heading').boundingBox();
        const meaning = await row.locator('.word-meaning').boundingBox();
        expect(box && heading && meaning).toBeTruthy();
        expect(meaning!.x + meaning!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
        if (width <= 600) expect(meaning!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height - 1);
        else expect(meaning!.x).toBeGreaterThan(heading!.x + heading!.width);
      }
      const related = page.getByRole('region', { name: '关联单词' });
      await expect(related.locator('li')).toHaveCount(5);
      await expect(related.locator('li').first()).toContainText('n. 行动 · vt. 对……起诉');
      await related.getByRole('button', { name: '朗读 action' }).click();
      await expect.poll(() => page.evaluate(() => Reflect.get(window, '__relatedAudioRequests').length)).toBe(1);
      await expect(related.getByRole('status')).toContainText('音频测试失败');
      await expect(related.locator('li').first()).not.toContainText('行为');
      await expect(related).not.toContainText('需要完整查看');
      await expect(related.getByRole('button', { name: /展开.*释义/ })).toHaveCount(0);
      if (relatedCount === 6) {
        await related.getByRole('button', { name: '展开其他 1 个关联单词' }).click();
        await expect(related.locator('li')).toHaveCount(6);
      } else await expect(related.getByRole('button', { name: /展开其他/ })).toHaveCount(0);
      const relatedRows = related.locator('li');
      for (const row of await relatedRows.all()) {
        const box = await row.boundingBox();
        const heading = await row.locator('.related-word-heading').boundingBox();
        const meaning = await row.locator('.word-meaning').boundingBox();
        expect(box && heading && meaning).toBeTruthy();
        if (width <= 600) expect(meaning!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height - 1);
        else expect(meaning!.x).toBeGreaterThan(heading!.x + heading!.width);
        expect(meaning!.x + meaning!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
      }
      if (relatedCount === 6) {
        await related.getByRole('button', { name: '收起关联单词' }).click();
        await expect(related.locator('li')).toHaveCount(5);
      }
      expect(await page.locator('html').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
      if (relatedCount === 5 && theme === 'light') await related.screenshot({ path: testInfo.outputPath('related-layout.png'), animations: 'disabled' });
    });
    }
  }
}
