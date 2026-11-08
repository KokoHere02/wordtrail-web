// Run against a mock-mode development server at 127.0.0.1:5189.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5189/register');
  await page.getByRole('button', { name: '邮箱', exact: true }).click();
  await page.locator('#email').fill('first@example.com');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.locator('#code').fill('123456');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: '注册并登录' }).click();
  await page.waitForURL('**/today');
  await page.goto('http://127.0.0.1:5189/settings?section=security');
  await page.locator('.security-item').filter({ has: page.locator('#email-title') }).getByText('first@example.com', { exact: true }).waitFor();
  assert.equal(await page.locator('#password-code').count(), 1);
  await page.getByRole('button', { name: '更换邮箱' }).click();
  await page.locator('#email-editor').getByRole('button', { name: '获取验证码' }).first().click();
  await page.locator('#change-email-old-code').fill('123456');
  await page.locator('#change-email-address').fill('new@example.com');
  await page.locator('#email-editor').getByRole('button', { name: '获取验证码' }).last().click();
  await page.locator('#change-email-new-code').fill('000000');
  await page.getByRole('button', { name: '确认更换邮箱' }).click();
  await page.getByRole('alert').getByText('邮箱验证码错误或已失效').waitFor();
  assert.equal(await page.locator('#change-email-old-code').inputValue(), '123456');
  await page.locator('#change-email-new-code').fill('123456');
  await page.getByRole('button', { name: '确认更换邮箱' }).click();
  await page.waitForURL('**/login');
  await page.getByText('邮箱已更换，请重新登录。').waitFor();
  await page.getByRole('button', { name: '邮箱', exact: true }).click();
  await page.locator('#email').fill('new@example.com');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL('**/today');

  const other = await browser.newPage();
  await other.goto('http://127.0.0.1:5189/register');
  await other.locator('#phone').fill('13800000000');
  await other.getByRole('button', { name: '获取验证码' }).click();
  await other.locator('#code').fill('123456');
  await other.locator('#password').fill('password123');
  await other.getByRole('button', { name: '注册并登录' }).click();
  await other.waitForURL('**/today');
  await other.goto('http://127.0.0.1:5189/settings?section=security');
  await other.getByRole('button', { name: '绑定邮箱' }).click();
  await other.locator('#bind-email').fill('bind@example.com');
  await other.locator('#email-editor').getByRole('button', { name: '获取验证码' }).first().click();
  await other.locator('#bind-email-code').fill('123456');
  await other.locator('#email-editor').getByRole('button', { name: '获取验证码' }).last().click();
  await other.locator('#bind-phone-code').fill('123456');
  await other.getByRole('button', { name: '确认绑定' }).click();
  await other.getByText('邮箱已绑定。', { exact: true }).waitFor();
  await other.locator('.security-item').filter({ has: other.locator('#email-title') }).getByText('bind@example.com', { exact: true }).waitFor();
  console.log('PASS mock email registration, email change and phone account email binding');
} finally {
  await browser.close();
}
