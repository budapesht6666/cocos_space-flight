// Uploads the release web build (game/build/web-mobile) to the VPS as a static site.
//
// The build is made by Cocos Creator on this machine (the server has no editor), so the server
// app has no git repo: files go straight into /srv/apps/<app>/repo/dist and Caddy serves them.
// Steps: stamp the service worker cache with a build id → tar.gz → ssh into dist.new → swap
// dist.new with dist (atomic for visitors: the old build stays live until the swap).
//
// Usage: npm run deploy:web            deploys game/build/web-mobile (the editor's build)
//        npm run release:web           CLI build (tools/build-web.mjs) + deploy — the post-commit hook
// Needs `ssh vps` to work, see ~/.ssh/config.
// One-time server setup: docs/PLATFORMS.md, section «PWA».

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
// `--from <dir>`: deploy another build (npm run release:web passes the CLI mirror's output).
const fromArg = process.argv.indexOf('--from');
const BUILD = fromArg > 0 && process.argv[fromArg + 1] ? path.resolve(ROOT, process.argv[fromArg + 1]) : path.join(ROOT, 'game/build/web-mobile');
const HOST = process.env.DEPLOY_HOST ?? 'vps';
const APP_DIR = '/srv/apps/spaceflight/repo';
const URL = 'https://spaceflight.p1gog.duckdns.org/';

function fail(message) {
  console.error(`deploy-web: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(BUILD, 'index.html'))) fail(`no build at ${BUILD} — build web-mobile first (CLAUDE.md, «Релизная сборка»)`);
// md5Cache renames template files too (sw.js → sw.<hash>.js) and rewrites the reference in
// index.html, so the service worker is whichever sw*.js the build has.
const swName = fs.readdirSync(BUILD).find((f) => /^sw(\.[0-9a-f]+)?\.js$/.test(f));
if (!swName) fail('no sw.js in the build — is game/build-templates/web-mobile in place?');
const sw = path.join(BUILD, swName);

// Build id: commit + time, so every upload gets a fresh service worker cache.
let commit = 'nogit';
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
} catch {
  // not a git checkout: the timestamp alone is enough
}
const stamp = `${commit}-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)}`;
const swText = fs.readFileSync(sw, 'utf8');
if (swText.includes('__BUILD__')) fs.writeFileSync(sw, swText.replace('__BUILD__', stamp));
else if (!/spaceflight-[\w-]+/.test(swText)) fail('sw.js has no cache name to stamp');

// Relative archive name: GNU tar (Git Bash) reads "C:\..." as host:path.
const archiveName = `spaceflight-${stamp}.tar.gz`;
const archive = path.join(os.tmpdir(), archiveName);
execFileSync('tar', ['-czf', archiveName, '-C', BUILD, '.'], { cwd: os.tmpdir(), stdio: 'inherit' });
const size = (fs.statSync(archive).size / 1024 / 1024).toFixed(1);
console.log(`build ${stamp}: ${size} MB → ${HOST}:${APP_DIR}/dist`);

const remote = [
  'set -e',
  `cd ${APP_DIR}`,
  'rm -rf dist.new dist.old',
  'mkdir dist.new',
  'tar -xzf - -C dist.new',
  'if [ -d dist ]; then mv dist dist.old; fi',
  'mv dist.new dist',
  'rm -rf dist.old',
  'echo uploaded: $(du -sh dist | cut -f1)',
].join(' && ');

await new Promise((resolve, reject) => {
  const ssh = spawn('ssh', [HOST, remote], { stdio: ['pipe', 'inherit', 'inherit'] });
  fs.createReadStream(archive).pipe(ssh.stdin);
  ssh.on('error', reject);
  ssh.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ssh exited with ${code}`))));
}).catch((err) => fail(err.message));

fs.rmSync(archive, { force: true });
console.log(`live: ${URL}`);
