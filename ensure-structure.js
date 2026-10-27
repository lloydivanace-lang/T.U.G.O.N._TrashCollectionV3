import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// Map of root file names to their canonical subfolder locations
const fileMap = {
  // src/components
  'BarangayMap.tsx': 'src/components/BarangayMap.tsx',
  'Header.tsx': 'src/components/Header.tsx',
  'HouseholdView.tsx': 'src/components/HouseholdView.tsx',
  'KagawadDashboard.tsx': 'src/components/KagawadDashboard.tsx',
  'RaspberryPiCenter.tsx': 'src/components/RaspberryPiCenter.tsx',
  'ResolutionLogs.tsx': 'src/components/ResolutionLogs.tsx',
  'SourceCodeCenter.tsx': 'src/components/SourceCodeCenter.tsx',
  'TelegramCenter.tsx': 'src/components/TelegramCenter.tsx',
  'LiveCameraModal.tsx': 'src/components/LiveCameraModal.tsx',
  'CalibrationModal.tsx': 'src/components/CalibrationModal.tsx',
  'StreetView360.tsx': 'src/components/StreetView360.tsx',
  'ThreeDIcons.tsx': 'src/components/ThreeDIcons.tsx',

  // src/context
  'LanguageContext.tsx': 'src/context/LanguageContext.tsx',
  'LocationContext.tsx': 'src/context/LocationContext.tsx',

  // src/utils
  'audioAlarm.ts': 'src/utils/audioAlarm.ts',
  'translations.ts': 'src/utils/translations.ts',
  'imageCompressor.ts': 'src/utils/imageCompressor.ts',
  'jurisdiction.ts': 'src/utils/jurisdiction.ts',
  'piBridge.ts': 'src/utils/piBridge.ts',
  'residentStorage.ts': 'src/utils/residentStorage.ts',

  // src
  'App.tsx': 'src/App.tsx',
  'main.tsx': 'src/main.tsx',
  'index.css': 'src/index.css',
  'types.ts': 'src/types.ts',

  // public
  'icon.svg': 'public/icon.svg',
  'manifest.json': 'public/manifest.json',
  'sw.js': 'public/sw.js',
  'pi-config.json': 'public/pi-config.json',
  '_routes.json': 'public/_routes.json',

  // bin
  'nmp': 'bin/nmp',
  'nmp.js': 'bin/nmp.js',

  // data
  'pulse_reports.json': 'data/pulse_reports.json',

  // raspberry-pi-server
  'server.py': 'raspberry-pi-server/server.py',
  'setup_autostart.sh': 'raspberry-pi-server/setup_autostart.sh',

  // dotfiles without dots
  'env.example': '.env.example',
  'npmrc': '.npmrc',
};

