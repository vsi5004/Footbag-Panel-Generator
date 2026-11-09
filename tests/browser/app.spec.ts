import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function optimizeLayout(page: Page) {
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#nestingDialog')).toBeVisible();
  await page.locator('#startNesting').click();
}
async function setGoal(page: Page, goal: string) {
  await page.locator('#optimizeLayout').click();
  await page.locator('#nestingMode').selectOption(goal);
  await page.locator('#closeNestingDialog').click();
}
async function setStock(page: Page, id: string, value: string) {
  await page.locator('#nestingStockControls').evaluate((details: HTMLDetailsElement) => {
    details.open = true;
  });
  await page.locator(id).fill(value);
}

async function trackNestingRequests(page: Page) {
  await expect(page.locator('#clearanceStatus')).toHaveText(
    /Clearance OK|Overlaps or insufficient gap/,
  );
  await page.evaluate(() => {
    const counts = { search: 0, clearance: 0 };
    (window as unknown as { nestingRequests: typeof counts }).nestingRequests = counts;
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      this: Worker,
      message: { placements?: unknown },
      options?: Transferable[] | StructuredSerializeOptions,
    ) {
      if (message.placements) counts.clearance++;
      else counts.search++;
      return Reflect.apply(original, this, options === undefined ? [message] : [message, options]);
    };
  });
  return () =>
    page.evaluate(
      () =>
        (window as unknown as { nestingRequests: { search: number; clearance: number } })
          .nestingRequests,
    );
}

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
    { ...before, version: 999 },
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
  expect(await icons.count()).toBe(35);
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
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await expect(page.locator('#nestingStatus')).toContainText('less');
  await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', manual!);
  await page.locator('#applyNesting').click();
  await expect(page.locator('#layoutMode')).toHaveValue('pattern');
  const optimized = await page.locator('#pageSvgHost svg').evaluate((svg) => svg.outerHTML);
  const saved = await settingsDownload(page);
  expect(saved.layout.optimized).toBeUndefined();
  expect(saved.version).toBe(2);
  expect(saved.layout.editable.count).toBe(9);
  await expect(page.locator('#layoutMode')).toHaveValue('pattern');
  await expect(page.locator('#layoutPitchX')).toHaveValue(
    String(Number(saved.layout.editable.pitchX.toFixed(3))),
  );
  await expect(page.locator('#pageSvgHost svg path')).toHaveCount(9);
  for (const path of await page.locator('#pageSvgHost svg path').all())
    await expect(path).toHaveAttribute('d', originalPath!);
  await page.locator('#exportScale').fill('125');
  const width = await page.locator('#pageSvgHost svg').getAttribute('width');
  const pending = page.waitForEvent('download');
  await page.locator('#downloadPageSvg').click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('footbag-layout-9panels-125pct.svg');
  const text = await readFile((await download.path())!, 'utf8');
  expect(parseFloat(text.match(/\bwidth="([^"]+)"/)![1])).toBeCloseTo(parseFloat(width!) * 1.25, 8);
  expect(text).not.toContain('<use');
  await page.locator('#layoutMode').selectOption('grid');
  await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', manual!);
  await importSettings(page, saved);
  expect(await page.locator('#pageSvgHost svg').evaluate((svg) => svg.outerHTML)).toBe(optimized);
  // Old exports explicitly restore manual layout even after an optimized import.
  delete saved.layout.editable;
  await importSettings(page, saved);
  await expect(page.locator('#layoutMode')).toHaveValue('grid');
  await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', manual!);
});

test('panel preview fills available desktop height and still scrolls oversized drawings', async ({
  page,
}) => {
  await page.setViewportSize({ width: 2533, height: 1222 });
  await setChecked(page, '#curved', true);
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  const metrics = () =>
    page.locator('#svgHost').evaluate((host) => ({
      height: host.clientHeight,
      scroll: host.scrollHeight,
      unused: host.closest('section.preview')!.clientHeight - host.parentElement!.clientHeight,
    }));
  await expect.poll(async () => (await metrics()).unused).toBeLessThanOrEqual(26);
  await expect
    .poll(async () => {
      const m = await metrics();
      return m.scroll - m.height;
    })
    .toBeLessThanOrEqual(1);
  await page.locator('#sideNumber').fill('80');
  await page.locator('#zoom').fill('300');
  await expect
    .poll(async () => {
      const m = await metrics();
      return m.scroll - m.height;
    })
    .toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await page.locator('.preview--panel').boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});

