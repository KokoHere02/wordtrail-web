// Run with a mock development server at 127.0.0.1:5189.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  await page.goto('http://127.0.0.1:5189/register');
  await page.locator('#phone').fill('13800000000');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.locator('#code').fill('123456');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: '注册并登录' }).click();
  await page.waitForURL('**/today');

  await page.goto('http://127.0.0.1:5189/settings?section=security');
  await page.getByRole('button', { name: '绑定邮箱' }).click();
  assert.equal(await page.getByText('请验证邮箱和当前身份。绑定后可使用邮箱登录。').count(), 0);
  await page.getByRole('radio', { name: '登录密码' }).check();
  assert.equal(await page.locator('#bind-password').isVisible(), true);
  await page.getByRole('radio', { name: '短信验证码' }).check();
  assert.equal(await page.locator('#bind-phone-code').isVisible(), true);
  await page.screenshot({ path: '.qa-dist/email-method.png' });

  await page.goto('http://127.0.0.1:5189/settings?section=pronunciation');
  const accent = page.getByRole('combobox', { name: /发音口音/ });
  await accent.click();
  await page.getByRole('option', { name: '英式 UK' }).waitFor();
  await page.waitForTimeout(220);
  await page.screenshot({ path: '.qa-dist/pronunciation-select.png' });
  await page.getByRole('option', { name: '英式 UK' }).click();
  assert.match(await accent.innerText(), /英式 UK/);
  await accent.focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await accent.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await accent.getAttribute('aria-expanded'), 'false');

  await page.goto('http://127.0.0.1:5189/plan');
  const sorting = page.getByRole('combobox', { name: /计划排序/ });
  await sorting.click();
  await page.getByRole('option', { name: '最早加入' }).click();
  assert.match(await sorting.innerText(), /最早加入/);

  await page.goto('http://127.0.0.1:5189/books');
  await page.getByRole('button', { name: '创建词本' }).click();
  await page.locator('#book-name').fill('下拉菜单测试词本');
  await page.getByRole('dialog').getByRole('button', { name: '创建词本' }).click();
  await page.waitForURL(/\/books\/\d+/);
  await page.getByRole('button', { name: '搜索收词' }).click();
  const match = page.getByRole('combobox', { name: /匹配方式/ });
  await match.click();
  await page.getByRole('option', { name: '完整' }).click();
  assert.match(await match.innerText(), /完整/);
  await page.getByRole('dialog').getByRole('button', { name: '关闭弹窗' }).click();
  await page.getByRole('button', { name: '批量导入' }).click();
  const format = page.getByRole('combobox', { name: /内容格式/ });
  await format.click();
  await page.getByRole('option', { name: 'CSV · 含 word 表头' }).click();
  assert.match(await format.innerText(), /CSV/);
  await format.click();
  await page.keyboard.press('Escape');
  assert.equal(await format.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.getByRole('dialog').isVisible(), true);
  await page.getByRole('dialog').getByRole('button', { name: '关闭弹窗' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5189/settings?section=pronunciation');
  const mobileAccent = page.getByRole('combobox', { name: /发音口音/ });
  await mobileAccent.click();
  const option = page.getByRole('option', { name: '英式 UK' });
  await option.waitFor();
  await page.waitForTimeout(220);
  const rect = await option.boundingBox();
  assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= 390, 'mobile dropdown stays in viewport');
  await page.screenshot({ path: '.qa-dist/pronunciation-select-mobile.png' });
  console.log('PASS email verification controls and animated dropdowns on desktop and mobile');
} finally {
  await browser.close();
}
