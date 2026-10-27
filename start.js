import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';

const root = process.cwd();

// 1. Ensure folder structure if cloned from a flattened repository
try {
  await import('./ensure-structure.js');
} catch (e) {
  console.warn('[T.U.G.O.N.] Structure check note:', e);
}

// 2. Ensure dependencies (including tsx) are installed even when NODE_ENV=production
const tsxBin = path.join(root, 'node_modules', '.bin', 'tsx');
if (!fs.existsSync(tsxBin)) {
  console.log('[T.U.G.O.N.] Installing dependencies (including tsx runtime)...');
  execSync('npm install --include=dev --legacy-peer-deps', { stdio: 'inherit' });
}

// 3. Ensure frontend dist exists (auto-build if needed)
const distIndex = path.join(root, 'dist', 'index.html');
if (!fs.existsSync(distIndex)) {
  console.log('[T.U.G.O.N.] Building frontend assets...');
  execSync('npm run build', { stdio: 'inherit' });
}

// 4. If running directly on a physical Raspberry Pi (or START_LOCAL_PI_STORAGE=true),
//    auto-start the companion Python storage daemon on port 8000 if not already running!
const isPhysicalRaspberryPi = fs.existsSync('/proc/device-tree/model');
const pyServerScript = path.join(root, 'raspberry-pi-server', 'server.py');
if ((isPhysicalRaspberryPi || process.env.START_LOCAL_PI_STORAGE === 'true') && fs.existsSync(pyServerScript)) {
  try {
    console.log('[T.U.G.O.N.] Raspberry Pi hardware detected — launching local storage daemon (server.py) on port 8000...');
    const pyChild = spawn('python3', [pyServerScript, '8000'], {
      stdio: 'inherit',
      env: process.env,
    });
    pyChild.on('error', () => {});
    if (!process.env.PI_SERVER_URL) {
      process.env.PI_SERVER_URL = 'http://127.0.0.1:8000';
    }
  } catch {}
}

// 5. Start the Express server via tsx
console.log('[T.U.G.O.N.] Launching server.ts...');
const child = spawn(tsxBin, ['server.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
