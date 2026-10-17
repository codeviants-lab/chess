import { expect, test, type Page } from '@playwright/test';

// Plays the app in a real browser: home, bot game, drawing, friend link (two tabs), random match, reload.

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function point(page: Page, square: string, orientation: 'w' | 'b' = 'w') {
  const box = (await page.locator('.board svg').boundingBox())!;
  const f = 'abcdefgh'.indexOf(square[0]!);
  const r = Number(square[1]) - 1;
  const [x, y] = orientation === 'w' ? [f, 7 - r] : [7 - f, r];
  return { x: box.x + ((x + 0.5) * box.width) / 8, y: box.y + ((y + 0.5) * box.height) / 8 };
}

async function tapMove(page: Page, from: string, to: string, orientation: 'w' | 'b' = 'w') {
  const a = await point(page, from, orientation);
  const b = await point(page, to, orientation);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
}

async function dragMove(page: Page, from: string, to: string, orientation: 'w' | 'b' = 'w', button: 'left' | 'right' = 'left') {
  const a = await point(page, from, orientation);
  const b = await point(page, to, orientation);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down({ button });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up({ button });
}

const sans = (page: Page) => page.locator('.moves li span').allTextContents();

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/.results/screens/${name}-${test.info().project.name}.png` });
}

test('ana sayfa açılıyor', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Satranç Kulübü' })).toBeVisible();
  await expect(page.getByText(/Şu an sitede \d+ kişi/)).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, 'ana-sayfa');
  expect(errors).toEqual([]);
});

test('bota karşı oyun: dokun-dokun, sürükle, geri al', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByLabel('Adın').fill('Deneme');
  const card = page.locator('.card', { hasText: 'Bota karşı' });
  await card.getByRole('button', { name: 'Kolay' }).click();
  await card.getByRole('button', { name: 'Beyaz' }).click();
  await card.getByRole('button', { name: 'Süresiz' }).click();
  await card.getByRole('button', { name: 'Oyna' }).click();

  await expect(page.locator('.board svg')).toBeVisible();
  await tapMove(page, 'e2', 'e4');
  await expect.poll(() => sans(page)).toEqual(['e4', expect.stringMatching(/.+/)]);
  await dragMove(page, 'g1', 'f3');
  await expect.poll(async () => (await sans(page))[2]).toBe('Nf3');
  await expect.poll(async () => (await sans(page))[3]).toMatch(/.+/);
  await noHorizontalScroll(page);
  await shot(page, 'bot-oyunu');

  await page.getByRole('button', { name: 'Geri al' }).click();
  await expect.poll(async () => (await sans(page)).filter(Boolean)).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('ok ve daire çizme', async ({ page }) => {
  await page.goto('/#/bot?level=kolay&color=w&tc=none');
  await expect(page.locator('.board svg')).toBeVisible();
  await dragMove(page, 'e2', 'e4', 'w', 'right');
  await expect(page.locator('line.shape')).toHaveCount(1);
  const d4 = await point(page, 'd4');
  await page.mouse.click(d4.x, d4.y, { button: 'right' });
  await expect(page.locator('circle.shape')).toHaveCount(1);
  await shot(page, 'oklar');
  const h6 = await point(page, 'h6');
  await page.mouse.click(h6.x, h6.y);
  await expect(page.locator('.shape')).toHaveCount(0);

  // Pencil mode: the primary button (a finger on phones) draws instead of moving.
  await page.getByRole('button', { name: 'Ok çizme modu' }).click();
  await dragMove(page, 'g1', 'f3');
  await expect(page.locator('line.shape')).toHaveCount(1);
  expect(await sans(page)).toEqual([]);
});

test('arkadaşa link: iki sekme oynar, sayfa yenilenir, beraberlik, rövanş', async ({ page, context }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByLabel('Adın').fill('Ali');
  const card = page.locator('.card', { hasText: 'Arkadaşınla' });
  await card.getByRole('button', { name: 'Beyaz' }).click();
  await card.getByRole('button', { name: '3+2' }).click();
  await card.getByRole('button', { name: 'Davet linki oluştur' }).click();
  const link = await page.locator('input.link').inputValue();
  expect(link).toMatch(/#\/g\/[a-z0-9]+$/);
  await expect(page.getByRole('link', { name: 'WhatsApp’ta gönder' })).toHaveAttribute('href', /wa\.me/);
  await shot(page, 'davet-linki');

  const guest = await context.newPage();
  const guestErrors = collectErrors(guest);
  guest.on('dialog', (d) => void d.accept('Ayşe'));
  await guest.goto(link);
  await expect(guest.locator('.player .pname', { hasText: 'Ali' })).toBeVisible();
  await expect(page.locator('.player .pname', { hasText: 'Ayşe' })).toBeVisible();
  await expect(page.locator('input.link')).toHaveCount(0);

  await tapMove(page, 'e2', 'e4', 'w');
  await expect.poll(() => sans(guest)).toEqual(['e4', '']);
  await dragMove(guest, 'e7', 'e5', 'b');
  await expect.poll(() => sans(page)).toEqual(['e4', 'e5']);
  await expect(page.locator('.clock.running')).toHaveCount(1);
  await shot(page, 'online-beyaz');
  await shot(guest, 'online-siyah');

  // The guest reloads: the game comes back.
  await guest.reload();
  await expect.poll(() => sans(guest)).toEqual(['e4', 'e5']);

  await page.getByRole('button', { name: 'Beraberlik teklif et' }).click();
  await guest.getByRole('button', { name: 'Kabul' }).click();
  await expect(page.locator('.status .result')).toHaveText('Berabere');
  await expect(guest.locator('.status .result')).toHaveText('Berabere');

  await page.getByRole('button', { name: 'Rövanş teklif et' }).click();
  await guest.getByRole('button', { name: 'Rövanşı kabul et' }).click();
  await expect(page).not.toHaveURL(link);
  await expect.poll(() => guest.url()).toBe(page.url());
  // Colours swap: Ayşe is white now.
  await tapMove(guest, 'd2', 'd4', 'w');
  await expect.poll(() => sans(page)).toEqual(['d4', '']);
  expect([...errors, ...guestErrors]).toEqual([]);
});

test('rastgele rakip: iki kişi eşleşir', async ({ page, context }) => {
  const other = await context.newPage();
  for (const [p, name] of [[page, 'Can'], [other, 'Ece']] as const) {
    await p.goto('/');
    await p.getByLabel('Adın').fill(name);
    const card = p.locator('.card', { hasText: 'Rastgele rakip' });
    await card.getByRole('button', { name: '5+0' }).click();
    await card.getByRole('button', { name: 'Rakip bul' }).click();
  }
  await expect(page).toHaveURL(/#\/g\/m/);
  await expect.poll(() => other.url()).toBe(page.url());
  await expect(page.locator('.player .pname', { hasText: 'Ece' })).toBeVisible();
  await expect(other.locator('.player .pname', { hasText: 'Can' })).toBeVisible();
  const whiteIsCan = (await page.locator('.player').last().getAttribute('data-color')) === 'w';
  const [white, black] = whiteIsCan ? [page, other] : [other, page];
  await tapMove(white, 'c2', 'c4', 'w');
  await expect.poll(() => sans(black)).toEqual(['c4', '']);
});
