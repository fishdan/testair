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

const donaldTrump = page.getByText('Donald Trump');
const donaldJTrump = page.getByText('Donald J. Trump');

const countDonaldTrump = await donaldTrump.count();
const countDonaldJTrump = await donaldJTrump.count();

const visibleDonaldTrump = countDonaldTrump > 0 ? await donaldTrump.first().isVisible() : false;
const visibleDonaldJTrump = countDonaldJTrump > 0 ? await donaldJTrump.first().isVisible() : false;

console.log(JSON.stringify({
  url: page.url(),
  countDonaldTrump,
  visibleDonaldTrump,
  countDonaldJTrump,
  visibleDonaldJTrump
}, null, 2));

await browser.close();
