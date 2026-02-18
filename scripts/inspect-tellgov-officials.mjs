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
await page.waitForURL('**/officials**', { timeout: 15000 });
await page.waitForTimeout(2000);

const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('body snippet:', body.slice(0, 1800));

const cards = page.locator('article, [data-testid*=official], .card, [class*=card]');
const count = await cards.count();
console.log('candidate cards', count);
for (let i = 0; i < Math.min(count, 15); i += 1) {
  const t = (await cards.nth(i).innerText()).replace(/\s+/g, ' ').trim();
  if (t.length > 0) {
    console.log(i, t.slice(0, 250));
  }
}

console.log('contains Donald regex count', await page.getByText(/Donald/i).count());
console.log('contains Trump regex count', await page.getByText(/Trump/i).count());

await browser.close();
