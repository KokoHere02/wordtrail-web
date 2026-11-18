import { expect, test } from '@playwright/test';
test('sentence list, skip, repeat and history', async ({page}, testInfo) => {
  await page.goto('/login', {waitUntil:'domcontentloaded'});
  await page.getByRole('textbox', { name: '手机号或邮箱' }).fill('13800000001');
  await page.getByLabel('密码', { exact: true }).fill('example123');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.locator('.daily-equation')).toBeVisible();
  await page.evaluate(async () => {
    const {http}=await import(/* @vite-ignore */ '/src/api/http.ts'); const {router}=await import(/* @vite-ignore */ '/src/router/index.ts');
    const fallback=http.defaults.adapter; const learning=new Set<number>(); const history: string[]=[];
    const makeRow=(id:number)=>({id,englishText:`Example sentence ${id}.`,referenceTranslation:`参考翻译 ${id}`,explanation:null,source:'test',sourceReference:null,learning:false,favorite:false,available:true});
    const rows=[1,2].map(makeRow);
    Reflect.set(window, '__fillSentenceQueue', () => { for(let id=1;id<=102;id++){ if(!rows.some(row=>row.id===id)) rows.push(makeRow(id)); learning.add(id); } });
    Reflect.set(window, '__addSentence', (id:number) => { if(!rows.some(row=>row.id===id)) rows.push(makeRow(id)); learning.add(id); });
    http.defaults.adapter=async (config: {url:string;method:string;params?:Record<string,string>;data?:string}) => {
      const ok=(data:unknown)=>({config,status:200,headers:{},data:{code:'OK',data:structuredClone(data)}});
      const body=config.data?JSON.parse(config.data):{};
      if(config.url==='/sentence-practice/tags')return ok([]);
      if(config.url==='/sentence-translation/management/access')return ok({canManage:false});
      if (/^\/sentence-practice\/sentences\/\d+\/audio\?accent=(US|UK)$/.test(config.url)) {
        Reflect.set(window, '__lastSentenceAudio', config.url);
        // A playable ten-second PCM fixture leaves time to exercise stop and navigation.
        const header = new Uint8Array(44), view = new DataView(header.buffer);
        const samples = 80000;
        header.set(new TextEncoder().encode('RIFF'), 0);
        header.set(new TextEncoder().encode('WAVEfmt '), 8);
        header.set(new TextEncoder().encode('data'), 36);
        view.setUint32(4, 36 + samples * 2, true);
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, 8000, true); view.setUint32(28, 16000, true);
        view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, samples * 2, true);
        return { config, status: 200, headers: { 'content-type': 'audio/wav' }, data: new Blob([header, new Uint8Array(samples * 2)], { type: 'audio/wav' }) };
      }
      if(config.url==='/sentence-practice/sentences'){const offset=Number(config.params?.offset || 0), limit=Number(config.params?.limit || 50); return ok(rows.filter(x=>config.params?.scope!=='learning'||learning.has(x.id)).slice(offset,offset+limit).map(x=>({...x,learning:learning.has(x.id)})));}
      if(config.url.startsWith('/sentence-practice/learning/')&&config.method==='put'){learning.add(Number(config.url.split('/').at(-1)));return ok(null);}
      if(config.url.startsWith('/sentence-practice/learning/')&&config.method==='delete'){learning.delete(Number(config.url.split('/').at(-1)));return ok(null);}
      if(config.url.endsWith('/translations')){const id=Number(config.url.split('/')[3]);history.push(body.translation);learning.delete(id);return ok({sentenceId:id,referenceTranslation:`参考翻译 ${id}`,explanation:null});}
      if(config.url.endsWith('/history'))return ok(history.map((translation,id)=>({id,translation,createdAt:'2026-11-01T12:00:00'})));
      if(config.url.endsWith('/tags'))return ok([]);
      if(config.url.endsWith('/note'))return ok({content:'',errorTags:[],attemptId:null,version:0,updatedAt:null});
      return fallback(config);
    }; await router.push('/sentences');
  });
  await page.evaluate(async () => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    const {router}=await import(/* @vite-ignore */ '/src/router/index.ts');
    await router.push('/learn?mode=sentences');
  });
  await expect(page.getByRole('heading', { name: '学习列表暂时没有句子' })).toBeVisible();
  await page.getByRole('link', { name: '去句子库选句' }).click();
  await expect(page.getByText('Example sentence 1.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop.png') });
  await page.getByRole('button', { name: '切换浅色主题' }).click();
  await page.screenshot({ path: testInfo.outputPath('light.png') });
  await page.getByRole('button', { name: '切换深色主题' }).click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({ path: testInfo.outputPath('mobile.png') });
  expect(await page.locator('html').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('button',{name:'加入学习列表',exact:true}).first().click();
  await page.getByRole('button',{name:'加入学习列表',exact:true}).last().click();
  await page.getByRole('button',{name:'学习列表',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'选择练习'})).toHaveCount(0);
  await page.getByRole('link',{name:'开始练习'}).click();
  await expect(page).toHaveURL(/\/learn\?mode=sentences/);
  await expect(page.getByRole('region', {name:'句子翻译练习'})).toContainText('Example sentence 1.');
  await expect(page.locator('.workspace-progress')).toContainText('0 / 2 句');
  await page.screenshot({ path: testInfo.outputPath('workspace-practice.png') });
  const play = page.locator('.workspace-status-meta').getByRole('button', { name: '朗读原句' });
  const stop = page.getByRole('button', { name: '停止朗读' });
  await expect(play).toHaveText('');
  await expect(page.getByText('句子学习列表', { exact: true })).toHaveCount(0);
  for (const width of [320, 390, 1100, 1280]) {
    await page.setViewportSize({ width, height: 720 });
    const layout = await play.evaluate(button => {
      const icon = button.getBoundingClientRect();
      const header = button.closest('.workspace-status-meta')!;
      const count = header.querySelector('.workspace-progress > div > span')!.getBoundingClientRect();
      const prompt = document.querySelector('.sentence-prompt')!.getBoundingClientRect();
      return {
        gap: count.left - icon.right,
        countInIconRow: count.top >= icon.top && count.bottom <= icon.bottom,
        trackBelow: header.querySelector('[role="progressbar"]')!.getBoundingClientRect().top >= count.bottom,
        abovePrompt: prompt.top - header.getBoundingClientRect().bottom,
        rightInset: header.getBoundingClientRect().right - count.right,
      };
    });
    expect(layout.gap).toBeGreaterThanOrEqual(8);
    expect(layout.gap).toBeLessThanOrEqual(24);
    expect(layout.countInIconRow).toBe(true);
    expect(layout.trackBelow).toBe(true);
    expect(layout.abovePrompt).toBeGreaterThanOrEqual(12);
    expect(Math.abs(layout.rightInset)).toBeLessThan(2);
    if (width === 390) await page.screenshot({ path: testInfo.outputPath('workspace-practice-mobile.png') });
  }
  await page.getByLabel('你的翻译').fill('我的翻译');
  await page.keyboard.press('p');
  await expect(play).toBeVisible();
  await page.keyboard.press('Alt+p');
  await expect(stop).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, '__lastSentenceAudio'))).toMatch(/\/sentences\/1\/audio\?/);
  await stop.click();
  await expect(page.getByLabel('你的翻译')).toHaveValue('我的翻译p');
  await page.getByLabel('你的翻译').fill('我的翻译');
  await page.getByRole('button',{name:'提交翻译'}).click();
  await expect(page.locator('.sentence-reference-answer').getByText('参考翻译 1')).toBeVisible();
  await page.getByRole('heading', { name: 'Example sentence 1.' }).click();
  await page.keyboard.press('p');
  await expect(stop).toBeVisible();
  await page.getByRole('button',{name:'下一句'}).click();
  await play.click();
  await expect(stop).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, '__lastSentenceAudio'))).toMatch(/\/sentences\/2\/audio\?/);
  await page.getByRole('button',{name:'跳过'}).click();
  await expect(page.getByText('跳过的 1 句仍在学习列表中。')).toBeVisible();
  await page.getByRole('link',{name:'管理学习列表'}).click();
  await page.getByRole('button',{name:'学习列表',exact:true}).click();
  await expect(page.getByText('Example sentence 1.')).toHaveCount(0);
  await expect(page.getByText('Example sentence 2.')).toBeVisible();
  await page.getByRole('button',{name:'句子库',exact:true}).click();
  const detailButton = page.locator('article').filter({hasText:'Example sentence 1.'}).getByRole('button',{name:'历史与笔记'});
  await detailButton.click();
  const detail = page.getByRole('dialog', { name: '句子历史与笔记' });
  await expect(detail.getByText('我的翻译')).toBeVisible();
  await expect(detail.getByText('Example sentence 1.')).toBeVisible();
  await expect(page).toHaveURL(/\/sentences/);
  await detail.getByRole('button', { name: '编辑笔记' }).click();
  await detail.getByLabel('笔记（最多 4000 字）').fill('尚未保存的内容');
  page.once('dialog', dialog => dialog.dismiss());
  await detail.getByRole('button', { name: '关闭弹窗' }).click();
  await expect(detail).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0);
  await expect(detailButton).toBeFocused();
  await page.setViewportSize({width:390,height:844});
  await detailButton.click();
  await expect(detail.getByText('我的翻译')).toBeVisible();
  expect(await page.locator('html').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  await detail.getByRole('button', { name: '关闭弹窗' }).click();
  await expect(detail).toHaveCount(0);
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(() => (Reflect.get(window, '__fillSentenceQueue') as () => void)());
  await page.evaluate(async () => { const {router}=await import(/* @vite-ignore */ '/src/router/index.ts'); await router.push('/learn'); });
  await page.getByRole('tab',{name:'句子翻译'}).click();
  await expect(page).toHaveURL(/\/learn\?mode=sentences/);
  await expect(page.getByRole('region',{name:'句子翻译练习'})).toContainText('Example sentence 1.');
  await expect(page.locator('.workspace-progress')).toContainText('0 / 102 句');
  await page.evaluate(async () => { const {router}=await import(/* @vite-ignore */ '/src/router/index.ts'); await router.push('/sentences'); (Reflect.get(window, '__addSentence') as (id:number) => void)(103); });
  await page.getByRole('link',{name:'开始练习'}).click();
  await expect(page).toHaveURL(/\/learn\?mode=sentences/);
  await expect(page.locator('.workspace-progress')).toContainText('0 / 103 句');
});
