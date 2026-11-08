import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from '@playwright/test';
const arg = (name) =>
  process.argv
    .find((a) => a.startsWith('--' + name + '='))
    ?.split('=')
    .slice(1)
    .join('=');
const browserName = arg('browser') ?? 'chromium';
const runs = Number(arg('runs') ?? 5);
if (!Number.isInteger(runs) || runs < 3 || runs > 30)
  throw new Error('Use --runs=3 through --runs=30');
if (!['chromium', 'firefox', 'webkit'].includes(browserName)) throw new Error('Unknown browser');
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4322',
    '--strictPort',
  ],
  { stdio: 'pipe', windowsHide: true },
);
let serverError = '';
server.stderr.on('data', (data) => (serverError += String(data)));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(serverError || 'Preview server exited');
    try {
      const response = await fetch('http://127.0.0.1:4322/');
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Preview server did not start');
  browser = await { chromium, firefox, webkit }[browserName].launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const workloads = [];
  for (const large of [false, true]) {
    await page.goto('http://127.0.0.1:4322/');
    if (large) {
      await page.locator('#importFile').setInputFiles({
        name: 'benchmark.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            version: 1,
            shape: 10,
            side: 30,
            curved: false,
            showHoles: true,
            stitches: 20,
            layout: {
              rows: 12,
              cols: 12,
              padding: 10,
              hSpace: 0,
              vSpace: 1,
              invert: false,
              nestingOffset: 0,
              showGrid: true,
            },
          }),
        ),
      });
    }
    const expected = large ? 28800 : 360;
    await page.waitForFunction(
      (n) => document.querySelectorAll('#pageSvgHost svg circle').length === n,
      expected,
    );
    const operations = [];
    for (const operation of ['spacing', 'padding', 'sheetGrid', 'panelGrid', 'burst']) {
      const samples = [];
      for (let trial = -1; trial < runs; trial++) {
        const sample = await page.evaluate(
          async ({ operation, trial }) => {
            const host = document.getElementById('pageSvgHost');
            const circle = host.querySelector('circle'),
              svg = host.querySelector('svg');
            let replacements = 0;
            const observer = new MutationObserver((records) => {
              for (const record of records)
                for (const node of record.addedNodes)
                  if (node.nodeType === 1 && node.classList.contains('svg-wrap')) replacements++;
            });
            observer.observe(host, { childList: true });
            const set = (id, value) => {
              const input = document.getElementById(id);
              input.value = String(value);
              input.dispatchEvent(new Event('input', { bubbles: true }));
            };
            const toggle = (id) => {
              const input = document.getElementById(id);
              input.checked = !input.checked;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            };
            const start = performance.now();
            if (operation === 'spacing') set('pageHSpaceNumber', 1 + ((trial + 1) % 5));
            if (operation === 'padding') set('pagePaddingNumber', 10 + ((trial + 1) % 3));
            if (operation === 'sheetGrid') toggle('pageShowGrid');
            if (operation === 'panelGrid') toggle('showGrid');
            if (operation === 'burst')
              for (let i = 0; i < 24; i++) set('pageHSpaceNumber', 1 + ((trial + i + 2) % 5));
            const handlerMs = performance.now() - start;
            await new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
            // Existing panel edits may be debounced; grid/layout operations should
            // settle by this point. Record the actual scheduled preview work.
            const settleMs = performance.now() - start;
            await new Promise((resolve) => setTimeout(resolve, 0));
            observer.disconnect();
            return {
              handlerMs,
              settleMs,
              sheetReplacements: replacements,
              retainedFirstCircle: host.querySelector('circle') === circle,
              retainedSheet: host.querySelector('svg') === svg,
            };
          },
          { operation, trial },
        );
        if (trial >= 0) samples.push(sample);
      }
      const median = (key) =>
        samples.map((s) => s[key]).sort((a, b) => a - b)[Math.floor(samples.length / 2)];
      operations.push({
        operation,
        handlerMs: Number(median('handlerMs').toFixed(2)),
        settleMs: Number(median('settleMs').toFixed(2)),
        sheetReplacements: median('sheetReplacements'),
        retainedFirstCircle: samples.every((s) => s.retainedFirstCircle),
        retainedSheet: samples.every((s) => s.retainedSheet),
      });
    }
    workloads.push({
      layout: large ? '12x12 star / 28,800 holes' : '3x3 pentagon / 360 holes',
      operations,
    });
  }
  const result = JSON.stringify(
    {
      browser: browserName,
      version: browser.version(),
      viewport: '1280x900',
      runs,
      note: 'Advisory medians; settleMs spans two animation frames; it includes scheduling/rendering opportunities, not a direct paint timestamp. No timing pass/fail thresholds.',
      workloads,
    },
    null,
    2,
  );
  console.log(result);
  if (arg('out')) await writeFile(arg('out'), result + '\n');
} finally {
  await browser?.close();
  server.kill();
}