// Check if any destination is missing but exists in root (e.g. flattened repo clone)
for (const [srcName, destRel] of Object.entries(fileMap)) {
  const destPath = path.join(root, destRel);
  const srcPath = path.join(root, srcName);

  if (!fs.existsSync(destPath) && fs.existsSync(srcPath)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    try {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[T.U.G.O.N. Structure] Restored ${srcName} -> ${destRel}`);
    } catch (e) {
      console.warn(`[T.U.G.O.N. Structure] Could not copy ${srcName}:`, e);
    }
  }
}

// Ensure bin/nmp exists and node_modules/.bin/nmp is executable
try {
  const binDir = path.join(root, 'node_modules', '.bin');
  fs.mkdirSync(binDir, { recursive: true });
  const nmpCandidates = [
    path.join(root, 'bin', 'nmp'),
    path.join(root, 'nmp'),
  ];
  for (const nmpSrc of nmpCandidates) {
    if (fs.existsSync(nmpSrc)) {
      const dest = path.join(binDir, 'nmp');
      fs.copyFileSync(nmpSrc, dest);
      try {
        fs.chmodSync(dest, 0o755);
      } catch {}
      break;
    }
  }
} catch {
  // non-fatal
}

/**
 * Automatic Cloudflare Workers vs Cloudflare Pages Build Configuration:
 * - On Cloudflare Pages (CF_PAGES=1): Uses /functions/api/[[path]].ts + /public/_routes.json
 *   (removes any Workers-only "main" field that Pages rejects).
 * - On Cloudflare Workers (WORKERS_CI=1 or existing wrangler config): Generates/patches
 *   wrangler.jsonc with WRANGLER_CI_OVERRIDE_NAME (exact dashboard Worker name),
 *   "main": "./cloudflare-worker.ts", and "run_worker_first": ["/api/*"] so /api/* runs server-side!
 */
try {
  const wranglerJsoncPath = path.join(root, 'wrangler.jsonc');
  const wranglerJsonPath = path.join(root, 'wrangler.json');
  const wranglerTomlPath = path.join(root, 'wrangler.toml');

  const stripJsonComments = (str) =>
    str
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/,\s*([}\]])/g, '$1');

  if (process.env.CF_PAGES === '1') {
    for (const candidate of [wranglerJsoncPath, wranglerJsonPath]) {
      if (fs.existsSync(candidate)) {
        try {
          const parsed = JSON.parse(stripJsonComments(fs.readFileSync(candidate, 'utf8')));
          if (parsed && parsed.main) {
            fs.unlinkSync(candidate);
            console.log(`[T.U.G.O.N. Cloudflare Pages] Removed Workers config ${path.basename(candidate)} so Pages Functions handle /api/*.`);
          }
        } catch {}
      }
    }
  } else {
    const hasJsonc = fs.existsSync(wranglerJsoncPath);
    const hasJson = fs.existsSync(wranglerJsonPath);
    const hasToml = fs.existsSync(wranglerTomlPath);
    const isWorkersCi = process.env.WORKERS_CI === '1' || Boolean(process.env.WRANGLER_CI_OVERRIDE_NAME);

    if (isWorkersCi || hasJsonc || hasJson || hasToml) {
      let existingObj = {};
      if (hasJsonc || hasJson) {
        const targetRead = hasJsonc ? wranglerJsoncPath : wranglerJsonPath;
        try {
          existingObj = JSON.parse(stripJsonComments(fs.readFileSync(targetRead, 'utf8'))) || {};
        } catch {
          existingObj = {};
        }
      } else if (hasToml) {
        try {
          const rawToml = fs.readFileSync(wranglerTomlPath, 'utf8');
          const nameMatch = rawToml.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
          const dateMatch = rawToml.match(/^\s*compatibility_date\s*=\s*["']([^"']+)["']/m);
          if (nameMatch) existingObj.name = nameMatch[1];
          if (dateMatch) existingObj.compatibility_date = dateMatch[1];
          fs.unlinkSync(wranglerTomlPath);
        } catch {}
      }

      const fallbackDirName = path
        .basename(root)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/^-+|-+$/g, '') || 'tugon-portal';

      const workerName =
        process.env.WRANGLER_CI_OVERRIDE_NAME ||
        process.env.CLOUDFLARE_WORKER_NAME ||
        existingObj.name ||
        fallbackDirName;

      const updatedConfig = {
        ...existingObj,
        name: workerName,
        main: './cloudflare-worker.ts',
        compatibility_date: existingObj.compatibility_date || '2025-04-01',
        assets: {
          ...(existingObj.assets || {}),
          directory: './dist',
          binding: 'ASSETS',
          not_found_handling: 'single-page-application',
          run_worker_first: ['/api/*'],
        },
      };

      const targetWrite = hasJson && !hasJsonc ? wranglerJsonPath : wranglerJsoncPath;
      fs.writeFileSync(targetWrite, JSON.stringify(updatedConfig, null, 2) + '\n', 'utf8');
      console.log(`[T.U.G.O.N. Cloudflare Workers] Configured ${path.basename(targetWrite)} for "${workerName}" with /api/* Edge Bridge.`);
    }
  }
} catch (err) {
  console.warn('[T.U.G.O.N. Structure] Non-fatal Cloudflare config check warning:', err);
}
