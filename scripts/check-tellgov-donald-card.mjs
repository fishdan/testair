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
await page.waitForTimeout(1500);

const donaldLoc = page.getByText(/Donald/i).first();
const countDonald = await page.getByText(/Donald/i).count();
let elementText = '';
let visible = false;
let includesTrump = false;
if (countDonald > 0) {
  visible = await donaldLoc.isVisible();
  elementText = (await donaldLoc.innerText()).replace(/\s+/g, ' ').trim();
  includesTrump = /Trump/i.test(elementText);
}

console.log(JSON.stringify({
  url: page.url(),
  countDonald,
  visible,
  includesTrump,
  elementText
}, null, 2));
await browser.close();
