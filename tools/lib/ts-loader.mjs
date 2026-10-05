// Node module hooks that let tools import the game's engine-free TypeScript (scripts/core, data)
// directly: extensionless relative imports from .ts files resolve to .ts, and .ts files are
// transpiled with the project's TypeScript (types are only stripped, nothing is checked).
//
// Usage: register('./lib/ts-loader.mjs', import.meta.url) before importing a .ts module.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export async function resolve(specifier, context, next) {
  const relative = specifier.startsWith('./') || specifier.startsWith('../');
  if (relative && context.parentURL?.endsWith('.ts') && !/\.[cm]?[jt]s$/.test(specifier)) {
    const url = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (!url.endsWith('.ts')) return next(url, context);
  const file = fileURLToPath(url);
  const source = await readFile(file, 'utf8');
  const out = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return { format: 'module', source: out.outputText, shortCircuit: true };
}
