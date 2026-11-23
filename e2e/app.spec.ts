import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Visible navigation: tabs on top on desktop, at the bottom on a phone. */
const tab = (page: Page, name: string) => page.locator('nav.tabs:visible').getByRole('button', { name });

async function recordChestWorkout(page: Page) {
  await page.getByRole('button', { name: 'Новая тренировка' }).click();
  await expect(page).toHaveURL(/#\/workout\//);
  await page.getByLabel('Название тренировки').fill('Грудь');
  await page.getByRole('button', { name: '+ Добавить упражнение' }).click();
  const card = page.getByRole('region', { name: 'Упражнение 1' });
  await card.getByLabel('Название упражнения 1').fill('Жим лёжа');
  await card.getByLabel('Вес, кг, подход 1').fill('62.5');
  await card.getByLabel('Повторы, подход 1').fill('10');
  await card.getByRole('button', { name: '+ Подход' }).click();
  await card.getByRole('button', { name: '+ Подход' }).click();
  await card.getByLabel('Повторы, подход 3').fill('8');
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('records a workout with sets; it shows up in the calendar, journal and charts and survives a reload', async ({ page }) => {
  await recordChestWorkout(page);
  const card = page.getByRole('region', { name: 'Упражнение 1' });
  // A new set copies the previous one; «.» is typed as «,».
  await expect(card.getByLabel('Вес, кг, подход 2')).toHaveValue('62,5');
  await expect(card.getByLabel('Повторы, подход 2')).toHaveValue('10');
  await expect(card).toContainText('3 подхода · 1 750 кг'); // Playwright normalises the no-break space

  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByRole('button', { name: /: Грудь$/ })).toBeVisible();
  await expect(page.locator('.kpi', { hasText: 'За месяц' })).toContainText('1 ·');
  await expect(page.locator('.wk .flame')).toHaveText('🔥1');

  await page.reload();
  await tab(page, 'Журнал').click();
  await expect(page.locator('.entry', { hasText: 'Грудь' })).toContainText('1 упражнение · 3 подхода');

  await tab(page, 'Графики').click();
  await expect(page.locator('.bar.sel')).toHaveCount(1);
  await expect(page.getByLabel('Упражнение', { exact: true })).toHaveValue('жим лежа');
  await expect(page.locator('circle.pt')).toHaveCount(1);
});

test('edits and deletes with undo', async ({ page }) => {
  await recordChestWorkout(page);
  const card = page.getByRole('region', { name: 'Упражнение 1' });
  await card.getByRole('button', { name: 'Удалить подход 1' }).click();
  await expect(card.getByLabel('Повторы, подход 2')).toHaveValue('8');
  await page.getByRole('button', { name: 'Вернуть' }).click();
  await expect(card.getByLabel('Повторы, подход 3')).toHaveValue('8');

  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page).not.toHaveURL(/#\/workout\//);
  await expect(page.locator('.day.has')).toHaveCount(0);
  await page.getByRole('button', { name: 'Вернуть' }).click();
  await expect(page.locator('.day.has')).toHaveCount(1);
});

test('an untouched new workout leaves no trace', async ({ page }) => {
  await page.getByRole('button', { name: 'Новая тренировка' }).click();
  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.locator('.day.has')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sport-log/profile') ?? '{"workouts":[]}').workouts.length)).toBe(0);
});

const CSV = [
  'Дата;Тренировка;Тип;Длительность, мин;Упражнение;Подход;Вес, кг;Повторы;Время, мин;ID тренировки',
  `${today()};Спина;strength;55;Тяга;1;50;10;;a1`,
  `${today()};Спина;strength;55;Тяга;2;55;8;;a1`,
  '2026-01-10;Йога утром;yoga;30;;;;;;a2',
].join('\r\n');

test('imports CSV, exports JSON with the same data, and undoes the import', async ({ page }, info) => {
  await recordChestWorkout(page);
  await page.getByRole('button', { name: 'Назад' }).click();
  await tab(page, 'Данные').click();

  await page.locator('input[type=file]').setInputFiles({ name: 'backup.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
  await expect(page.locator('.import-preview')).toContainText('2 тренировки · 1 упражнение · 2 подхода');
  await page.getByRole('button', { name: 'Заменить мои данные' }).click();
  await expect(page.locator('.box', { hasText: 'Резервная копия' })).toContainText('Сейчас: 2 тренировки');

  if (info.project.name === 'desktop-chrome') {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить JSON' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(`trenirovki-${today()}.json`);
    const doc = JSON.parse(readFileSync((await file.path())!, 'utf8'));
    expect(doc).toMatchObject({ format: 'sport-log', version: 1 });
    expect(doc.workouts.map((w: { id: string }) => w.id)).toEqual(['a1', 'a2']);
    expect(doc.workouts[0].exercises[0].sets.map((s: { weight: number }) => s.weight)).toEqual([50, 55]);
  }

  await page.getByRole('button', { name: 'Отменить импорт' }).click();
  await expect(page.locator('.box', { hasText: 'Резервная копия' })).toContainText('Сейчас: 1 тренировка');
});

test('shows a clear error for a broken file and keeps the data', async ({ page }) => {
  await tab(page, 'Данные').click();
  await page.locator('input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{oops') });
  await expect(page.getByRole('alert')).toContainText('не JSON');
});

test('on a phone the export goes through the share sheet («Сохранить в Файлы»)', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'the share sheet path is for touch devices');
  await page.addInitScript(() => {
    const w = window as unknown as { __shared?: { name: string; text: string } };
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files![0]!;
        w.__shared = { name: file.name, text: await file.text() };
      },
    });
  });
  await page.reload();
  await recordChestWorkout(page);
  await page.getByRole('button', { name: 'Назад' }).click();
  await tab(page, 'Данные').click();
  await page.getByRole('button', { name: 'Сохранить CSV' }).click();
  await expect(page.getByRole('status')).toContainText('передан');
  const shared = await page.evaluate(() => (window as unknown as { __shared: { name: string; text: string } }).__shared);
  expect(shared.name).toBe(`trenirovki-${today()}.csv`);
  expect(shared.text.split('\r\n')).toHaveLength(5); // header + 3 sets + trailing newline
  await expect(page.locator('.box', { hasText: 'Резервная копия' })).toContainText('Последняя копия');
});
