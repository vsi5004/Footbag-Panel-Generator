import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function generate(page: Page) {
  await page.locator('#generateGcode').click();
  await expect(page.locator('#exportGcode')).toBeEnabled();
  await expect(page.locator('#gcodeViewport svg')).toHaveCount(1);
}
async function downloadText(page: Page, id: string) {
  const pending = page.waitForEvent('download');
  await page.locator(id).click();
  const file = await pending;
  return { text: await readFile((await file.path())!, 'utf8'), name: file.suggestedFilename() };
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(1);
});

test('preview freshness indicator covers initial, stale, failed and regenerated output in either view', async ({
  page,
}) => {
  const indicator = page.locator('#gcodeFreshness');
  await expect(indicator).toBeVisible();
  await expect(indicator).toContainText('Needs generation');
  await page.locator('#gcodeRegenerate').click();
  await expect(page.locator('#exportGcode')).toBeEnabled();
  await expect(indicator).toBeHidden();
  await page.locator('#gcode-cutPower').fill('45');
  await expect(indicator).toBeVisible();
  await expect(indicator).toContainText('Stale - needs regeneration');
  await expect(page.locator('#exportGcode')).toBeDisabled();
  await page.locator('#gcodeView').selectOption('code');
  await expect(indicator).toBeVisible();
  await page.locator('#gcodeRegenerate').click();
  await expect(indicator).toBeHidden();
  expect(await page.locator('#gcodeCode').inputValue()).toContain('S450 F1000');
  await page.locator('#gcode-kerf').fill('3');
  await page.locator('#gcodeRegenerate').click();
  await expect(indicator).toContainText('Generation failed');
  await page.locator('#gcode-kerf').fill('0.1');
  await page.locator('#gcodeRegenerate').click();
  await expect(indicator).toBeHidden();
  await page.locator('#gcode-origin').selectOption('center');
  await page.locator('#gcodeView').selectOption('toolpath');
  await page.locator('#gcodePreview').screenshot({ path: '../gcode-stale.png' });
});

test('GCode field help uses shared tooltips and supports keyboard and phone tap dismissal', async ({
  page,
}) => {
  await expect(page.locator('#gcodeSettings small')).toHaveCount(0);
  await page.locator('#gcodeSettings details').evaluate((e: HTMLDetailsElement) => (e.open = true));
  const icons = page.locator('#gcodeSettings .tooltip-icon');
  await expect(icons).toHaveCount(11);
  for (const icon of await icons.all()) {
    const id = await icon.getAttribute('aria-describedby');
    const tip = page.locator(`#${id}`);
    await expect(tip).toHaveAttribute('role', 'tooltip');
    await icon.focus();
    await expect(tip).toBeVisible();
    await icon.press('Escape');
    await expect(tip).toBeHidden();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const icon = page.getByRole('button', { name: 'About Laser kerf width (mm)', exact: true });
  const tip = page.locator('#gcode-kerf-help');
  await icon.click();
  await expect(tip).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(tip).toHaveCSS('opacity', '1');
  await page.screenshot({ path: '../gcode-tooltip-phone.png' });
  await page.locator('#gcode-origin').click();
  await expect(tip).toBeHidden();
});

test('GCode toolpath, code toggle and download agree; view controls preserve export', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await generate(page);
  await expect(page.locator('#gcodeStatus')).toContainText('Ready to export');
  const code = await page.locator('#gcodeCode').inputValue();
  await page.locator('#gcodeSettings').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../gcode-desktop.png', fullPage: true });
  expect(code).toContain('M4 S0');
  expect(code).toContain('S1000 F1000');
  expect(code.indexOf(' panel\n')).toBeGreaterThan(code.lastIndexOf(' stitch\n'));
  const before = await page.locator('#gcodeViewport svg').getAttribute('viewBox');
  await page.locator('#gcodeZoomIn').click();
  expect(await page.locator('#gcodeViewport svg').getAttribute('viewBox')).not.toBe(before);
  await page.locator('#gcodeZoomReset').click();
  expect(await page.locator('#gcodeViewport svg').getAttribute('viewBox')).toBe(before);
  await page.locator('#gcodeShowTravel').uncheck();
  await expect(page.locator('[data-travel]')).toHaveClass(/hidden/);
  await page.locator('#gcodeView').selectOption('code');
  await expect(page.locator('#gcodeCode')).toBeVisible();
  await expect(page.locator('#gcodeViewport')).toBeHidden();
  const file = await downloadText(page, '#exportGcode');
  expect(file.name).toBe('footbag-layout-9panels.gcode');
  expect(file.text).toBe(code);
  await page.locator('#gcodeView').selectOption('toolpath');
  await expect(page.locator('#gcodeViewport')).toBeVisible();
  expect(errors).toEqual([]);
});

