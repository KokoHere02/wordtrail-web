import { expect, test } from '@playwright/test';
test('sentence list, skip, repeat and history', async ({page}, testInfo) => {
  await page.goto('/login', {waitUntil:'domcontentloaded'}); await page.locator('#username').fill('sentence_learning_reader'); await page.locator('#password').fill('example123'); await page.getByRole('button',{name:'登录',exact:true}).click();
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
  await page.getByLabel('你的翻译').fill('我的翻译');
  await page.getByRole('button',{name:'提交翻译'}).click();
  await expect(page.locator('.sentence-reference-answer').getByText('参考翻译 1')).toBeVisible();
  await page.getByRole('button',{name:'下一句'}).click();
  await page.getByRole('button',{name:'跳过'}).click();
  await expect(page.getByText('跳过的 1 句仍在学习列表中。')).toBeVisible();
  await page.getByRole('link',{name:'管理学习列表'}).click();
  await page.getByRole('button',{name:'学习列表',exact:true}).click();
  await expect(page.getByText('Example sentence 1.')).toHaveCount(0);
  await expect(page.getByText('Example sentence 2.')).toBeVisible();
  await page.getByRole('button',{name:'句子库',exact:true}).click();
  await page.locator('article').filter({hasText:'Example sentence 1.'}).getByRole('button',{name:'历史与笔记'}).click();
  await expect(page.getByText(/我的翻译/)).toBeVisible();
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
