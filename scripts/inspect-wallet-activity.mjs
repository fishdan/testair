import fs from 'node:fs';
import { chromium } from 'playwright';

const env = Object.fromEntries(
  fs.readFileSync('projects/iby.us/test-user.env.local', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    })
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://app.iby.us/login');
await page.getByLabel('email').fill(env.IBY_USERNAME);
await page.getByLabel('password').fill(env.IBY_PASSWORD);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL('**/wallet**', { timeout: 15000 });
await page.waitForTimeout(1200);

const walletHeading = page.getByRole('heading', { name: /Wallet activity/i }).first();
console.log('heading count', await walletHeading.count());

const section = walletHeading.locator('xpath=ancestor::section[1]');
console.log('section count', await section.count());
if (await section.count()) {
  const html = await section.innerHTML();
  console.log('section html slice\n', html.slice(0, 6000));
}

const possible = [
  '[data-testid*=activity]',
  '[class*=activity] > div',
  'section:has-text("Wallet activity") div.rounded-2xl',
  'section:has-text("Wallet activity") article',
  'section:has-text("Wallet activity") li'
];

for (const sel of possible) {
  const count = await page.locator(sel).count();
  console.log(sel, count);
  if (count > 0) {
    for (let i = 0; i < Math.min(count, 5); i += 1) {
      const t = (await page.locator(sel).nth(i).innerText()).replace(/\s+/g, ' ').trim();
      if (t.length > 0) console.log(`  ${i}:`, t.slice(0, 180));
    }
  }
}

await browser.close();
