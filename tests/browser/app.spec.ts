import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function settingsDownload(page: Page) {
  const pending = page.waitForEvent('download');
  await page.locator('#exportSettings').click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, 'utf8'));
}

async function importSettings(page: Page, data: unknown, validLayout = true) {
  await page.locator('#importFile').setInputFiles({
    name: 'settings.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(page.locator('#importFile')).toHaveValue('');
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(validLayout ? 1 : 0);
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

test('advanced disclosure has a drawn marker and supports keyboard toggling', async ({ page }) => {
  const summary = page.locator('#advanced summary');
  const marker = () =>
    summary.evaluate((element) => {
      const css = getComputedStyle(element, '::after');
      return {
        content: css.content,
        border: css.borderTopStyle,
        width: css.borderTopWidth,
        transform: css.transform,
      };
    });
  const collapsed = await marker();
  expect(collapsed.content).toBe('""');
  expect(collapsed.border).toBe('solid');
  expect(parseFloat(collapsed.width)).toBeGreaterThan(0);
  await summary.focus();
  await summary.press('Enter');
  await expect(page.locator('#advanced')).toHaveAttribute('open', '');
  await expect.poll(async () => (await marker()).transform).toBe('matrix(-1, 0, 0, -1, 0, 0)');
  await summary.press('Space');
  await expect(page.locator('#advanced')).not.toHaveAttribute('open');
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
  await importSettings(
    page,
    {
      ...overlapping,
      side: 10,
      showHoles: false,
      layout: { ...overlapping.layout, rows: 3 },
    },
    false,
  );
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

test('immediate exports flush pending panel edits before reading SVGs or settings', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [button, host, size] of [
    ['downloadSvg', '#svgHost', 41],
    ['downloadPageSvg', '#pageSvgHost', 52],
  ] as const) {
    const pending = page.waitForEvent('download');
    // Edit and download in the same browser task: the debounce cannot fire first.
    await page.evaluate(
      ({ button, size }) => {
        const input = document.querySelector<HTMLInputElement>('#sideNumber')!;
        input.value = String(size);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById(button)!.click();
      },
      { button, size },
    );
    const download = await pending;
    const exported = await readFile((await download.path())!, 'utf8');
    await expect(page.locator('#panelSideLengthValue')).toHaveText(`${size.toFixed(1)} mm`);
    const preview = await page.locator(`${host} svg`).evaluate((svg) => ({
      width: svg.getAttribute('width'),
      height: svg.getAttribute('height'),
      path: svg.querySelector('path')!.getAttribute('d'),
    }));
    expect(exported).toContain(`width="${preview.width}"`);
    expect(exported).toContain(`height="${preview.height}"`);
    expect(exported).toContain(`d="${preview.path}"`);
    // The queued render must not later overwrite the exported design.
    await page.waitForTimeout(150);
    await expect(page.locator(`${host} svg`)).toHaveAttribute('width', preview.width!);
  }
  const pending = page.waitForEvent('download');
  await page.evaluate(() => {
    const shape = document.querySelector<HTMLSelectElement>('#shape')!;
    shape.value = '10';
    shape.dispatchEvent(new Event('change', { bubbles: true }));
    const spacing = document.querySelector<HTMLInputElement>('#holeSpacingNumber')!;
    spacing.value = '20';
    spacing.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('exportSettings')!.click();
  });
  const saved = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(saved.shape).toBe(10);
  expect(saved.holeSpacing).toBeLessThan(20);
  expect(saved.holeSpacing).toBe(Number(await page.locator('#holeSpacing').inputValue()));
  expect(errors).toEqual([]);
});

test('invalid sheets block layout exports and recover when spacing is corrected', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const initial = await settingsDownload(page);
  for (const [hSpace, vSpace] of [
    [-20, 0],
    [0, -20],
    [-20, -20],
  ]) {
    await importSettings(
      page,
      {
        ...initial,
        shape: 4,
        side: 10,
        curved: false,
        showHoles: false,
        layout: { ...initial.layout, rows: 3, cols: 3, padding: 0, hSpace, vSpace, invert: false },
      },
      false,
    );
    await expect(page.locator('#downloadPageSvg')).toBeDisabled();
    await expect(page.locator('#pageSvgHost [role=status]')).toContainText(
      'Increase horizontal or vertical spacing',
    );
    await expect(page.locator('#downloadSvg')).toBeEnabled();
  }
  await page.locator('#pageHSpaceNumber').fill('0');
  await page.locator('#pageVSpaceNumber').fill('0');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await expect(page.locator('#pageSvgHost [role=status]')).toHaveCount(0);
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(1);
  const pending = page.waitForEvent('download');
  await page.locator('#downloadPageSvg').click();
  const text = await readFile((await (await pending).path())!, 'utf8');
  expect(parseFloat(text.match(/\bwidth="([^"]+)"/)![1])).toBeGreaterThan(0);
  expect(parseFloat(text.match(/\bheight="([^"]+)"/)![1])).toBeGreaterThan(0);
  // A pending panel edit may invalidate a previously downloadable layout.
  await importSettings(page, {
    ...initial,
    shape: 4,
    side: 30,
    curved: false,
    showHoles: false,
    layout: {
      ...initial.layout,
      rows: 3,
      cols: 3,
      padding: 0,
      hSpace: -20,
      vSpace: -20,
      invert: false,
    },
  });
  let unexpectedDownloads = 0;
  page.on('download', () => unexpectedDownloads++);
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#sideNumber')!;
    input.value = '10';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('downloadPageSvg')!.click();
  });
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(0);
  await page.waitForTimeout(150);
  expect(unexpectedDownloads).toBe(0);
  expect(errors).toEqual([]);
});

test('every help icon is an accessible button and supports keyboard dismissal', async ({
  page,
}) => {
  const icons = page.locator('.tooltip-icon');
  expect(await icons.count()).toBe(20);
  for (const icon of await icons.all()) {
    await expect(icon).toHaveAttribute('type', 'button');
    await expect(icon).toHaveAttribute('aria-label', /^About .+/);
    const id = await icon.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    await expect(page.locator(`#${id}`)).toHaveAttribute('role', 'tooltip');
  }
  const icon = page.getByRole('button', { name: 'About Edge style', exact: true });
  const tip = page.locator(`#${await icon.getAttribute('aria-describedby')}`);
  await icon.focus();
  await expect(tip).toBeVisible();
  await icon.press('Escape');
  await expect(tip).toBeHidden();
  await expect(icon).toBeFocused();
  await icon.press('Enter');
  await expect(tip).toBeVisible();
  await icon.press('Escape');
  await expect(tip).toBeHidden();
  await icon.press('Space');
  await expect(tip).toBeVisible();
  await page.locator('h1').click();
  await expect(tip).toBeHidden();
});

test('optional nesting previews savings before applying, preserves exports and round trips settings', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, {
    ...initial,
    shape: 5,
    curved: false,
    layout: { ...initial.layout, hSpace: 10, vSpace: 10 },
  });
  const manual = await page.locator('#pageSvgHost svg').getAttribute('width');
  const originalPath = await page.locator('#svgHost path').getAttribute('d');
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await expect(page.locator('#nestingStatus')).toContainText('less');
  await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', manual!);
  await page.locator('#applyNesting').click();
  await expect(page.locator('#manualLayout')).toBeEnabled();
  const optimized = await page.locator('#pageSvgHost svg').evaluate((svg) => svg.outerHTML);
  const saved = await settingsDownload(page);
  expect(saved.layout.optimized.version).toBe(1);
  expect(saved.layout.optimized.placements).toHaveLength(9);
  await expect(page.locator('#pageSvgHost svg path')).toHaveCount(9);
  for (const path of await page.locator('#pageSvgHost svg path').all())
    await expect(path).toHaveAttribute('d', originalPath!);
  await page.locator('#exportScale').fill('125');
  const width = await page.locator('#pageSvgHost svg').getAttribute('width');
  const pending = page.waitForEvent('download');
  await page.locator('#downloadPageSvg').click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('footbag-nested-9panels-125pct.svg');
  const text = await readFile((await download.path())!, 'utf8');
  expect(parseFloat(text.match(/\bwidth="([^"]+)"/)![1])).toBeCloseTo(parseFloat(width!) * 1.25, 8);
  expect(text).not.toContain('<use');
  await page.locator('#manualLayout').click();
  await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', manual!);
  await importSettings(page, saved);
  expect(await page.locator('#pageSvgHost svg').evaluate((svg) => svg.outerHTML)).toBe(optimized);
  // Old exports explicitly restore manual layout even after an optimized import.
  delete saved.layout.optimized;
  await importSettings(page, saved);
  await expect(page.locator('#manualLayout')).toBeDisabled();
  await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', manual!);
});

test('design and manual layout edits invalidate optimization without changing panel geometry', async ({
  page,
}) => {
  for (const selector of ['#sideNumber', '#pageHSpaceNumber']) {
    await page.locator('#optimizeLayout').click();
    await expect(page.locator('#applyNesting')).toBeEnabled();
    await page.locator('#applyNesting').click();
    await expect(page.locator('#manualLayout')).toBeEnabled();
    await page.locator(selector).fill(selector === '#sideNumber' ? '40' : '5');
    await expect(page.locator('#manualLayout')).toBeDisabled();
    const saved = await settingsDownload(page);
    expect(saved.layout.optimized).toBeUndefined();
    await expect(page.locator('#pageSvgHost svg path')).toHaveCount(9);
  }
});

test('clearance check detects overlap and safely checks an optimized curved star', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, {
    ...initial,
    shape: 4,
    curved: false,
    showHoles: false,
    layout: { ...initial.layout, hSpace: -20, vSpace: -20 },
  });
  await page.locator('#checkClearance').click();
  await expect(page.locator('#nestingStatus')).toContainText('overlap, touch, or are too close');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await importSettings(page, {
    ...initial,
    shape: 10,
    curved: true,
    starRootAngle: 128,
    layout: { ...initial.layout, rows: 2, cols: 3 },
  });
  await page.locator('#nestingRotation').selectOption('quarter');
  await page.locator('#nestingGap').fill('2');
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  await page.locator('#checkClearance').click();
  await expect(page.locator('#nestingStatus')).toContainText('All cut outlines meet');
  const saved = await settingsDownload(page);
  expect(saved.layout.optimized.gap).toBe(2);
  expect(saved.layout.optimized.placements).toHaveLength(6);
});

