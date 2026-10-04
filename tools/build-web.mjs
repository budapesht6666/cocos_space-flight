// Release web build (web-mobile) from the command line, without touching the editor.
//
// Cocos Creator can't build a project that is open in the editor, and the editor is usually open
// here (the cocos MCP lives in it). So the build runs on a mirror of game/ in .cache/cli-game:
// robocopy /MIR copies the sources (assets, settings, build templates) and keeps the mirror's own
// library/ between runs, so only changed assets get re-imported.
//
// Usage: npm run build:web          → .cache/cli-game/build/web-mobile
//        npm run release:web        → build:web + deploy:web (what the post-commit hook runs)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const GAME = path.join(ROOT, 'game');
const MIRROR = path.join(ROOT, '.cache/cli-game');
const CONFIG = path.join(ROOT, 'build-configs/web-mobile.json');
const EDITOR = process.env.COCOS_CREATOR ?? 'C:\\ProgramData\\cocos\\editors\\Creator\\3.8.8\\CocosCreator.exe';
/** Generated or machine-local: never mirrored, and robocopy leaves the mirror's own copies alone. */
const SKIP = ['library', 'temp', 'build', 'local', 'profiles', 'extensions', 'node_modules'];
/** Cocos CLI exit code for a successful build. */
const BUILD_OK = 36;

function fail(message) {
  console.error(`build-web: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(EDITOR)) fail(`Cocos Creator not found at ${EDITOR} (set COCOS_CREATOR)`);
fs.mkdirSync(MIRROR, { recursive: true });

// 1. Mirror the sources. robocopy exit codes below 8 mean success (files copied, extras purged).
const copy = spawnSync('robocopy', [GAME, MIRROR, '/MIR', '/XD', ...SKIP.map((d) => path.join(GAME, d)), ...SKIP.map((d) => path.join(MIRROR, d)), '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], {
  stdio: 'inherit',
});
if (copy.error || copy.status === null || copy.status >= 8) fail(`robocopy failed (${copy.error?.message ?? copy.status})`);

// 2. Build. The VS Code terminal sets ELECTRON_RUN_AS_NODE, which turns the editor into plain Node.
const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;
const started = Date.now();
console.log('build-web: building web-mobile…');
const build = spawnSync(EDITOR, ['--project', MIRROR, '--build', `configPath=${CONFIG}`], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const log = path.join(ROOT, '.cache/build-web.log');
fs.writeFileSync(log, `${build.stdout ?? ''}\n${build.stderr ?? ''}`);
const out = path.join(MIRROR, 'build/web-mobile');
if (build.status !== BUILD_OK || !fs.existsSync(path.join(out, 'index.html'))) fail(`Cocos build failed (exit ${build.status}), log: ${log}`);
console.log(`build-web: done in ${Math.round((Date.now() - started) / 1000)} s → ${path.relative(ROOT, out)}`);