test('accepting the curved-pentagon pattern preserves zoom even while the preview host collapses', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  for (const viewport of [
    { width: 2525, height: 1206 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await importSettings(page, {
      ...initial,
      shape: 5,
      side: 30,
      seam: 3.4,
      curved: true,
      curveRadius: 60,
      layout: { ...initial.layout, rows: 3, cols: 3, hSpace: 0, vSpace: 1, padding: 1 },
    });
    await page.locator('#nestingGap').fill('0');
    await page.locator('#pageZoom').fill('95');
    await optimizeLayout(page);
    await expect(page.locator('#applyNesting')).toBeEnabled();
    await page
      .locator('#pageSvgHost')
      .evaluate((host: HTMLElement) => (host.style.maxHeight = '1px'));
    await page.locator('#applyNesting').click();
    await expect(page.locator('#pageZoom')).toHaveValue('95');
    await expect(page.locator('#pageZoomLabel')).toHaveText('95%');
    await page.locator('#pageSvgHost').evaluate((host: HTMLElement) => (host.style.maxHeight = ''));
    await expect(page.locator('#pageSvgHost .svg-wrap')).toHaveCSS(
      'transform',
      'matrix(0.95, 0, 0, 0.95, 0, 0)',
    );
    await expect(page.locator('#pageSvgHost path')).toHaveCount(9);
    const beforeSpacingWidth = parseFloat(
      (await page.locator('#pageSvgHost svg').getAttribute('width'))!,
    );
    await page.locator('#layoutPitchX').fill('60');
    await expect(page.locator('#downloadPageSvg')).toBeEnabled();
    await expect(page.locator('#pageZoom')).toHaveValue('95');
    await expect
      .poll(async () => parseFloat((await page.locator('#pageSvgHost svg').getAttribute('width'))!))
      .toBeGreaterThan(beforeSpacingWidth);
    const width = parseFloat((await page.locator('#pageSvgHost svg').getAttribute('width'))!);
    const pending = page.waitForEvent('download');
    await page.locator('#downloadPageSvg').click();
    const text = await readFile((await (await pending).path())!, 'utf8');
    expect(parseFloat(text.match(/\bwidth="([^"]+)"/)![1])).toBeCloseTo(width, 8);
  }
});

test('worker loading and startup failures explain the app error, preserve the layout and allow retry', async ({
  page,
}) => {
  const original = await page.locator('#pageSvgHost svg').evaluate((svg) => svg.outerHTML);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/nesting-worker-*.js', (route) => route.abort());
  await optimizeLayout(page);
  await expect(page.locator('#nestingStatus')).toContainText(
    'Could not load or run the background nesting worker',
  );
  await expect(page.locator('#optimizeLayout')).toBeEnabled();
  await expect(page.locator('#applyNesting')).toBeDisabled();
  expect(await page.locator('#pageSvgHost svg').evaluate((svg) => svg.outerHTML)).toBe(original);
  await page.unroute('**/nesting-worker-*.js');
  await page.evaluate(() => {
    const originalWorker = window.Worker;
    window.Worker = class {
      constructor() {
        throw new Error('Blocked worker startup');
      }
    } as unknown as typeof Worker;
    try {
      document.getElementById('optimizeLayout')!.click();
      document.getElementById('startNesting')!.click();
    } finally {
      window.Worker = originalWorker;
    }
  });
  await expect(page.locator('#nestingStatus')).toContainText(
    'keep the local preview server running',
  );
  await expect(page.locator('#optimizeLayout')).toBeEnabled();
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  expect(await page.locator('#pageSvgHost svg').evaluate((svg) => svg.outerHTML)).toBe(original);
  expect(errors).toEqual([]);
});

test('green candidate overlays are transient, rejectable and excluded from current-layout downloads', async ({
  page,
}) => {
  const before = await settingsDownload(page);
  const svg = page.locator('#pageSvgHost svg');
  const original = await svg.evaluate((node) => node.outerHTML);
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  const overlay = page.locator('img[data-nesting-preview]');
  await expect(overlay).toHaveCount(1);
  await expect
    .poll(() => overlay.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await expect(overlay).toHaveCSS('opacity', '0.6');
  expect(await svg.evaluate((node) => node.outerHTML)).toBe(original);
  expect((await settingsDownload(page)).layout).toEqual(before.layout);
  await page.locator('#pageZoom').fill('150');
  await expect(overlay).toHaveCount(1);
  const pending = page.waitForEvent('download');
  await page.locator('#downloadPageSvg').click();
  const text = await readFile((await (await pending).path())!, 'utf8');
  expect(text).not.toContain('16a34a');
  expect(text).not.toContain('nesting-preview');
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('#applyNesting')).toBeDisabled();
  expect(await svg.evaluate((node) => node.outerHTML)).toBe(original);
  expect((await settingsDownload(page)).layout).toEqual(before.layout);
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await expect(overlay).toHaveCount(1);
  await page.locator('#applyNesting').click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('#pageSvgHost path')).toHaveCount(9);
  const accepted = await settingsDownload(page);
  expect(accepted.layout.editable.count).toBe(9);
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await expect(overlay).toHaveCount(1);
  await page.locator('#nestingGap').fill('2');
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('#applyNesting')).toBeDisabled();
  expect((await settingsDownload(page)).layout.editable).toEqual({
    ...accepted.layout.editable,
    gap: 2,
  });
});

test('accepted layouts remain editable through design changes, block overlaps and recover in place', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, { ...initial, shape: 4, curved: false, showHoles: false });
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  const accepted = await settingsDownload(page);
  await page.locator('#sideNumber').fill('25');
  await expect(page.locator('#pageSvgHost path')).toHaveCount(9);
  expect((await settingsDownload(page)).layout.editable).toEqual(accepted.layout.editable);
  await expect(page.locator('#layoutMode')).toHaveValue('pattern');
  await page.locator('#sideNumber').fill('40');
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  await expect(page.locator('#pageSvgHost')).toContainText('does not meet its cutting gap');
  expect((await settingsDownload(page)).layout.editable).toEqual(accepted.layout.editable);
  await page.locator('#layoutPitchX').fill('45');
  await page.locator('#layoutPitchY').fill('45');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await expect(page.locator('#pageSvgHost path')).toHaveCount(9);
  await page.locator('#layoutCount').fill('7');
  await expect(page.locator('#pageSvgHost path')).toHaveCount(7);
  await page.locator('#layoutColumns').fill('3');
  await expect(page.locator('#layoutPatternRows')).toHaveText('3');
  const edited = await settingsDownload(page);
  expect(edited.layout.editable.count).toBe(7);
  expect(edited.layout.editable.pitchX).toBe(45);
  const beforeWidth = parseFloat((await page.locator('#pageSvgHost svg').getAttribute('width'))!);
  const pending = page.waitForEvent('download');
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#layoutPitchX')!;
    input.value = '50';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('downloadPageSvg')!.click();
  });
  const exported = await readFile((await (await pending).path())!, 'utf8');
  expect(parseFloat(exported.match(/\bwidth="([^"]+)"/)![1])).toBeCloseTo(beforeWidth + 10, 8);
  await page.locator('#patternAdvanced').evaluate((details: HTMLDetailsElement) => {
    details.open = true;
  });
  await page.locator('#nestingRotation').selectOption('none');
  await page.locator('#layoutAngle').selectOption('90');
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  await page.locator('#nestingRotation').selectOption('quarter');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await setStock(page, '#nestingStockWidth', '0');
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  await setStock(page, '#nestingStockWidth', '500');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  await expect(page.locator('#pageSvgHost path')).toHaveCount(7);
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
  await expect(page.locator('#clearanceStatus')).toContainText('Overlaps or insufficient gap');
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
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  await expect(page.locator('#clearanceStatus')).toContainText('Clearance OK');
  const saved = await settingsDownload(page);
  expect(saved.layout.editable.gap).toBe(2);
  expect(saved.layout.editable.count).toBe(6);
});