test('nesting worker cancellation and setting edits cannot apply stale results', async ({
  page,
}) => {
  const before = await page.locator('#pageSvgHost svg').getAttribute('width');
  // The worker cannot deliver a result before this same browser task cancels it.
  await page.evaluate(() => {
    document.getElementById('optimizeLayout')!.click();
    document.getElementById('cancelNesting')!.click();
  });
  await expect(page.locator('#nestingStatus')).toContainText('cancelled');
  await expect(page.locator('#applyNesting')).toBeDisabled();
  await page.waitForTimeout(200);
  await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', before!);
  await page.evaluate(() => {
    document.getElementById('optimizeLayout')!.click();
    const input = document.querySelector<HTMLInputElement>('#sideNumber')!;
    input.value = '42';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#nestingStatus')).toContainText('Settings changed');
  await expect(page.locator('#applyNesting')).toBeDisabled();
  await expect(page.locator('#panelSideLengthValue')).toHaveText('42.0 mm');
  await page.waitForTimeout(200);
  await expect(page.locator('#applyNesting')).toBeDisabled();
});

test('malformed optimized imports are atomic and unsafe arrangements fall back to manual', async ({
  page,
}) => {
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  const saved = await settingsDownload(page);
  const before = await page.locator('#pageSvgHost svg').getAttribute('width');
  const dialog = page.waitForEvent('dialog');
  await page.locator('#importFile').setInputFiles({
    name: 'bad-nesting.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...saved,
        side: 60,
        layout: { ...saved.layout, optimized: { ...saved.layout.optimized, gap: -1 } },
      }),
    ),
  });
  await (await dialog).dismiss();
  await expect(page.locator('#sideNumber')).toHaveValue('30');
  await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', before!);
  saved.layout.optimized.placements = saved.layout.optimized.placements.map(() => ({
    x: 0,
    y: 0,
    angle: 0,
  }));
  await importSettings(page, saved);
  await expect(page.locator('#manualLayout')).toBeDisabled();
  await expect(page.locator('#nestingStatus')).toContainText('Manual layout restored');
  await expect(page.locator('#pageSvgHost svg path')).toHaveCount(9);
});

