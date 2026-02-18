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
await page.goto('https://app.iby.us');
await page.getByRole('link', { name: 'Sign in' }).click();
await page.getByLabel('email').fill(env.IBY_USERNAME);
await page.getByLabel('password').fill(env.IBY_PASSWORD);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL('**/wallet**', { timeout: 15000 });

console.log('URL:', page.url());
console.log('Has Wallet Activity:', await page.getByText('Wallet Activity').count());

const activityContainer = page.getByText('Wallet Activity').first().locator('xpath=ancestor::*[self::section or self::div][1]');
console.log('Container HTML slice:');
const html = await activityContainer.innerHTML();
console.log(html.slice(0, 5000));

const rows = page.locator('table tbody tr');
console.log('table rows', await rows.count());
for (let i = 0; i < Math.min(await rows.count(), 8); i += 1) {
  const t = (await rows.nth(i).innerText()).trim().replace(/\s+/g, ' ');
  console.log(`row[${i}]`, t);
}

await browser.close();