test('nesting worker cancellation and setting edits cannot apply stale results', async ({
  page,
}) => {
  const before = await page.locator('#pageSvgHost svg').getAttribute('width');
  // The worker cannot deliver a result before this same browser task cancels it.
  await page.evaluate(() => {
    document.getElementById('optimizeLayout')!.click();
    document.getElementById('startNesting')!.click();
    document.getElementById('cancelNesting')!.click();
  });
  await expect(page.locator('#nestingStatus')).toContainText('cancelled');
  await expect(page.locator('#applyNesting')).toBeDisabled();
  await page.waitForTimeout(200);
  await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', before!);
  await page.evaluate(() => {
    document.getElementById('optimizeLayout')!.click();
    document.getElementById('startNesting')!.click();
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

test('malformed pattern imports are atomic and unsafe settings are retained with export blocked', async ({
  page,
}) => {
  await optimizeLayout(page);
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
        layout: { ...saved.layout, editable: { ...saved.layout.editable, gap: -1 } },
      }),
    ),
  });
  await (await dialog).dismiss();
  await expect(page.locator('#sideNumber')).toHaveValue('30');
  await expect(page.locator('#pageSvgHost svg')).toHaveAttribute('width', before!);
  saved.layout.editable.pitchX = 0;
  saved.layout.editable.pitchY = 0;
  await importSettings(page, saved, false);
  await expect(page.locator('#layoutMode')).toHaveValue('pattern');
  await expect(page.locator('#layoutMode')).toHaveValue('pattern');
  await expect(page.locator('#pageSvgHost')).toContainText('does not meet its cutting gap');
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  expect((await settingsDownload(page)).layout.editable).toEqual(saved.layout.editable);
});

test('nesting controls work at phone width and reset restores manual layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const help = page.getByRole('button', { name: 'About Optimize layout', exact: true });
  await help.click();
  await expect(page.locator('#optimizeLayoutHelp')).toBeVisible();
  await expect(page.locator('#optimizeLayoutHelp')).toContainText('Panel shapes stay unchanged');
  await help.press('Escape');
  await expect(page.locator('#optimizeLayoutHelp')).toBeHidden();
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  const applied = await settingsDownload(page);
  expect(applied.layout.editable.count).toBe(9);
  const patternBounds = await page.locator('#patternLayoutControls').boundingBox();
  expect(patternBounds!.x + patternBounds!.width).toBeLessThanOrEqual(390);
  await page.locator('#resetLayoutSettings').click();
  await expect(page.locator('#layoutMode')).toHaveValue('grid');
  expect((await settingsDownload(page)).layout.editable).toBeUndefined();
  const bounds = await page.locator('.layout-workflow').boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});

test('stock fitting accounts for export scale and blocks an outgrown arrangement until it fits again', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, { ...initial, shape: 4, curved: false, showHoles: false });
  await setGoal(page, 'fit');
  await page.locator('#nestingRotation').selectOption('none');
  await setStock(page, '#nestingStockWidth', '120');
  await setStock(page, '#nestingStockHeight', '120');
  await page.locator('#exportScale').fill('125');
  await optimizeLayout(page);
  await expect(page.locator('#nestingStatus')).toContainText('No arrangement found');
  await expect(page.locator('#applyNesting')).toBeDisabled();
  await setStock(page, '#nestingStockWidth', '150');
  await setStock(page, '#nestingStockHeight', '150');
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await expect(page.locator('#nestingStatus')).toContainText('at 125%');
  await page.locator('#applyNesting').click();
  const saved = await settingsDownload(page);
  expect(saved.layout.editable.stock).toEqual({ mode: 'fit', width: 150, height: 150 });
  expect(saved.layout.editable.angle).toBe(0);
  expect(saved.layout.editable.rotateAlternates).toBe(false);
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
  await expect(page.locator('#layoutMode')).toHaveValue('pattern');
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(0);
  await page.waitForTimeout(150);
  expect(unexpected).toBe(0);
  await page.locator('#exportScale').fill('125');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await expect(page.locator('#pageSvgHost path')).toHaveCount(9);
  expect((await settingsDownload(page)).layout.editable).toEqual(saved.layout.editable);
  await importSettings(page, { ...saved, export: { scalePercent: 200 } }, false);
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  await page.locator('#layoutMode').selectOption('grid');
  await expect(page.locator('#pageSvgHost path')).toHaveCount(9);
});