test('nesting controls work at phone width and reset restores manual layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const help = page.getByRole('button', { name: 'About Optimize layout', exact: true });
  await help.click();
  await expect(page.locator('#optimizeLayoutHelp')).toBeVisible();
  await expect(page.locator('#optimizeLayoutHelp')).toContainText(
    'unless you choose capacity mode',
  );
  await help.press('Escape');
  await expect(page.locator('#optimizeLayoutHelp')).toBeHidden();
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  const applied = await settingsDownload(page);
  expect(applied.layout.optimized.placements).toHaveLength(9);
  await page.locator('#resetLayoutSettings').click();
  await expect(page.locator('#manualLayout')).toBeDisabled();
  expect((await settingsDownload(page)).layout.optimized).toBeUndefined();
  const bounds = await page.locator('.nesting-tools').boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});

test('stock fitting accounts for export scale and blocks an outgrown arrangement until it fits again', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, { ...initial, shape: 4, curved: false, showHoles: false });
  await page.locator('#nestingMode').selectOption('fit');
  await page.locator('#nestingRotation').selectOption('none');
  await page.locator('#nestingStockWidth').fill('120');
  await page.locator('#nestingStockHeight').fill('120');
  await page.locator('#exportScale').fill('125');
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#nestingStatus')).toContainText('No arrangement found');
  await expect(page.locator('#applyNesting')).toBeDisabled();
  await page.locator('#nestingStockWidth').fill('150');
  await page.locator('#nestingStockHeight').fill('150');
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await expect(page.locator('#nestingStatus')).toContainText('125% export');
  await page.locator('#applyNesting').click();
  const saved = await settingsDownload(page);
  expect(saved.layout.optimized.stock).toEqual({ mode: 'fit', width: 150, height: 150 });
  expect(
    saved.layout.optimized.placements.every(
      (p: { angle: number; flipY?: boolean }) => p.angle === 0 && !p.flipY,
    ),
  ).toBe(true);
  const pending = page.waitForEvent('download');
  await page.locator('#downloadPageSvg').click();
  const exported = await readFile((await (await pending).path())!, 'utf8');
  expect(parseFloat(exported.match(/\bwidth="([^"]+)"/)![1])).toBeLessThanOrEqual(150);
  expect(parseFloat(exported.match(/\bheight="([^"]+)"/)![1])).toBeLessThanOrEqual(150);
  let unexpected = 0;
  page.on('download', () => unexpected++);
  await page.evaluate(() => {
    const scale = document.querySelector<HTMLInputElement>('#exportScale')!;
    scale.value = '200';
    scale.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('downloadPageSvg')!.click();
  });
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  await expect(page.locator('#pageSvgHost')).toContainText('exceeds the stock limits');
  await expect(page.locator('#manualLayout')).toBeEnabled();
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(0);
  await page.waitForTimeout(150);
  expect(unexpected).toBe(0);
  await page.locator('#exportScale').fill('125');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await expect(page.locator('#pageSvgHost path')).toHaveCount(9);
  expect((await settingsDownload(page)).layout.optimized).toEqual(saved.layout.optimized);
  await importSettings(page, { ...saved, export: { scalePercent: 200 } }, false);
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  await page.locator('#manualLayout').click();
  await expect(page.locator('#pageSvgHost path')).toHaveCount(9);
});

