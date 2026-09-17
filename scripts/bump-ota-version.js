#!/usr/bin/env node
/**
 * Bump the visible app version for the next OTA.
 * Updates app.json, package.json, and src/version.ts together.
 * runtimeVersion stays pinned in app.json so existing native builds keep receiving updates.
 *
 * Usage:
 *   node scripts/bump-ota-version.js           # patch: 1.0.1 → 1.0.2
 *   node scripts/bump-ota-version.js minor     # 1.0.2 → 1.1.0
 *   node scripts/bump-ota-version.js 1.2.0     # set explicit
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const appJsonPath = path.join(root, 'app.json');
const packageJsonPath = path.join(root, 'package.json');
const versionTsPath = path.join(root, 'src/version.ts');

const app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const current = String(app.expo?.version ?? pkg.version ?? '1.0.0');
const arg = process.argv[2] ?? 'patch';

function bump(version, kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
  const parts = version.split('.').map((n) => Number(n));
  while (parts.length < 3) parts.push(0);
  let [major, minor, patch] = parts;
  if (kind === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (kind === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

const next = bump(current, arg);
app.expo.version = next;
pkg.version = next;

// Keep native compatibility: never let runtime track expo.version for OTAs.
if (app.expo.runtimeVersion && typeof app.expo.runtimeVersion === 'object') {
  app.expo.runtimeVersion = '1.0.0';
}
if (!app.expo.runtimeVersion) {
  app.expo.runtimeVersion = '1.0.0';
}

const versionTs = `/** Display version — bumped by \`scripts/bump-ota-version.js\` on every OTA. */\nexport const APP_VERSION = '${next}';\n`;

fs.writeFileSync(appJsonPath, `${JSON.stringify(app, null, 2)}\n`);
fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
fs.writeFileSync(versionTsPath, versionTs);
process.stdout.write(`${current} → ${next}\n`);
