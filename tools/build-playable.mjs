// The playable demo (data/demo.ts) as one self-contained HTML file, for game feeds that take a
// single HTML5 file (BingePlay: "HTML5 file only", 3–6 MB).
//
// 1. Mirrors game/ into .cache/playable-game (like build-web.mjs; its own mirror, so the release
//    build's library is left alone), without the models and music the demo never loads: only the
//    demo mission's enemies, props and pickups, the demo ship in its default paint, its drones, and
//    the tracks the mission plays (re-encoded smaller). Everything under resources/ ships in a
//    build, used or not.
// 2. Builds it with build-configs/playable.json: the Game scene only, no md5 names.
// 3. Packs the build (engine, scripts, assets; not the PWA bits of the page template) into one gzip
//    blob, base64 in the page, next to tools/playable/loader.js, which serves the engine's requests
//    from it. The page sets window.SPACEFLIGHT_DEMO, which switches the game into the demo.
//
// Usage: npm run build:playable              → .cache/playable/space-flight-demo.html (and index.html)
//        npm run serve:playable              → it on http://<LAN IP>:8080/
//        npm run build:playable -- --pack-only   (re-pack the last build)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import zlib from 'node:zlib';

register('./lib/ts-loader.mjs', import.meta.url);

const ROOT = path.resolve(import.meta.dirname, '..');
const GAME = path.join(ROOT, 'game');
const MIRROR = path.join(ROOT, '.cache/playable-game');
const CONFIG = path.join(ROOT, 'build-configs/playable.json');
const OUT_DIR = path.join(ROOT, '.cache/playable');
const OUT = path.join(OUT_DIR, 'space-flight-demo.html');
const EDITOR = process.env.COCOS_CREATOR ?? 'C:\\ProgramData\\cocos\\editors\\Creator\\3.8.8\\CocosCreator.exe';
const SKIP = ['library', 'temp', 'build', 'local', 'profiles', 'extensions', 'node_modules'];
const BUILD_OK = 36;
/** Where the page's relative URLs point (<base>): the loader answers them from the pack. */
const BASE = 'https://spaceflight.p1gog.duckdns.org/demo/';
/** Build output that is the page template's PWA (service worker, manifest, icons, splash pictures). */
const NOT_PACKED = /^(index\.html|sw\.js|manifest\.webmanifest|style\.css|icons\/|splash\/)/;
/** The demo's music: mono MP3 at this bitrate (the game's is 96k, and mp3 doesn't gzip). */
const MUSIC_BITRATE = '64k';
/** BingePlay asks for 3–6 MB. */
const SIZE_LIMIT = 6 * 1024 * 1024;

function fail(message) {
  console.error(`build-playable: ${message}`);
  process.exit(1);
}

const scripts = path.join(GAME, 'assets/scripts');
const load = (file) => import(new URL(`file:///${path.join(scripts, file).replace(/\\/g, '/')}`).href);