test('capacity uses actual panel count, round trips limits, and preserves the manual arrangement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const initial = await settingsDownload(page);
  await importSettings(page, { ...initial, shape: 4, curved: false, showHoles: false });
  const manual = await page.locator('#pageSvgHost svg').getAttribute('width');
  await page.locator('#nestingMode').selectOption('capacity');
  await page.locator('#nestingRotation').selectOption('none');
  await page.locator('#nestingStockWidth').fill('120');
  await page.locator('#nestingStockHeight').fill('85');
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await expect(page.locator('#nestingStatus')).toContainText('Best capacity found: 6 panels');
  await expect(page.locator('#nestingStatus')).toContainText('not a proven maximum');
  await page.locator('#applyNesting').click();
  await expect(page.locator('#pageSvgHost path')).toHaveCount(6);
  await expect(page.locator('#pageRowsNumber')).toHaveValue('3');
  await expect(page.locator('#pageColsNumber')).toHaveValue('3');
  const saved = await settingsDownload(page);
  expect(saved.layout.optimized.placements).toHaveLength(6);
  const pending = page.waitForEvent('download');
  await page.locator('#downloadPageSvg').click();
  expect((await pending).suggestedFilename()).toBe('footbag-nested-6panels.svg');
  await page.locator('#nestingStockWidth').fill('10');
  await expect(page.locator('#nestingStatus')).toContainText('keeps its saved limits');
  expect((await settingsDownload(page)).layout.optimized.stock.width).toBe(120);
  await page.locator('#manualLayout').click();
  await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', manual!);
  await expect(page.locator('#pageSvgHost path')).toHaveCount(9);
  await importSettings(page, saved);
  await expect(page.locator('#pageSvgHost path')).toHaveCount(6);
  await expect(page.locator('#nestingMode')).toHaveValue('capacity');
  await expect(page.locator('#nestingStockWidth')).toHaveValue('120');
  await page.locator('#resetLayoutSettings').click();
  await expect(page.locator('#nestingMode')).toHaveValue('free');
  await expect(page.locator('#nestingRotation')).toHaveValue('half');
  await expect(page.locator('#nestingStockWidth')).toHaveValue('');
  await expect(page.locator('#pageSvgHost path')).toHaveCount(9);
});

