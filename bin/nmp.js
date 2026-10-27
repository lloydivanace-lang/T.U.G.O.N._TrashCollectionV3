#!/usr/bin/env node
import { spawn } from 'node:child_process';

// Forward all arguments to npm
const child = spawn('npm', process.argv.slice(2), {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