test('capacity uses actual panel count, round trips limits, and preserves the manual arrangement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const initial = await settingsDownload(page);
  await importSettings(page, { ...initial, shape: 4, curved: false, showHoles: false });
  const manual = await page.locator('#pageSvgHost svg').getAttribute('width');
  await setGoal(page, 'capacity');
  await page.locator('#nestingRotation').selectOption('none');
  await setStock(page, '#nestingStockWidth', '120');
  await setStock(page, '#nestingStockHeight', '85');
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await expect(page.locator('#nestingStatus')).toContainText('6 panels');
  await expect(page.locator('#nestingStatus')).toContainText('Best found, up to 144');
  await page.locator('#applyNesting').click();
  await expect(page.locator('#pageSvgHost path')).toHaveCount(6);
  await expect(page.locator('#layoutCount')).toHaveValue('6');
  await expect(page.locator('#layoutColumns')).toHaveValue('3');
  const saved = await settingsDownload(page);
  expect(saved.layout.editable.count).toBe(6);
  await expect(page.locator('#nestingStockWidth')).toHaveValue('120');
  await expect(page.locator('#nestingStockHeight')).toHaveValue('85');
  await page.locator('#layoutCount').fill('5');
  await expect(page.locator('#pageSvgHost path')).toHaveCount(5);
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await page.locator('#layoutCount').fill('6');
  const pending = page.waitForEvent('download');
  await page.locator('#downloadPageSvg').click();
  expect((await pending).suggestedFilename()).toBe('footbag-layout-6panels.svg');
  await setStock(page, '#nestingStockWidth', '10');
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  expect((await settingsDownload(page)).layout.editable.stock.width).toBe(10);
  await setStock(page, '#nestingStockWidth', '120');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await page.locator('#layoutMode').selectOption('grid');
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
  await setGoal(page, 'capacity');
  await setStock(page, '#nestingStockWidth', '49');
  await optimizeLayout(page);
  await expect(page.locator('#nestingStatus')).toContainText('Enter stock height');
  await expect(page.locator('#applyNesting')).toBeDisabled();
  await setGoal(page, 'fit');
  await page.locator('#nestingRotation').selectOption('none');
  await optimizeLayout(page);
  await expect(page.locator('#nestingStatus')).toContainText('No arrangement found');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await page.locator('#nestingRotation').selectOption('quarter');
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#exportScale').fill('125');
  await expect(page.locator('#applyNesting')).toBeDisabled();
  await page.locator('#exportScale').fill('100');
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  const saved = await settingsDownload(page);
  expect([90, 270]).toContain(saved.layout.editable.angle);
  delete saved.layout.nesting;
  delete saved.layout.editable;
  await importSettings(page, saved);
  await expect(page.locator('#nestingMode')).toHaveValue('free');
  await expect(page.locator('#nestingRotation')).toHaveValue('half');
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
    document.getElementById('startNesting')!.click();
  });
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  await expect(page.locator('#layoutMode')).toHaveValue('pattern');
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
  expect((await settingsDownload(page)).layout.editable).toEqual(before.layout.editable);
});

test('one shared constraint set drives the dialog and identifies missing material limits', async ({
  page,
}) => {
  await expect(
    page.locator(
      '#layoutGap, #layoutRotations, #layoutStockWidth, #layoutStockHeight, #manualLayout, #checkClearance',
    ),
  ).toHaveCount(0);
  await expect(page.locator('#nestingGap')).toHaveCount(1);
  await expect(page.locator('#nestingRotation')).toHaveCount(1);
  await expect(page.locator('#applyNesting')).toBeHidden();
  await expect(page.locator('#cancelNesting')).toBeHidden();
  await page.locator('#optimizeLayout').click();
  await expect(page.locator('#nestingDialog')).toBeVisible();
  await page.locator('#nestingMode').selectOption('capacity');
  await expect(page.locator('#nestingSearchSummary')).toContainText('Gap 1 mm');
  await page.locator('#nestingMode').press('Escape');
  await expect(page.locator('#nestingDialog')).toBeHidden();
  await expect(page.locator('#optimizeLayout')).toBeFocused();
  await optimizeLayout(page);
  await expect(page.locator('#nestingStockWidth')).toBeFocused();
  await expect(page.locator('#nestingStockControls')).toHaveAttribute('open');
  await expect(page.locator('#nestingStockWidthError')).toHaveText('Enter stock width.');
  await setStock(page, '#nestingStockWidth', '210.5');
  await optimizeLayout(page);
  await expect(page.locator('#nestingStockHeight')).toBeFocused();
  await setStock(page, '#nestingStockHeight', '297.25');
  const saved = await settingsDownload(page);
  await importSettings(page, saved);
  await expect(page.locator('#nestingStockWidth')).toHaveValue('210.5');
  await page.locator('#nestingGap').fill('21');
  await page.locator('#layoutMode').selectOption('pattern');
  await expect(page.locator('#layoutMode')).toHaveValue('grid');
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(1);
  await optimizeLayout(page);
  await expect(page.locator('#nestingGap')).toBeFocused();
  await expect(page.locator('#nestingGapError')).toContainText('from 0 to 20');
  await page.locator('#nestingGap').fill('0');
  await expect(page.locator('#nestingGapError')).toHaveCount(0);
  await expect(page.locator('#nestingGap')).toHaveAttribute('aria-describedby', 'nestingGapHelp');
  await page.locator('#resetLayoutSettings').click();
  await expect(page.locator('#nestingGap')).toHaveValue('1');
  await expect(page.locator('#nestingStockWidth')).toHaveValue('');
  await expect(page.locator('.field-error')).toHaveCount(0);
});