test('stock search handles missing dimensions, no fit, quarter turns and stale candidates', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, {
    ...initial,
    shape: 3,
    curved: false,
    showHoles: false,
    layout: { ...initial.layout, rows: 1, cols: 1 },
  });
  await page.locator('#nestingMode').selectOption('capacity');
  await page.locator('#nestingStockWidth').fill('49');
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#nestingStatus')).toContainText('requires both');
  await expect(page.locator('#applyNesting')).toBeDisabled();
  await page.locator('#nestingMode').selectOption('fit');
  await page.locator('#nestingRotation').selectOption('none');
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#nestingStatus')).toContainText('No arrangement found');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await page.locator('#nestingRotation').selectOption('quarter');
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#exportScale').fill('125');
  await expect(page.locator('#applyNesting')).toBeDisabled();
  await page.locator('#exportScale').fill('100');
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  const saved = await settingsDownload(page);
  expect([90, 270]).toContain(saved.layout.optimized.placements[0].angle);
  delete saved.layout.nesting;
  delete saved.layout.optimized.rotations;
  delete saved.layout.optimized.stock;
  await importSettings(page, saved);
  await expect(page.locator('#nestingMode')).toHaveValue('free');
  await expect(page.locator('#nestingRotation')).toHaveValue('quarter');
});

test('large layout bursts reuse panel drawings and commit only the latest value once per frame', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, {
    ...initial,
    shape: 10,
    curved: false,
    stitches: 20,
    layout: { ...initial.layout, rows: 12, cols: 12, hSpace: 0, vSpace: 1 },
  });
  await expect(page.locator('#pageSvgHost circle')).toHaveCount(28800);
  const result = await page.evaluate(async () => {
    const host = document.getElementById('pageSvgHost')!,
      svg = host.querySelector('svg')!;
    const path = svg.querySelector('path'),
      circle = svg.querySelector('circle');
    const beforeWidth = svg.getAttribute('width');
    let widthWrites = 0,
      replacements = 0;
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') widthWrites++;
        else replacements += r.addedNodes.length;
      }
    });
    observer.observe(svg, { attributes: true, attributeFilter: ['width'] });
    observer.observe(host, { childList: true });
    const input = document.querySelector<HTMLInputElement>('#pageHSpaceNumber')!;
    for (let i = 1; i <= 24; i++) {
      input.value = String(i);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const beforeFrame = svg.getAttribute('width');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    observer.disconnect();
    return {
      beforeWidth,
      beforeFrame,
      widthWrites,
      replacements,
      sameSvg: svg === host.querySelector('svg'),
      samePath: path === svg.querySelector('path'),
      sameCircle: circle === svg.querySelector('circle'),
      widthDelta: parseFloat(svg.getAttribute('width')!) - parseFloat(beforeWidth!),
    };
  });
  expect(result.beforeFrame).toBe(result.beforeWidth);
  expect(result.widthWrites).toBe(1);
  expect(result.replacements).toBe(0);
  expect(result.sameSvg && result.samePath && result.sameCircle).toBe(true);
  expect(result.widthDelta).toBeCloseTo(11 * 24, 8);
  expect((await settingsDownload(page)).layout.hSpace).toBe(24);
});

