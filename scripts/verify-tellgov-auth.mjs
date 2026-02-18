import fs from 'node:fs';
import { chromium } from 'playwright';

const env = Object.fromEntries(
  fs.readFileSync('projects/tellgovernment.com/.env.local', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    })
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://app.tellgovernment.com');
await page.getByRole('button', { name: /sign in/i }).click();
await page.locator('#identifier-field').fill(env.TELLGOV_USERNAME);
await page.locator('#password-field').fill(env.TELLGOV_PASSWORD);
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForTimeout(3500);

console.log('url', page.url());
console.log('sign in buttons', await page.getByRole('button', { name: /sign in/i }).count());
console.log('continue buttons', await page.getByRole('button', { name: 'Continue' }).count());
console.log('user button count', await page.locator('[aria-label*="user" i], [data-testid*="user" i]').count());
console.log('my account text count', await page.getByText(/my account|account|sign out|logout/i).count());

const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1200);
console.log('body snippet', body);

await browser.close();
