import { readFileSync, writeFileSync } from 'node:fs';

const definitions = JSON.parse(
  readFileSync(new URL('../schema/controls.json', import.meta.url), 'utf8'),
);
const schemaUrl = new URL('../schema/settings.schema.json', import.meta.url);
const htmlUrl = new URL('../index.html', import.meta.url);
const schema = JSON.parse(readFileSync(schemaUrl, 'utf8'));
let html = readFileSync(htmlUrl, 'utf8');
for (const [id, definition] of Object.entries(definitions)) {
  for (const inputId of [id, `${id}Number`]) {
    const pattern = new RegExp(`<input\\b[^>]*id="${inputId}"[^>]*>`, 'g');
    html = html.replace(pattern, (tag) => {
      for (const [name, value] of Object.entries({
        min: definition.min,
        max: definition.max,
        step: definition.step,
        value: definition.default,
      })) {
        tag = tag.replace(new RegExp(`${name}="[^"]*"`), `${name}="${value}"`);
      }
      return tag;
    });
  }
  let properties = schema.properties;
  const path = definition.path.split('.');
  for (const part of path.slice(0, -1)) properties = properties[part].properties;
  const property = properties[path.at(-1)];
  property.minimum = definition.legacySchemaBounds?.[0] ?? definition.min;
  if (!definition.dynamic) property.maximum = definition.legacySchemaBounds?.[1] ?? definition.max;
}
const outputs = [
  [htmlUrl, html],
  [schemaUrl, `${JSON.stringify(schema, null, 2)}\n`],
];
for (const [url, content] of outputs) {
  if (process.argv.includes('--check')) {
    if (readFileSync(url, 'utf8').replaceAll('\r\n', '\n') !== content.replaceAll('\r\n', '\n')) {
      console.error(`${url.pathname} is out of sync; run npm run settings:sync`);
      process.exitCode = 1;
    }
  } else writeFileSync(url, content);
}
