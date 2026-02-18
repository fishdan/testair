import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://app.tellgovernment.com', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

console.log('URL', page.url());
const buttons = page.locator('button');
const buttonCount = await buttons.count();
console.log('button count', buttonCount);
for (let i = 0; i < Math.min(buttonCount, 20); i += 1) {
  const text = (await buttons.nth(i).innerText()).trim().replace(/\s+/g, ' ');
  const aria = await buttons.nth(i).getAttribute('aria-label');
  console.log(i, JSON.stringify(text), aria ?? '');
}

const signInButton = page.getByRole('button', { name: /sign in/i }).first();
console.log('sign in button count', await signInButton.count());
if (await signInButton.count()) {
  await signInButton.click();
  await page.waitForTimeout(3000);
  console.log('URL after click', page.url());

  const labels = page.locator('label');
  const labelCount = await labels.count();
  console.log('label count', labelCount);
  for (let i = 0; i < Math.min(labelCount, 20); i += 1) {
    const text = (await labels.nth(i).innerText()).trim().replace(/\s+/g, ' ');
    console.log('label', i, JSON.stringify(text));
  }

  const inputs = page.locator('input');
  const inputCount = await inputs.count();
  console.log('input count', inputCount);
  for (let i = 0; i < Math.min(inputCount, 20); i += 1) {
    const type = await inputs.nth(i).getAttribute('type');
    const name = await inputs.nth(i).getAttribute('name');
    const placeholder = await inputs.nth(i).getAttribute('placeholder');
    const id = await inputs.nth(i).getAttribute('id');
    console.log('input', i, { type, name, placeholder, id });
  }

  const submitButtons = page.getByRole('button');
  const submitCount = await submitButtons.count();
  for (let i = 0; i < Math.min(submitCount, 20); i += 1) {
    const t = (await submitButtons.nth(i).innerText()).trim().replace(/\s+/g, ' ');
    if (t) console.log('role button', i, JSON.stringify(t));
  }
}

await browser.close();