/** resources/ files the demo needs nothing from: models and tracks, as paths under game/assets/resources. */
async function unusedResources() {
  const [{ DEMO }, { MISSIONS }, { missionNeeds, missionPrefabPaths }, { DEFAULT_PAINT, shipModelFile }, { DRONES }, { propPath }] = await Promise.all([
    load('data/demo.ts'),
    load('data/missions.ts'),
    load('core/missionNeeds.ts'),
    load('data/player.ts'),
    load('data/weapons.ts'),
    load('data/props.ts'),
  ]);
  const mission = MISSIONS[DEMO.mission];
  // Prefab paths are "<file>/<prefab>"; the file is what sits in resources/.
  const keep = new Set(missionPrefabPaths(missionNeeds(mission)).map((p) => p.slice(0, p.lastIndexOf('/'))));
  for (const id of DEMO.drones) keep.add(propPath(DRONES[id].prop).replace(/\/[^/]+$/, ''));
  keep.add(shipModelFile(DEMO.ship, DEFAULT_PAINT));
  // game/GameAudio.ts: the mission's track, its intro jingle, the boss, the win jingle, the menu
  // track after a defeat.
  for (const track of [mission.music, 'jingleStart', 'bossIntro', 'boss', 'jingleWin', 'menu']) keep.add(`audio/music/${track}`);

  const res = path.join(GAME, 'assets/resources');
  const unused = [];
  const music = [];
  for (const dir of ['models/ships', 'models/props', 'audio/music']) {
    for (const name of fs.readdirSync(path.join(res, dir))) {
      if (name.endsWith('.meta')) continue;
      const id = `${dir}/${name.replace(/\.[^.]+$/, '')}`;
      if (!keep.has(id)) unused.push(`${dir}/${name}`);
      else if (dir === 'audio/music') music.push(`${dir}/${name}`);
    }
  }
  const missing = [...keep].filter((id) => !fs.readdirSync(path.join(res, path.dirname(id))).some((n) => n.startsWith(`${path.basename(id)}.`)));
  if (missing.length > 0) fail(`the demo needs files that are not in resources/: ${missing.join(', ')}`);
  return { unused, music };
}

/** The demo's tracks, re-encoded into the mirror. A copy robocopy left (same time as the game's file) or an older encode is redone. */
function encodeMusic(music, res) {
  let encoded = 0;
  for (const rel of music) {
    const src = res(GAME, rel);
    const dst = res(MIRROR, rel);
    if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs > fs.statSync(src).mtimeMs) continue;
    const ff = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-ac', '1', '-b:a', MUSIC_BITRATE, dst], { encoding: 'utf8' });
    if (ff.error || ff.status !== 0) fail(`ffmpeg failed on ${rel}: ${ff.error?.message ?? ff.stderr}`);
    encoded++;
  }
  if (encoded > 0) console.log(`build-playable: ${encoded} tracks re-encoded at ${MUSIC_BITRATE}`);
}