test('readable spacing preserves exact geometry through unrelated edits and imports', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  const saved = await settingsDownload(page);
  const model = saved.layout.editable;
  await expect(page.locator('#patternAdvanced')).not.toHaveAttribute('open');
  const summary = page.locator('#patternAdvanced > summary');
  await expect(summary).toHaveText('Advanced parameters');
  const patternBounds = await page.locator('#layoutPattern').boundingBox();
  const advancedBounds = await page.locator('#patternAdvanced').boundingBox();
  expect(advancedBounds!.y - (patternBounds!.y + patternBounds!.height)).toBeGreaterThanOrEqual(12);
  expect(advancedBounds!.x).toBeCloseTo(patternBounds!.x, 0);
  expect(advancedBounds!.width).toBeCloseTo(patternBounds!.width, 0);
  await summary.focus();
  await summary.press('Enter');
  await expect(page.locator('#layoutAngle')).toBeVisible();
  await summary.press('Space');
  await expect(page.locator('#layoutAngle')).toBeHidden();

  for (const [id, exact] of [
    ['layoutPitchX', model.pitchX],
    ['layoutPitchY', model.pitchY],
  ] as const)
    await expect(page.locator('#' + id)).toHaveValue(String(Number(exact.toFixed(3))));
  const originalSvg = await page.locator('#pageSvgHost svg').evaluate((svg) => svg.outerHTML);
  await page.locator('#layoutCount').fill(String(model.count));
  expect((await settingsDownload(page)).layout.editable).toEqual(model);
  expect(await page.locator('#pageSvgHost svg').evaluate((svg) => svg.outerHTML)).toBe(originalSvg);
  await page.locator('#layoutCount').fill('7');
  const changed = await settingsDownload(page);
  expect(changed.layout.editable.pitchX).toBe(model.pitchX);
  expect(changed.layout.editable.pitchY).toBe(model.pitchY);
  await importSettings(page, changed);
  expect((await settingsDownload(page)).layout.editable).toEqual(changed.layout.editable);
  const pitch = Number(model.pitchX.toFixed(3)) + 1;
  await page.locator('#layoutPitchX').fill(String(pitch));
  expect((await settingsDownload(page)).layout.editable.pitchX).toBe(pitch);
  const bounds = await page.locator('#patternLayoutControls').boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});

test('pattern feedback identifies numeric, rotation, clearance and stock constraints and clears on recovery', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, { ...initial, shape: 4, curved: false, showHoles: false });
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  const accepted = await settingsDownload(page);
  await page.locator('#layoutCount').fill('1.5');
  await expect(page.locator('#layoutCountError')).toContainText('whole number');
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  // Invalid drafts retain the last committed model, rather than silently clamping it.
  expect((await settingsDownload(page)).layout.editable).toEqual(accepted.layout.editable);
  await page.locator('#layoutCount').fill('');
  await expect(page.locator('#layoutCountError')).toHaveText('Enter panel count.');
  await page.locator('#layoutCount').fill('9');
  await expect(page.locator('#layoutCountError')).toHaveCount(0);
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await page.locator('#layoutPitchX').fill('0');
  await expect(page.locator('#layoutPitchXError')).toContainText('overlap or are too close');
  await page.locator('#patternAdvanced').evaluate((details: HTMLDetailsElement) => {
    details.open = true;
  });
  await page.locator('#layoutPitchX').fill('45');
  await page.locator('#layoutPitchY').fill('45');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await page.locator('#nestingRotation').selectOption('none');
  await page.locator('#layoutAngle').selectOption('90');
  await expect(page.locator('#layoutAngleError')).toContainText('allowed policy');
  await expect(page.locator('#pageSvgHost')).toContainText('rotations outside');
  await page.locator('#nestingRotation').selectOption('quarter');
  await expect(page.locator('#layoutAngleError')).toHaveCount(0);
  await setStock(page, '#nestingStockHeight', '500');
  await expect(page.locator('#nestingStockWidthError')).toContainText('Enter stock width');
  await setStock(page, '#nestingStockWidth', '50');
  await expect(page.locator('#nestingStockWidthError')).toContainText('needs');
  await expect(page.locator('#nestingStockHeightError')).toHaveCount(0);
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  await setStock(page, '#nestingStockWidth', '500');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await expect(page.locator('.field-error')).toHaveCount(0);
  await expect(page.locator('#nestingStockWidth')).not.toHaveAttribute('aria-invalid', 'true');
});