test('grid toggles retain drawings and panel grid leaves the sheet completely unchanged', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const panel = document.querySelector('#svgHost svg')!,
      sheet = document.querySelector('#pageSvgHost svg')!;
    const panelPath = panel.querySelector('path'),
      panelCircle = panel.querySelector('circle');
    const sheetPath = sheet.querySelector('path'),
      sheetCircle = sheet.querySelector('circle');
    const beforeSheet = sheet.outerHTML;
    const toggle = (id: string) => {
      const input = document.getElementById(id) as HTMLInputElement;
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    toggle('showGrid');
    const untouched =
      sheet.outerHTML === beforeSheet && sheet === document.querySelector('#pageSvgHost svg');
    const panelGridHidden = !panel.querySelector('#grid');
    toggle('showGrid');
    toggle('pageShowGrid');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const sheetGridHidden = !sheet.querySelector('#grid');
    toggle('pageShowGrid');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      untouched,
      panelGridHidden,
      sheetGridHidden,
      panelGridRestored: !!panel.querySelector('#grid'),
      sheetGridRestored: !!sheet.querySelector('#grid'),
      panelRetained:
        panel === document.querySelector('#svgHost svg') &&
        panelPath === panel.querySelector('path') &&
        panelCircle === panel.querySelector('circle'),
      sheetRetained:
        sheet === document.querySelector('#pageSvgHost svg') &&
        sheetPath === sheet.querySelector('path') &&
        sheetCircle === sheet.querySelector('circle'),
    };
  });
  expect(Object.values(result).every(Boolean)).toBe(true);
});

test('simultaneous pending panel and layout edits are flushed into both SVG and settings downloads', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  for (const button of ['downloadSvg', 'downloadPageSvg', 'exportSettings']) {
    await importSettings(page, {
      ...initial,
      shape: 4,
      side: 30,
      curved: false,
      showHoles: false,
      layout: {
        ...initial.layout,
        rows: 2,
        cols: 3,
        hSpace: 0,
        vSpace: 5,
        padding: 10,
        invert: false,
        nestingOffset: 0,
      },
    });
    await page.locator('#exportScale').fill('125');
    const pending = page.waitForEvent('download');
    await page.evaluate((button) => {
      for (const [id, value] of [
        ['sideNumber', '40'],
        ['pageHSpaceNumber', '4'],
      ]) {
        const input = document.getElementById(id) as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.getElementById(button)!.click();
    }, button);
    const download = await pending;
    const text = await readFile((await download.path())!, 'utf8');
    if (button === 'exportSettings') {
      const data = JSON.parse(text);
      expect(data.side).toBe(40);
      expect(data.layout.hSpace).toBe(4);
      expect(data.export.scalePercent).toBe(125);
    } else {
      const width = parseFloat(text.match(/\bwidth="([^"]+)"/)![1]);
      expect(width).toBeCloseTo((button === 'downloadSvg' ? 60 : 151) * 1.25, 8);
    }
    await expect(page.locator('#dimensionsValue')).toHaveText('151.0 × 107.0');
    const settled = await page.locator('#pageSvgHost svg').getAttribute('width');
    await page.waitForTimeout(150);
    await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', settled!);
  }
});

test('nesting checks flush pending layout changes and optimized grid updates preserve placements', async ({
  page,
}) => {
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#pageHSpaceNumber')!;
    input.value = '10';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('optimizeLayout')!.click();
  });
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  await expect(page.locator('#manualLayout')).toBeEnabled();
  const before = await settingsDownload(page);
  const retained = await page.evaluate(async () => {
    const svg = document.querySelector('#pageSvgHost svg')!,
      circle = svg.querySelector('circle');
    const input = document.querySelector<HTMLInputElement>('#pageShowGrid')!;
    input.checked = !input.checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return (
      svg === document.querySelector('#pageSvgHost svg') && circle === svg.querySelector('circle')
    );
  });
  expect(retained).toBe(true);
  expect((await settingsDownload(page)).layout.optimized).toEqual(before.layout.optimized);
});