async function build() {
  if (!fs.existsSync(EDITOR)) fail(`Cocos Creator not found at ${EDITOR} (set COCOS_CREATOR)`);
  const { unused, music } = await unusedResources();
  const res = (base, rel) => path.join(base, 'assets/resources', rel);
  // Left out: unused files with their .meta, and the demo's tracks (encodeMusic writes them).
  const excluded = [...unused.flatMap((rel) => [res(GAME, rel), `${res(GAME, rel)}.meta`]), ...music.map((rel) => res(GAME, rel))];
  fs.mkdirSync(MIRROR, { recursive: true });
  const copy = spawnSync(
    'robocopy',
    [GAME, MIRROR, '/MIR', '/XD', ...SKIP.map((d) => path.join(GAME, d)), ...SKIP.map((d) => path.join(MIRROR, d)), '/XF', ...excluded, '/NFL', '/NDL', '/NJH', '/NJS', '/NP'],
    { stdio: 'inherit' },
  );
  if (copy.error || copy.status === null || copy.status >= 8) fail(`robocopy failed (${copy.error?.message ?? copy.status})`);
  // /XF keeps robocopy from copying them, and from purging copies left from before.
  for (const rel of unused) for (const file of [res(MIRROR, rel), `${res(MIRROR, rel)}.meta`]) fs.rmSync(file, { force: true });
  console.log(`build-playable: ${unused.length} models and tracks left out`);
  encodeMusic(music, res);

  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE;
  const started = Date.now();
  console.log('build-playable: building…');
  const result = spawnSync(EDITOR, ['--project', MIRROR, '--build', `configPath=${CONFIG}`], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const log = path.join(ROOT, '.cache/build-playable.log');
  fs.writeFileSync(log, `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  if (result.status !== BUILD_OK || !fs.existsSync(path.join(buildDir(), 'index.html'))) fail(`Cocos build failed (exit ${result.status}), log: ${log}`);
  console.log(`build-playable: built in ${Math.round((Date.now() - started) / 1000)} s`);
}

function buildDir() {
  return path.join(MIRROR, 'build/playable');
}

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return out;
}

/** The boot sequence of the build's index.html: its scripts, import map and entry module. */
function bootOf(dir) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const src = (pattern) => {
    const m = html.match(pattern);
    if (!m) fail(`index.html of the build has no ${pattern}`);
    return m[1];
  };
  const polyfills = src(/<script src="(src\/polyfills[^"]*\.js)"/);
  const system = src(/<script src="(src\/system[^"]*\.js)"/);
  const mapPath = src(/<script src="([^"]+)" type="systemjs-importmap"/);
  const entry = src(/System\.import\('\.\/([^']+)'\)/);
  // Its addresses are relative to src/; inline, they resolve against the page.
  const map = JSON.parse(fs.readFileSync(path.join(dir, mapPath), 'utf8'));
  const mapBase = new URL(mapPath, BASE);
  for (const key of Object.keys(map.imports)) map.imports[key] = `./${new URL(map.imports[key], mapBase).href.slice(BASE.length)}`;
  return { polyfills, system, entry, importMap: JSON.stringify(map) };
}

function pack() {
  const dir = buildDir();
  if (!fs.existsSync(path.join(dir, 'index.html'))) fail(`no build in ${path.relative(ROOT, dir)}: run without --pack-only`);
  const files = walk(dir).filter((f) => !NOT_PACKED.test(f)).sort();
  const index = {};
  const chunks = [];
  let offset = 0;
  for (const f of files) {
    const data = fs.readFileSync(path.join(dir, f));
    index[f] = [offset, data.length];
    chunks.push(data);
    offset += data.length;
  }
  const head = Buffer.from(JSON.stringify(Object.assign({ files: index }, bootOf(dir))));
  const size = Buffer.alloc(4);
  size.writeUInt32LE(head.length);
  const raw = Buffer.concat([size, head, ...chunks]);
  const gz = zlib.gzipSync(raw, { level: 9 });

  const template = path.join(GAME, 'build-templates/web-mobile');
  const css = fs.readFileSync(path.join(template, 'style.css'), 'utf8');
  const logo = fs.readFileSync(path.join(template, 'splash/logo.png')).toString('base64');
  const loader = fs.readFileSync(path.join(ROOT, 'tools/playable/loader.js'), 'utf8');
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<base href="${BASE}">
<title>Space Flight — demo</title>
<meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1,minimum-scale=1,maximum-scale=1,viewport-fit=cover">
<style>${css}</style>
</head>
<body>
<div id="splash" aria-hidden="true"><img class="logo" src="data:image/png;base64,${logo}" alt=""><div class="bar"><i></i></div></div>
<div id="GameDiv" cc_exact_fit_screen="true"><div id="Cocos3dGameContainer"><canvas id="GameCanvas" oncontextmenu="event.preventDefault()" tabindex="99"></canvas></div></div>
<script>window.SPACEFLIGHT_DEMO = true;</script>
<script id="pack" type="application/octet-stream">${gz.toString('base64')}</script>
<script>${loader}</script>
</body>
</html>
`;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, page);
  // The same page as index.html, for npm run serve:playable (phones on the Wi-Fi).
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), page);
  const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
  console.log(`build-playable: ${files.length} files, ${mb(raw.length)} → gzip ${mb(gz.length)} → page ${mb(page.length)}: ${path.relative(ROOT, OUT)}`);
  const biggest = files.map((f) => [f, index[f][1]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  for (const [f, n] of biggest) console.log(`  ${mb(n).padStart(8)}  ${f}`);
  if (page.length > SIZE_LIMIT) console.warn(`build-playable: over ${mb(SIZE_LIMIT)}, the size BingePlay asks for`);
}

if (!process.argv.includes('--pack-only')) await build();
pack();