test('shared export scale sits beside both downloads, syncs immediately and survives imports', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  for (const viewport of [
    { width: 2533, height: 1222 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [scaleId, buttonId] of [
      ['exportScale', 'downloadSvg'],
      ['exportScaleNumber', 'downloadPageSvg'],
    ]) {
      expect(
        await page
          .locator('#' + scaleId)
          .evaluate(
            (input, button) =>
              input.closest('.export-actions')!.contains(document.getElementById(button)),
            buttonId,
          ),
      ).toBe(true);
      expect(await page.locator('#' + scaleId).evaluate((input) => !!input.closest('header'))).toBe(
        false,
      );
    }
  }
  const paths = await page
    .locator('#svgHost svg path')
    .evaluateAll((paths) => paths.map((p) => p.getAttribute('d')));
  for (const [scaleId, value] of [
    ['exportScaleNumber', '75.5'],
    ['exportScale', '125'],
  ]) {
    await page.locator('#' + scaleId).fill(value);
    await expect(page.locator('#exportScale')).toHaveValue(value);
    await expect(page.locator('#exportScaleNumber')).toHaveValue(value);
    expect((await settingsDownload(page)).export.scalePercent).toBe(Number(value));
    for (const [host, button] of [
      ['svgHost', 'downloadSvg'],
      ['pageSvgHost', 'downloadPageSvg'],
    ]) {
      const originalWidth = parseFloat(
        (await page.locator('#' + host + ' svg').getAttribute('width'))!,
      );
      const pending = page.waitForEvent('download');
      await page.locator('#' + button).click();
      const text = await readFile((await (await pending).path())!, 'utf8');
      expect(parseFloat(text.match(/\bwidth="([^"]+)"/)![1])).toBeCloseTo(
        (originalWidth * Number(value)) / 100,
        8,
      );
    }
  }
  expect(
    await page
      .locator('#svgHost svg path')
      .evaluateAll((paths) => paths.map((p) => p.getAttribute('d'))),
  ).toEqual(paths);
  const saved = await settingsDownload(page);
  await page.locator('#exportScaleNumber').fill('2000');
  await page.locator('#exportScaleNumber').blur();
  await expect(page.locator('#exportScale')).toHaveValue('1000');
  await expect(page.locator('#exportScaleNumber')).toHaveValue('1000');
  await importSettings(page, saved);
  await expect(page.locator('#exportScaleNumber')).toHaveValue('125');
  await page.locator('#resetPanelSettings').click();
  await page.locator('#resetLayoutSettings').click();
  await expect(page.locator('#exportScale')).toHaveValue('125');
  await expect(page.locator('#exportScaleNumber')).toHaveValue('125');
  delete initial.export;
  await importSettings(page, initial);
  await expect(page.locator('#exportScale')).toHaveValue('100');
  await expect(page.locator('#exportScaleNumber')).toHaveValue('100');
  // Editing scale beside the layout download must immediately recheck accepted stock limits.
  await importSettings(page, { ...initial, shape: 4, curved: false, showHoles: false });
  await setGoal(page, 'fit');
  await page.locator('#nestingRotation').selectOption('none');
  await setStock(page, '#nestingStockWidth', '150');
  await setStock(page, '#nestingStockHeight', '150');
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  await page.locator('#exportScaleNumber').fill('200');
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  await page.locator('#exportScaleNumber').fill('100');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
});

test('shared constraint edits preserve positions, guard immediate exports and round trip consistently', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, { ...initial, shape: 4, curved: false, showHoles: false });
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#applyNesting').click();
  const saved = await settingsDownload(page);
  const svg = await page.locator('#pageSvgHost svg').evaluate((node) => node.outerHTML);
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.evaluate(() => {
    const gap = document.querySelector<HTMLInputElement>('#nestingGap')!;
    gap.value = '20';
    gap.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('downloadPageSvg')!.click();
  });
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  await expect(page.locator('#nestingGapError')).toContainText('overlap or are too close');
  await page.waitForTimeout(250);
  expect(downloads).toBe(0);
  const changed = await settingsDownload(page);
  expect(changed.layout.editable).toEqual({ ...saved.layout.editable, gap: 20 });
  expect(changed.layout.nesting.gap).toBe(20);
  await importSettings(page, changed, false);
  await expect(page.locator('#nestingGap')).toHaveValue('20');
  await page.locator('#nestingGap').fill('1');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  expect(await page.locator('#pageSvgHost svg').evaluate((node) => node.outerHTML)).toBe(svg);
  const conflict = {
    ...saved,
    layout: { ...saved.layout, nesting: { mode: 'free', gap: 7, rotations: 'none', width: 25 } },
  };
  await importSettings(page, conflict);
  await expect(page.locator('#layoutImportNotice')).toContainText('older search settings differed');
  await expect(page.locator('#nestingGap')).toHaveValue(String(saved.layout.editable.gap));
  await expect(page.locator('#nestingRotation')).toHaveValue(saved.layout.editable.rotations);
  await expect(page.locator('#nestingStockWidth')).toHaveValue('');
  const migrated = await settingsDownload(page);
  expect(migrated.layout.editable).toEqual(saved.layout.editable);
  expect(migrated.layout.nesting.gap).toBe(saved.layout.editable.gap);
  expect(migrated.layout.nesting.rotations).toBe(saved.layout.editable.rotations);
});

test('automatic clearance cancels stale checks and remains advisory for manual grids', async ({
  page,
}) => {
  const original = await page.locator('#pageSvgHost svg').evaluate((node) => node.outerHTML);
  await page.route('**/nesting-worker-*.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'self.onmessage = e => setTimeout(() => self.postMessage({safe: e.data.gap === 0}), e.data.gap === 0 ? 10 : 500);',
    }),
  );
  await page.locator('#nestingGap').fill('2');
  await expect(page.locator('#clearanceStatus')).toContainText('Checking');
  await page.waitForTimeout(250);
  await page.locator('#nestingGap').fill('0');
  await expect(page.locator('#clearanceStatus')).toHaveText('Clearance OK');
  await page.waitForTimeout(600);
  await expect(page.locator('#clearanceStatus')).toHaveText('Clearance OK');
  await page.locator('#nestingGap').fill('3');
  await expect(page.locator('#clearanceStatus')).toContainText('Overlaps or insufficient gap');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  expect(await page.locator('#pageSvgHost svg').evaluate((node) => node.outerHTML)).toBe(original);
});

