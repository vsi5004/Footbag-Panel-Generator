import ts from 'typescript';
import { readFile } from 'node:fs/promises';

export async function resolve(specifier, context, nextResolve) {
  if (
    specifier.startsWith('.') &&
    context.parentURL?.endsWith('.ts') &&
    !/\.[a-z]+$/.test(specifier)
  ) {
    specifier += '.ts';
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${await readFile(new URL(url), 'utf8')}`,
    };
  }
  if (!url.endsWith('.ts')) return nextLoad(url, context);
  const source = await readFile(new URL(url), 'utf8');
  return {
    format: 'module',
    shortCircuit: true,
    source: ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    }).outputText,
  };
}
