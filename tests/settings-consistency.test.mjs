import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import Ajv2020 from 'ajv/dist/2020.js';
import { normalizeSetting, SETTINGS } from '../src/lib/settings.ts';
import { state } from '../src/lib/state.ts';
import { createMainElements, getLayoutElements, createPageElements } from '../src/lib/dom.ts';
import { panelControlPairs } from '../src/lib/controls.ts';

const schema = JSON.parse(
  readFileSync(new URL('../schema/settings.schema.json', import.meta.url), 'utf8'),
);
const validate = new Ajv2020().compile(schema);
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('declared control bounds/defaults match HTML and schema, including legacy stitch bounds', () => {
  const { document } = new JSDOM(html).window;
  for (const [id, definition] of Object.entries(SETTINGS)) {
    for (const inputId of [id, `${id}Number`]) {
      const input = document.getElementById(inputId);
      if (!input && inputId.endsWith('Number')) continue;
      assert.equal(Number(input.min), definition.min, `${inputId} min`);
      assert.equal(Number(input.max), definition.max, `${inputId} max`);
      assert.equal(Number(input.defaultValue), definition.default, `${inputId} default`);
    }
    const property = definition.path
      .split('.')
      .reduce((node, part) => node.properties[part], schema);
    assert.equal(property.minimum, definition.legacySchemaBounds?.[0] ?? definition.min, id);
    if (!definition.dynamic)
      assert.equal(property.maximum, definition.legacySchemaBounds?.[1] ?? definition.max, id);
    assert.equal(normalizeSetting(id, undefined), definition.default, id);
    assert.equal(normalizeSetting(id, NaN), definition.default, id);
    assert.equal(normalizeSetting(id, Infinity), definition.default, id);
    assert.equal(normalizeSetting(id, -1e6), definition.min, id);
    assert.equal(normalizeSetting(id, 1e6), definition.max, id);
  }
  assert.deepEqual(
    [...document.querySelector('#shape').options].map((option) => Number(option.value)),
    schema.properties.shape.enum,
  );
});

test('all panel numeric controls participate in binding/import/reset registry', () => {
  globalThis.window = new JSDOM(html).window;
  globalThis.document = window.document;
  const pairs = panelControlPairs(createMainElements());
  assert.deepEqual(
    pairs.map(([range]) => range.id).sort(),
    [...document.querySelectorAll('[aria-label="Panel Settings"] input[type="range"]')]
      .map((input) => input.id)
      .sort(),
  );
});

test('vertical spacing extrema survive export/import and validate against schema', () => {
  globalThis.window = new JSDOM(html).window;
  globalThis.document = window.document;
  const el = createMainElements();
  const layout = { ...getLayoutElements(), pageEl: createPageElements() };
  for (const vSpace of [-20, -0.5, 0, 50, 60]) {
    layout.pageVSpace.value = String(vSpace);
    const saved = JSON.parse(JSON.stringify(state.collect(el, layout)));
    assert.equal(validate(saved), true, JSON.stringify(validate.errors));
    layout.pageVSpace.value = '1';
    state.apply(el, saved, layout);
    assert.equal(layout.pageVSpace.value, String(vSpace));
    assert.equal(layout.pageVSpaceNumber.value, String(vSpace));
  }
});