test('optimization dialog and candidate actions follow a single keyboard-accessible workflow on phones', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#optimizeLayout').click();
  const dialog = page.locator('#nestingDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#nestingMode')).toBeFocused();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.locator('#editNestingSettings').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#nestingGap')).toBeFocused();
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeVisible();
  await expect(page.locator('#cancelNesting')).toHaveText('Discard');
  await expect(page.locator('#optimizeLayout')).toBeHidden();
  await expect(page.locator('img[data-nesting-preview]')).toHaveCount(1);
  await page.locator('#cancelNesting').click();
  await expect(page.locator('#optimizeLayout')).toBeFocused();
  await expect(page.locator('#applyNesting')).toBeHidden();
  await expect(page.locator('img[data-nesting-preview]')).toHaveCount(0);
});

test('padding resizes candidate and accepted borders without searching again, including stock limits', async ({
  page,
}) => {
  const initial = await settingsDownload(page);
  await importSettings(page, { ...initial, shape: 4, curved: false });
  const requests = await trackNestingRequests(page);
  await setGoal(page, 'fit');
  await setStock(page, '#nestingStockWidth', '150');
  await setStock(page, '#nestingStockHeight', '150');
  await page.evaluate(() => {
    document.getElementById('optimizeLayout')!.click();
    document.getElementById('startNesting')!.click();
    const padding = document.querySelector<HTMLInputElement>('#pagePaddingNumber')!;
    padding.value = '5';
    padding.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#applyNesting')).toBeEnabled();
  const overlay = page.locator('img[data-nesting-preview]');
  const candidateTransforms = () =>
    overlay.evaluate((image: HTMLImageElement) => {
      const svg = new DOMParser().parseFromString(
        decodeURIComponent(image.src.split(',').slice(1).join(',')),
        'image/svg+xml',
      );
      return [...svg.querySelectorAll('g[transform]')].map((group) =>
        group.getAttribute('transform'),
      );
    });
  const positions = await candidateTransforms();
  await page.locator('#pagePaddingNumber').fill('40');
  await expect(overlay).toHaveCount(1);
  await expect(page.locator('#applyNesting')).toBeDisabled();
  await expect(page.locator('#nestingStatus')).toContainText('Exceeds material limits');
  expect(await candidateTransforms()).toEqual(positions);
  await page.locator('#pagePaddingNumber').fill('5');
  await expect(page.locator('#applyNesting')).toBeEnabled();
  expect(await candidateTransforms()).toEqual(positions);
  expect((await requests()).search).toBe(1);
  await page.locator('#applyNesting').click();
  const accepted = await settingsDownload(page);
  const width = parseFloat((await page.locator('#pageSvgHost svg').getAttribute('width'))!);
  await page.locator('#pagePaddingNumber').fill('40');
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  expect((await settingsDownload(page)).layout.editable).toEqual(accepted.layout.editable);
  await page.locator('#pagePaddingNumber').fill('10');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await expect
    .poll(async () => parseFloat((await page.locator('#pageSvgHost svg').getAttribute('width'))!))
    .toBeCloseTo(width + 10, 8);
  expect((await requests()).search).toBe(1);
});

test('stitch-only edits reuse clearance results and keep the candidate while actual cut changes recheck', async ({
  page,
}) => {
  const requests = await trackNestingRequests(page);
  const outline = await page.locator('#svgHost path').getAttribute('d');
  await page.locator('#stitchesNumber').fill('10');
  await page.locator('#seamNumber').fill('3');
  await expect(page.locator('#svgHost circle')).toHaveCount(50);
  await page.waitForTimeout(450);
  expect((await requests()).clearance).toBe(0);
  await expect(page.locator('#svgHost path')).toHaveAttribute('d', outline!);
  await optimizeLayout(page);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  await page.locator('#stitchesNumber').fill('9');
  await expect(page.locator('#svgHost circle')).toHaveCount(45);
  await page.waitForTimeout(450);
  await expect(page.locator('img[data-nesting-preview]')).toHaveCount(1);
  await expect(page.locator('#applyNesting')).toBeEnabled();
  expect(await requests()).toEqual({ search: 1, clearance: 0 });
  // Apply in the same task as a stitch edit must refresh marks and keep the proposal.
  await page.evaluate(() => {
    const stitches = document.querySelector<HTMLInputElement>('#stitchesNumber')!;
    stitches.value = '8';
    stitches.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('applyNesting')!.click();
  });
  await expect(page.locator('#layoutMode')).toHaveValue('pattern');
  await expect(page.locator('#pageSvgHost circle')).toHaveCount(360);
  await expect(page.locator('#clearanceStatus')).toHaveText('Clearance OK');
  const count = (await requests()).clearance;
  await page.locator('#stitchesNumber').fill('11');
  await expect(page.locator('#pageSvgHost circle')).toHaveCount(495);
  await page.waitForTimeout(450);
  expect((await requests()).clearance).toBe(count);
  await page.locator('#nestingGap').fill('2');
  await expect.poll(async () => (await requests()).clearance).toBeGreaterThan(count);
  const afterGap = (await requests()).clearance;
  await page.locator('#sideNumber').fill('31');
  await expect.poll(async () => (await requests()).clearance).toBeGreaterThan(afterGap);
});

test('legacy accepted placements survive padding and stitch changes', async ({ page }) => {
  const saved = JSON.parse(
    await readFile(new URL('../fixtures/legacy-nested.json', import.meta.url), 'utf8'),
  );
  await importSettings(page, saved);
  const width = parseFloat((await page.locator('#pageSvgHost svg').getAttribute('width'))!);
  await page.locator('#pagePaddingNumber').fill('30');
  await expect
    .poll(async () => parseFloat((await page.locator('#pageSvgHost svg').getAttribute('width'))!))
    .toBeCloseTo(width + 40, 8);
  expect((await settingsDownload(page)).layout.optimized).toEqual(saved.layout.optimized);
  await page.locator('#stitchesNumber').fill('10');
  await expect(page.locator('#pageSvgHost circle')).toHaveCount(450);
  const changed = await settingsDownload(page);
  expect(changed.layout.optimized.placements).toEqual(saved.layout.optimized.placements);
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await importSettings(page, changed);
  expect((await settingsDownload(page)).layout.optimized).toEqual(changed.layout.optimized);
});

test('placement pattern help illustrates shifts and optional rotations without changing settings', async ({
  page,
}) => {
  await page.locator('#layoutMode').selectOption('pattern');
  const saved = await settingsDownload(page);
  const icon = page.getByRole('button', { name: 'About placement patterns', exact: true });
  const help = page.locator('#placementPatternHelp');
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await icon.scrollIntoViewIfNeeded();
    await icon.focus();
    await icon.press('Enter');
    await expect(help).toBeVisible();
    await expect(help.locator('svg')).toHaveCount(5);
    await expect(help.locator('strong')).toHaveText([
      'Aligned',
      'Alternating rows',
      'Staggered rows',
      'Alternating columns',
      'Staggered columns',
    ]);
    await expect(help).toContainText('half the horizontal center spacing');
    await expect(help).toContainText('half the vertical center spacing');
    await expect(help).toContainText('Turn it off to keep every panel at the base rotation');
    const transforms = await help
      .locator('svg')
      .evaluateAll((diagrams) =>
        diagrams.map((svg) =>
          Array.from(svg.querySelectorAll('path'), (path) => path.getAttribute('transform')),
        ),
      );
    expect(transforms[0][3]).toBe('translate(12 34) rotate(0)');
    expect(transforms[1][3]).toBe('translate(12 34) rotate(180)');
    expect(transforms[2][3]).toBe('translate(26 34) rotate(180)');
    expect(transforms[3][1]).toBe('translate(40 10) rotate(180)');
    expect(transforms[4][1]).toBe('translate(40 22) rotate(180)');
    const bounds = await help.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(8);
    expect(bounds!.y).toBeGreaterThanOrEqual(8);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 7);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 7);
    await icon.press('Escape');
    await expect(help).toBeHidden();
    await icon.click();
    await expect(help).toBeVisible();
    await page.locator('h1').click();
    await expect(help).toBeHidden();
  }
  expect(await settingsDownload(page)).toEqual(saved);
});

