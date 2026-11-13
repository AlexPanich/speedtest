#!/usr/bin/env node
// Cross-platform syntax check of all sources (shell globs don't expand on Windows).
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const files = ['bin', 'src', 'scripts', 'test'].flatMap((dir) =>
  readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => join(dir, f)),
);
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log(`lint: ${files.length} files OK`);
