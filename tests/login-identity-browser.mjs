// Run against an API-mode development server at 127.0.0.1:5191.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const sent = [];
  await page.route('**/api/auth/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    sent.push({ path, body: request.postDataJSON() });
    const isSend = path.endsWith('/send');
    await route.fulfill({ status: isSend ? 200 : 400, contentType: 'application/json', body: JSON.stringify({ code: isSend ? 'OK' : 'BAD_CREDENTIALS', message: isSend ? '成功' : '测试登录失败', data: null }) });
  });
  await page.goto('http://127.0.0.1:5191/login');
  assert.equal(await page.getByRole('group', { name: '账号类型' }).count(), 0);
  const account = page.getByLabel('手机号或邮箱');
  await account.fill('13800000000');
  await page.getByLabel('密码', { exact: true }).fill('password123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(sent.at(-1).path, '/api/auth/phone/password-login');
  assert.equal(sent.at(-1).body.phone, '13800000000');

  await account.fill('User@example.com');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.auth-action')?.hasAttribute('disabled'));
  assert.equal(sent.at(-1).path, '/api/auth/email/password-login');
  assert.equal(sent.at(-1).body.email, 'User@example.com');

  await page.getByRole('tab', { name: '验证码登录' }).click();
  await page.getByLabel('验证码', { exact: true }).waitFor();
  await account.fill('13800000000');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.getByRole('button', { name: /秒后重发/ }).waitFor();
  assert.equal(sent.at(-1).path, '/api/auth/phone/send');
  assert.deepEqual(sent.at(-1).body, { phone: '13800000000', purpose: 'LOGIN' });

  await account.fill('User@example.com');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.getByRole('button', { name: /秒后重发/ }).waitFor();
  assert.equal(sent.at(-1).path, '/api/auth/email/send');
  assert.deepEqual(sent.at(-1).body, { email: 'User@example.com', purpose: 'LOGIN' });
  await page.getByLabel('验证码', { exact: true }).fill('123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.auth-action')?.hasAttribute('disabled'));
  assert.equal(sent.at(-1).path, '/api/auth/email/code-login');

  await account.fill('13800000000');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.auth-action')?.hasAttribute('disabled'));
  assert.equal(sent.at(-1).path, '/api/auth/phone/code-login');

  const beforeInvalid = sent.length;
  await account.fill('not-an-account');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.getByText('请输入正确的手机号或邮箱地址。').waitFor();
  assert.equal(sent.length, beforeInvalid);
  await page.goto('http://127.0.0.1:5191/register');
  await page.getByRole('group', { name: '账号类型' }).waitFor();
  assert.equal(await page.getByRole('group', { name: '账号类型' }).count(), 1);
  await page.getByRole('button', { name: '邮箱', exact: true }).click();
  await page.getByLabel('邮箱', { exact: true }).waitFor();
  console.log('PASS unified phone/email login routes, validation and separate cooldowns');
} finally {
  await browser.close();
}