test('edits invalidate stale output; immediate export cannot bypass a newly invalid layout', async ({
  page,
}) => {
  await generate(page);
  await page.locator('#gcode-cutPower').fill('40');
  await expect(page.locator('#exportGcode')).toBeDisabled();
  await expect(page.locator('#gcodeCode')).toHaveValue('');
  await generate(page);
  expect(await page.locator('#gcodeCode').inputValue()).toContain('S400 F1000');
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.evaluate(() => {
    const space = document.getElementById('pageHSpaceNumber') as HTMLInputElement;
    space.value = '-20';
    space.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('exportGcode')!.click();
  });
  await expect(page.locator('#exportGcode')).toBeDisabled();
  await page.locator('#generateGcode').click();
  await expect(page.locator('#gcodeStatus')).toContainText(/overlap|space|layout/);
  expect(downloads).toBe(0);
});

test('settings persist machine code and cut order, while older imports restore defaults', async ({
  page,
}) => {
  await page.locator('#gcodeSettings details').evaluate((e: HTMLDetailsElement) => (e.open = true));
  await page.locator('#gcode-startCode').fill('G21\nG90\nM4 S0\n; my laser');
  await page.locator('#gcode-powerMax').fill('1');
  await page.locator('#gcode-cutPower').fill('25');
  await page.locator('#gcode-cutOrder').selectOption('panel-by-panel');
  await page.locator('#gcode-origin').selectOption('center');
  await generate(page);
  expect(await page.locator('#gcodeCode').inputValue()).toContain('S0.25 F1000');
  const { text } = await downloadText(page, '#exportSettings');
  const saved = JSON.parse(text);
  expect(saved.gcode.cutOrder).toBe('panel-by-panel');
  expect(saved.gcode.origin).toBe('center');
  expect(saved.gcode.startCode).toContain('my laser');
  await page.locator('#resetGcodeSettings').click();
  await page.locator('#importFile').setInputFiles({
    name: 'settings.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect(page.locator('#gcode-powerMax')).toHaveValue('1');
  await expect(page.locator('#gcode-origin')).toHaveValue('center');
  const olderMachine = JSON.parse(text);
  delete olderMachine.gcode.origin;
  await page.locator('#importFile').setInputFiles({
    name: 'older-machine.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(olderMachine)),
  });
  await expect(page.locator('#gcode-origin')).toHaveValue('lower-left');
  delete saved.gcode;
  await page.locator('#importFile').setInputFiles({
    name: 'old.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(page.locator('#gcode-powerMax')).toHaveValue('1000');
  await expect(page.locator('#gcode-cutOrder')).toHaveValue('all-stitches-first');
});

test('each origin shifts GCode and preview sheet together and exports matching coordinates', async ({
  page,
}) => {
  await generate(page);
  for (const origin of ['upper-right', 'upper-left', 'lower-right', 'center', 'lower-left']) {
    await page.locator('#gcode-origin').selectOption(origin);
    await expect(page.locator('#exportGcode')).toBeDisabled();
    await generate(page);
    const code = await page.locator('#gcodeCode').inputValue();
    expect(code).toContain(`; Origin: ${origin}`);
    const sheet = page.locator('.gcode-sheet');
    const x = Number(await sheet.getAttribute('x')),
      y = Number(await sheet.getAttribute('y'));
    const width = Number(await sheet.getAttribute('width')),
      height = Number(await sheet.getAttribute('height'));
    expect(x).toBeLessThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(0);
    expect(x + width).toBeGreaterThanOrEqual(-0.000001);
    expect(y + height).toBeGreaterThanOrEqual(-0.000001);
    if (origin === 'upper-right') {
      expect(x).toBeCloseTo(-width);
      expect(y).toBeCloseTo(0);
    }
    if (origin === 'lower-left') {
      expect(x).toBeCloseTo(0);
      expect(y).toBeCloseTo(-height);
    }
    await expect(page.locator('.gcode-origin')).toHaveCount(1);
    expect((await downloadText(page, '#exportGcode')).text).toBe(code);
  }
});

test('header-details toggle adds current design comments, persists, and leaves toolpaths unchanged', async ({
  page,
}) => {
  await generate(page);
  const before = await page.locator('#gcodeCode').inputValue();
  const cutBefore = await page.locator('.gcode-cut').getAttribute('d');
  await page.locator('#gcode-includeSettings').check();
  await expect(page.locator('#exportGcode')).toBeDisabled();
  await generate(page);
  const code = await page.locator('#gcodeCode').inputValue();
  expect(code).toContain('; Panel settings and layout details');
  expect(code).toContain(';     "side": 30');
  expect(code).toContain(';     "panelCount": 9');
  expect(await page.locator('.gcode-cut').getAttribute('d')).toBe(cutBefore);
  expect((await downloadText(page, '#exportGcode')).text).toBe(code);
  const saved = (await downloadText(page, '#exportSettings')).text;
  expect(JSON.parse(saved).gcode.includeSettings).toBe(true);
  await page.locator('#resetGcodeSettings').click();
  await expect(page.locator('#gcode-includeSettings')).not.toBeChecked();
  await page.locator('#importFile').setInputFiles({
    name: 'header.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saved),
  });
  await expect(page.locator('#gcode-includeSettings')).toBeChecked();
  await page.locator('#gcode-includeSettings').uncheck();
  await generate(page);
  expect(await page.locator('#gcodeCode').inputValue()).toBe(before);
});

test('all cut orders, scaled hole outlines and kerf errors are handled', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const order of ['all-stitches-first', 'panel-by-panel', 'optimized']) {
    await page.locator('#gcode-cutOrder').selectOption(order);
    await generate(page);
  }
  await page.locator('#gcode-stitchMode').selectOption('outline');
  await page.locator('#exportScaleNumber').fill('125');
  await generate(page);
  expect(await page.locator('#gcodeCode').inputValue()).toContain('scale 125%');
  await page.locator('#gcode-kerf').fill('2');
  await page.locator('#generateGcode').click();
  await expect(page.locator('#exportGcode')).toBeDisabled();
  await expect(page.locator('#gcodeStatus')).toContainText(/diameter|kerf/);
  await page.locator('#gcode-cutSpeed').fill('');
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.locator('#exportSettings').click();
  await expect(page.locator('#gcodeStatus')).toContainText(
    'Settings not exported: Invalid GCode cutSpeed',
  );
  expect(downloads).toBe(0);
  expect(errors).toEqual([]);
});

test('accepted optimized layouts feed GCode and pending candidates do not', async ({ page }) => {
  await generate(page);
  const original = await page.locator('#gcodeCode').inputValue();
  await page.locator('#optimizeLayout').click();
  await page.locator('#startNesting').click();
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await generate(page);
  expect(await page.locator('#gcodeCode').inputValue()).toBe(original);
  await page.locator('#applyNesting').click();
  await expect(page.locator('#exportGcode')).toBeDisabled();
  await generate(page);
  expect(await page.locator('#gcodeCode').inputValue()).not.toBe(original);
});

test('phone layout contains preview, readable controls, and code view without page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await generate(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.locator('#gcodePreview').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../gcode-phone.png' });
  await page.locator('#gcodeView').selectOption('code');
  await expect(page.locator('#gcodeCode')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
