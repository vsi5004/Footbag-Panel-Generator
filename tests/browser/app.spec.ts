import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function settingsDownload(page: Page) {
  const pending = page.waitForEvent('download');
  await page.locator('#exportSettings').click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, 'utf8'));
}

async function importSettings(page: Page, data: unknown) {
  await page.locator('#importFile').setInputFiles({
    name: 'settings.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(1);
}

async function setChecked(page: Page, selector: string, checked: boolean) {
  const input = page.locator(selector);
  if ((await input.isChecked()) !== checked) {
    const switchLabel = page.locator(`label.switch:has(${selector})`);
    if (await switchLabel.count()) await switchLabel.click();
    else await input.setChecked(checked);
  }
  await expect(input).toBeChecked({ checked });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#svgHost svg')).toHaveCount(1);
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(1);
});

test('built app starts without globals or errors and renders every shape and hole mode', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  for (const shape of ['3', '4', '5', '6', '10']) {
    await page.locator('#shape').selectOption(shape);
    await expect(page.locator('#svgHost svg path')).toHaveCount(1);
    await setChecked(page, '#curved', true);
    await expect(page.locator('#curveRadiusRow')).toBeVisible();
    await setChecked(page, '#showHoles', false);
    await expect(page.locator('#svgHost svg circle')).toHaveCount(0);
    await setChecked(page, '#showHoles', true);
    await expect.poll(() => page.locator('#svgHost svg circle').count()).toBeGreaterThan(0);
    await setChecked(page, '#curved', false);
  }
  await page.locator('#shape').selectOption('6');
  await page.locator('#hexType').selectOption('truncated');
  await expect(page.locator('#hexLongRow')).toBeVisible();
  await expect(page.locator('#hexRatioRow')).toBeVisible();
  expect(await page.evaluate(() => 'FB' in window)).toBe(false);
  expect(errors).toEqual([]);
});

test('paired controls, custom stitches, resets, grids and zoom remain functional', async ({
  page,
}) => {
  await page.locator('#sideNumber').fill('40');
  await expect(page.locator('#side')).toHaveValue('40');
  await expect(page.locator('#panelSideLengthValue')).toHaveText('40.0 mm');
  await page.locator('#advanced').evaluate((element: HTMLDetailsElement) => (element.open = true));
  await setChecked(page, '#cornerStitchSpacing', true);
  await expect(page.locator('#cornerStitchSpacingRow')).toBeVisible();
  await page.locator('#holeBunchingNumber').fill('0.5');
  for (let i = 0; i < 3; i++) await page.locator('#resetPanelSettings').click();
  await expect(page.locator('#sideNumber')).toHaveValue('30');
  await expect(page.locator('#holeBunchingNumber')).toHaveValue('0');
  await expect(page.locator('#cornerStitchSpacing')).not.toBeChecked();
  await expect(page.locator('#panelSideLengthValue')).toHaveText('30.0 mm');
  await setChecked(page, '#showGrid', false);
  await expect(page.locator('#svgHost #grid')).toHaveCount(0);
  await page.locator('#zoomIn').click();
  await expect(page.locator('#zoomLabel')).toHaveText('210%');
  await page.locator('#zoomReset').click();
  await expect(page.locator('#zoomLabel')).toHaveText('200%');
  await setChecked(page, '#pageInvert', true);
  await expect(page.locator('#nestingOffsetRow')).toBeVisible();
  await page.locator('#resetLayoutSettings').click();
  await expect(page.locator('#pageInvert')).not.toBeChecked();
  await expect(page.locator('#nestingOffsetRow')).toBeHidden();
});

test('settings download/import preserves 12x12, spacing extremes, and legacy scale fallback', async ({
  page,
}) => {
  const saved = await settingsDownload(page);
  for (const vSpace of [-20, 60]) {
    saved.layout = { ...saved.layout, rows: 12, cols: 12, vSpace };
    saved.export = { scalePercent: 125 };
    await importSettings(page, saved);
    await expect(page.locator('#pageRowsNumber')).toHaveValue('12');
    await expect(page.locator('#pageColsNumber')).toHaveValue('12');
    await expect(page.locator('#pageVSpaceNumber')).toHaveValue(String(vSpace));
    await expect(page.locator('#exportScale')).toHaveValue('125');
    const again = await settingsDownload(page);
    expect(again.layout).toEqual(saved.layout);
  }
  delete saved.export;
  await importSettings(page, saved);
  await expect(page.locator('#exportScale')).toHaveValue('100');
  const dialog = page.waitForEvent('dialog');
  await page.locator('#importFile').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  const alert = await dialog;
  expect(alert.message()).toBe('Invalid settings file.');
  await alert.dismiss();
  await expect(page.locator('#svgHost svg')).toHaveCount(1);
});

test('both SVG downloads have scaled physical dimensions without changing previews', async ({
  page,
}) => {
  await page.locator('#exportScale').fill('125');
  for (const [host, button] of [
    ['#svgHost', '#downloadSvg'],
    ['#pageSvgHost', '#downloadPageSvg'],
  ]) {
    const before = await page.locator(`${host} svg`).getAttribute('width');
    const pending = page.waitForEvent('download');
    await page.locator(button).click();
    const download = await pending;
    expect(download.suggestedFilename()).toContain('-125pct.svg');
    const svg = await readFile((await download.path())!, 'utf8');
    expect(parseFloat(svg.match(/\bwidth="([^"]+)"/)![1])).toBeCloseTo(
      parseFloat(before!) * 1.25,
      8,
    );
    await expect(page.locator(`${host} svg`)).toHaveAttribute('width', before!);
  }
});

test('mobile viewport retains working controls and exports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#shape').selectOption('4');
  await page.locator('#sideNumber').fill('35');
  await expect(page.locator('#panelSideLengthValue')).toHaveText('35.0 mm');
  const settings = await settingsDownload(page);
  expect(settings.shape).toBe(4);
  expect(settings.side).toBe(35);
});
