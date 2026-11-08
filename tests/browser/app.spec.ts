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
  await expect(page.locator('#importFile')).toHaveValue('');
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

test('the same saved design imports identically after restrictive or large designs', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  const target = {
    ...initial,
    side: 60,
    seam: 0,
    stitches: 4,
    curved: false,
    curveRadius: 45,
    holeSpacing: 10,
    cornerMargin: 8,
    holeBunching: 3,
    layout: { ...initial.layout, invert: true, nestingOffset: -4 },
  };
  await importSettings(page, target);
  const expected = await settingsDownload(page);
  const outline = await page.locator('#svgHost svg path').getAttribute('d');
  await importSettings(page, { ...initial, side: 10, seam: 0, stitches: 20, holeSpacing: 1 });
  await expect.poll(() => page.locator('#holeSpacing').getAttribute('max')).not.toBe('20');
  await importSettings(page, target);
  await expect(page.locator('#holeSpacingNumber')).toHaveValue('10');
  await expect(page.locator('#holeBunchingNumber')).toHaveValue('3');
  await expect(page.locator('#cornerMarginNumber')).toHaveValue('8');
  await expect(page.locator('#nestingOffsetRow')).toBeVisible();
  expect(await settingsDownload(page)).toEqual(expected);
  await expect(page.locator('#svgHost svg path')).toHaveAttribute('d', outline!);

  await importSettings(page, { ...initial, side: 80, curved: true, curveRadius: 60 });
  await expect(page.locator('#curveRadius')).toHaveAttribute('min', '40');
  await importSettings(page, { ...initial, side: 30, curved: true, curveRadius: 20 });
  await expect(page.locator('#curveRadiusNumber')).toHaveValue('20');
  await importSettings(page, { ...initial, shape: 4, side: 80, curved: true, curveRadius: 10 });
  await expect
    .poll(async () => Number(await page.locator('#curveRadiusNumber').inputValue()))
    .toBeCloseTo(40, 10);
  await expect(page.locator('#svgHost svg path')).toHaveAttribute('d', /A/);
});

test('valid JSON with invalid settings leaves the design and previews untouched', async ({
  page,
}) => {
  await page.locator('#exportScale').fill('125');
  const before = await settingsDownload(page);
  const panel = await page.locator('#svgHost').innerHTML();
  const sheet = await page.locator('#pageSvgHost').innerHTML();
  for (const invalid of [
    null,
    [],
    {},
    { ...before, side: 70, seam: 'wrong' },
    { ...before, version: 2 },
  ]) {
    const pending = page.waitForEvent('dialog');
    await page.locator('#importFile').setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
    const dialog = await pending;
    expect(dialog.message()).toBe('Invalid settings file.');
    await dialog.dismiss();
    expect(await settingsDownload(page)).toEqual(before);
    expect(await page.locator('#svgHost').innerHTML()).toBe(panel);
    expect(await page.locator('#pageSvgHost').innerHTML()).toBe(sheet);
  }
});

test('star limits follow the actual root angle and outer radius', async ({ page }) => {
  const initial = await settingsDownload(page);
  await importSettings(page, {
    ...initial,
    shape: 10,
    side: 30,
    starRootAngle: 128,
    curved: false,
    cornerMargin: 0,
    stitches: 8,
    holeSpacing: 3,
  });
  await expect(page.locator('#holeSpacing')).toHaveAttribute('max', '5.1');
  await expect(page.locator('#curveRadius')).toHaveAttribute('min', '10');
  await page.locator('#starRootAngleNumber').fill('100');
  await expect(page.locator('#holeSpacing')).toHaveAttribute('max', '4.6');
  await page.locator('#starRootAngleNumber').fill('150');
  await expect(page.locator('#holeSpacing')).toHaveAttribute('max', '5.9');
  await expect(page.locator('#curveRadius')).toHaveAttribute('min', '11.5');
  await page.locator('#starRootAngleNumber').fill('128');
  await page.locator('#sideNumber').fill('80');
  await expect(page.locator('#holeSpacing')).toHaveAttribute('max', '14.4');
  await expect(page.locator('#curveRadius')).toHaveAttribute('min', '27');
});

test('legacy star spacing is clamped consistently and the corrected design round trips', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, {
    ...initial,
    shape: 10,
    side: 30,
    starRootAngle: 128,
    curved: false,
    cornerMargin: 0,
    stitches: 8,
    holeSpacing: 8,
    holeBunching: 2,
  });
  await expect(page.locator('#holeSpacing')).toHaveAttribute('max', '5.1');
  const spacing = Number(await page.locator('#holeSpacing').inputValue());
  expect(spacing).toBeLessThanOrEqual(5.1);
  await expect(page.locator('#holeSpacingNumber')).toHaveValue(String(spacing));
  const corrected = await settingsDownload(page);
  const panelBefore = await page.locator('#svgHost svg').innerHTML();
  const sheetBefore = await page.locator('#pageSvgHost svg').innerHTML();
  await importSettings(page, corrected);
  expect(await settingsDownload(page)).toEqual(corrected);
  expect(await page.locator('#svgHost svg').innerHTML()).toBe(panelBefore);
  expect(await page.locator('#pageSvgHost svg').innerHTML()).toBe(sheetBefore);
});