test('fabric rectangle follows actual dimensions, output scale and preview zoom without entering exports', async ({
  page,
}) => {
  const svg = page.locator('#pageSvgHost svg');
  const original = await svg.evaluate((el) => el.outerHTML);
  await setStock(page, '#nestingStockWidth', '300');
  await setStock(page, '#nestingStockHeight', '200');
  const fabric = page.locator('#pageSvgHost [data-fabric-preview]');
  await expect(fabric).toBeVisible();
  await expect(fabric).toHaveAttribute('aria-label', 'Fabric 300 × 200 mm');
  const size = await fabric.boundingBox(),
    sheet = await svg.boundingBox();
  expect(size!.x).toBeCloseTo(sheet!.x, 1);
  expect(size!.y).toBeCloseTo(sheet!.y, 1);
  expect(size!.width).toBeCloseTo((300 * 96) / 25.4, 1);
  expect(size!.height).toBeCloseTo((200 * 96) / 25.4, 1);
  expect(await svg.evaluate((el) => el.outerHTML)).toBe(original);
  const pending = page.waitForEvent('download');
  await page.locator('#downloadPageSvg').click();
  const exported = await readFile((await (await pending).path())!, 'utf8');
  expect(exported).not.toContain('fabric');
  expect(exported).not.toContain('Fabric');
  await page.locator('#exportScaleNumber').fill('125');
  await expect
    .poll(async () => (await fabric.boundingBox())!.width)
    .toBeCloseTo(size!.width / 1.25, 1);
  await page.locator('#pageZoom').fill('150');
  await expect
    .poll(async () => (await fabric.boundingBox())!.width)
    .toBeCloseTo((size!.width / 1.25) * 1.5, 1);
  await expect(fabric).toHaveAttribute('aria-label', 'Fabric 300 × 200 mm');
  const saved = await settingsDownload(page);
  await page.reload();
  await importSettings(page, saved);
  await expect(fabric).toHaveAttribute('aria-label', 'Fabric 300 × 200 mm');
  await setStock(page, '#nestingStockHeight', '');
  await expect(fabric).toHaveCount(0);
  await setStock(page, '#nestingStockHeight', '-1');
  await expect(fabric).toHaveCount(0);
});

test('fabric rectangle remains visible for an outgrown arrangement and recovers with its layout', async ({
  page,
}) => {
  await setStock(page, '#nestingStockWidth', '500');
  await setStock(page, '#nestingStockHeight', '400');
  await page.locator('#layoutMode').selectOption('pattern');
  await page.locator('#layoutPitchX').fill('80');
  await page.locator('#layoutPitchY').fill('80');
  const fabric = page.locator('#pageSvgHost [data-fabric-preview]');
  await expect(fabric).toBeVisible();
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(1);
  await setStock(page, '#nestingStockHeight', '20');
  await expect(page.locator('#downloadPageSvg')).toBeDisabled();
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(0);
  await expect(fabric).toHaveAttribute('aria-label', 'Fabric 500 × 20 mm');
  await setStock(page, '#nestingStockHeight', '400');
  await expect(page.locator('#downloadPageSvg')).toBeEnabled();
  await expect(fabric).toHaveAttribute('aria-label', 'Fabric 500 × 400 mm');
  await expect(page.locator('#pageSvgHost svg')).toHaveCount(1);
});