test('changing a curved star angle renders the resolved radius immediately and exports it', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, {
    ...initial,
    shape: 10,
    side: 80,
    starRootAngle: 128,
    curved: true,
    curveRadius: 30,
    cornerMargin: 0,
    holeSpacing: 3,
  });
  await expect(page.locator('#curveRadiusNumber')).toHaveValue('30');
  await expect(page.locator('#svgHost svg path')).toHaveAttribute('d', /A 30\.000/);
  await importSettings(page, {
    ...initial,
    shape: 10,
    side: 80,
    starRootAngle: 100,
    curved: true,
    curveRadius: 10,
    cornerMargin: 0,
    holeSpacing: 3,
  });
  const oldRadius = Number(await page.locator('#curveRadius').inputValue());
  await page.locator('#starRootAngleNumber').fill('150');
  await expect
    .poll(async () => Number(await page.locator('#curveRadius').inputValue()))
    .toBeGreaterThan(oldRadius);
  const radius = await page.locator('#curveRadius').inputValue();
  await expect(page.locator('#curveRadiusNumber')).toHaveValue(radius);
  const path = await page.locator('#svgHost svg path').getAttribute('d');
  expect(path).toContain(`A ${Number(radius).toFixed(3)}`);
  expect(path).not.toContain(' L ');
  for (const button of ['#downloadSvg', '#downloadPageSvg']) {
    const pending = page.waitForEvent('download');
    await page.locator(button).click();
    const download = await pending;
    const text = await readFile((await download.path())!, 'utf8');
    expect(text).toContain(`d="${path}"`);
  }
});

test('panel area ratio matches the exported sheet and responds to padding and dot size', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, {
    ...initial,
    shape: 4,
    side: 30,
    curved: false,
    dotSize: 1,
    layout: {
      ...initial.layout,
      rows: 2,
      cols: 3,
      hSpace: 4,
      vSpace: 5,
      padding: 10,
      invert: false,
      nestingOffset: 0,
    },
  });
  await expect(page.locator('#utilizationValue')).toHaveText('51.3%');
  await expect(page.locator('#dimensionsValue')).toHaveText('121.0 × 87.0');
  await page.locator('#pagePaddingNumber').fill('20');
  await expect(page.locator('#utilizationValue')).toHaveText(
    `${((5400 / (141 * 107)) * 100).toFixed(1)}%`,
  );
  await page.locator('#pagePaddingNumber').fill('10');
  await page.locator('#advanced').evaluate((element: HTMLDetailsElement) => (element.open = true));
  await page.locator('#dotSizeNumber').fill('1.5');
  const expected = `${((5400 / (122.5 * 88)) * 100).toFixed(1)}%`;
  await expect(page.locator('#utilizationValue')).toHaveText(expected);
  await page.locator('#exportScale').fill('125');
  const pending = page.waitForEvent('download');
  await page.locator('#downloadPageSvg').click();
  const download = await pending;
  const text = await readFile((await download.path())!, 'utf8');
  expect(parseFloat(text.match(/\bwidth="([^"]+)"/)![1])).toBeCloseTo(122.5 * 1.25, 8);
  expect(parseFloat(text.match(/\bheight="([^"]+)"/)![1])).toBeCloseTo(88 * 1.25, 8);
  await expect(page.locator('#utilizationValue')).toHaveText(expected);
});

test('overlap ratios and invalid sheet dimensions have explicit meanings', async ({ page }) => {
  const initial = await settingsDownload(page);
  const overlapping = {
    ...initial,
    shape: 4,
    side: 30,
    curved: false,
    dotSize: 1,
    layout: {
      ...initial.layout,
      rows: 2,
      cols: 2,
      hSpace: -20,
      vSpace: -20,
      padding: 0,
      invert: false,
      nestingOffset: 0,
    },
  };
  await importSettings(page, overlapping);
  await expect(page.locator('#utilizationValue')).toHaveText('204.1%');
  await page.getByRole('button', { name: 'About panel area utilization' }).click();
  await expect(page.locator('#utilizationHelp')).toBeVisible();
  await expect(page.locator('#utilizationHelp')).toContainText(
    'Overlapping panels are counted separately',
  );
  await importSettings(page, {
    ...overlapping,
    side: 10,
    showHoles: false,
    layout: { ...overlapping.layout, rows: 3 },
  });
  await expect(page.locator('#utilizationValue')).toHaveText('—');
  await expect(page.locator('#utilizationValue')).toHaveAttribute(
    'title',
    /sheet width and height must be positive/,
  );
});

test('sheet-area explanation fits and works on a phone-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const info = page.locator('#materialUtilization');
  await info.scrollIntoViewIfNeeded();
  const bounds = await info.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'About panel area utilization' }).click();
  await expect(page.locator('#utilizationHelp')).toBeVisible();
});
