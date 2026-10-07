// Films the game for YouTube Shorts: 1080×1920, 60 fps of game time, frame-perfect.
//
// A headless Chrome (the system one, on the GPU) opens the release web build at 360×640 CSS px ×3.
// The game is stepped by hand — GameWorld.update runs once per filmed frame with dt = 1/60, so
// hitstops, the boss-kill slow motion and the HUD all play in game time however slow the capture
// is — and every frame goes from a screenshot straight into ffmpeg. Nothing is heard while
// filming: the game's sound calls are logged instead (effects, the Ion Laser loop, music tracks)
// with the frame they happen on, and youtube/mix.mjs builds the sound track from that log. Game
// events (kills, boss in, armour broken, Nova, lasers…) are logged too, for editing to the beat.
//
// Usage: npm run build:web               (the build to film: .cache/cli-game/build/web-mobile)
//        npm run youtube:capture [ids…]  (all segments of youtube/segments.mjs, or the named ones)
// Out (git-ignored): youtube/out/clips/<id>.mp4 (no sound), youtube/out/events/<id>.json.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { SEGMENTS } from './segments.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const BUILD = path.join(ROOT, '.cache/cli-game/build/web-mobile');
const OUT = path.join(import.meta.dirname, 'out');
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FPS = 60;
/** CSS size × pixel ratio = 1080×1920, the Shorts frame. */
const VIEW = { width: 360, height: 640, deviceScaleFactor: 3 };
/** Game frames per browser frame while fast-forwarding (nothing is filmed then). */
const FF_BURST = 8;
/** A trial run: film at most this many frames per segment (env YT_FRAMES). */
const LIMIT = Number(process.env.YT_FRAMES) || 0;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ttf': 'font/ttf',
  '.bin': 'application/octet-stream',
};

function serve(dir) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dir, url);
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

// ---- Page side: runs in the game's page (serialised by puppeteer, so self-contained) ---------

/** Hooks the scene: the update gate, the sound log, the event log, the autopilot. */
function pageSetup(opts) {
  const scene = cc.director.getScene();
  const world = scene.getChildByName('World');
  const comp = world.getComponent(opts.menu ? 'StartScreen' : 'GameWorld');
  const log = { sounds: [], events: [], boss: [] };
  window.__log = log;
  window.__frame = 0;
  window.__steps = 0;
  window.__burst = 1;

  // Sound: log the calls instead of playing them. Effects go through the root source's
  // playOneShot, the Ion Laser's beam through the Loop source, music through two decks.
  const audio = scene.getChildByName('Audio');
  const sound = (kind, extra) => log.sounds.push(Object.assign({ f: window.__frame, kind }, extra));
  if (audio) {
    const sfx = audio.getComponent('cc.AudioSource');
    sfx.playOneShot = (clip, volume) => sound('sfx', { clip: clip.name, volume });
    const loop = audio.getChildByName('Loop').getComponent('cc.AudioSource');
    loop.play = function () {
      sound('loopStart', { clip: this.clip ? this.clip.name : null, volume: this.volume });
    };
    loop.stop = () => sound('loopStop', {});
    for (const name of ['MusicA', 'MusicB']) {
      const deck = audio.getChildByName(name).getComponent('cc.AudioSource');
      // A track already started before the hooks (the mission's music) counts from frame 0.
      if (deck.clip && deck.playing) sound('music', { clip: deck.clip.name, deck: name });
      deck.play = function () {
        sound('music', { clip: this.clip ? this.clip.name : null, deck: name });
      };
      deck.stop = () => sound('musicStop', { deck: name });
    }
  }

  const proto = Object.getPrototypeOf(comp);
  if (opts.menu) {
    comp.update = function () {
      let n = 0;
      while (window.__steps > 0 && n < window.__burst) {
        window.__steps--;
        window.__frame++;
        n++;
        proto.update.call(this, 1 / 60);
      }
    };
    window.__ready = () => !!(comp.ready && comp.fade && !comp.fade.covering);
    return true;
  }

  const gw = comp;
  const s = gw.s;
  const event = (type, extra) => log.events.push(Object.assign({ f: window.__frame, type }, extra));
  const on = (type, pick) => s.ctx.bus.on(type, (e) => event(type, pick ? pick(e) : {}));
  on('enemyKilled', (e) => ({ name: e.def.name, size: e.def.explosion, boss: e.boss, part: e.part, x: +e.x.toFixed(2), z: +e.z.toFixed(2) }));
  on('armorBroken');
  on('novaBomb');
  on('special', (e) => ({ id: e.def.id }));
  on('banner', (e) => ({ style: e.style, text: e.text }));
  on('laser', (e) => ({ firing: e.firing }));
  on('blast');
  on('broodLaunched');
  on('mineArmed');
  on('podsLaunched');
  on('playerHit');
  on('pickupCollected', (e) => ({ kind: e.kind }));

  // Autopilot, one decision per game frame (deterministic with the seed).
  const pilot = () => {
    const p = s.player;
    if (p.mode !== 'control') return;
    const t = window.__frame / 60;
    let x = 0;
    if (opts.pilot === 'boss') {
      const boss = s.enemies.boss;
      const target = boss && !boss.dead ? (boss.parts && boss.parts[0]) || boss : null;
      x = (target ? target.x : 0) + Math.sin(t * 1.3) * 1.2;
    } else {
      let best = null;
      for (const e of s.enemies.active) if (!e.dead && e.z < p.z - 1 && e.z > s.playfield.topZ && (!best || e.z > best.z)) best = e;
      x = (best ? best.x : 0) + Math.sin(t * 1.7) * 0.6;
    }
    p.targetX = Math.max(-3.8, Math.min(3.8, x));
    p.targetZ = s.playfield.zAt(0.72);
  };

  let bossSeen = false;
  window.__bossSeen = -1;
  window.__specials = [];
  gw.update = function () {
    let n = 0;
    while (window.__steps > 0 && n < window.__burst) {
      window.__steps--;
      window.__frame++;
      n++;
      if (window.__specials.indexOf(window.__frame) >= 0) this.specialQueued = true;
      pilot();
      proto.update.call(this, 1 / 60);
      const boss = s.enemies.boss;
      if (boss && !bossSeen) {
        bossSeen = true;
        window.__bossSeen = window.__frame;
        event('bossEnter', { name: boss.def.name });
      }
      if (boss && window.__frame % 6 === 0) log.boss.push({ f: window.__frame, hp: +(boss.hp / boss.maxHp).toFixed(3), armored: s.enemies.isArmored(boss) });
      // Fast-forward target reached: stop on this very frame.
      const until = window.__until;
      const met = !until ? false : until.kind === 'boss' ? bossSeen : until.kind === 'dead' ? window.__bossDead() : window.__bossLow(until.below) || window.__bossDead();
      if (met) {
        window.__until = null;
        window.__hit = true;
        window.__steps = 0;
      }
    }
  };
  window.__bossLow = (below) => {
    const boss = s.enemies.boss;
    return !!boss && !s.enemies.isArmored(boss) && boss.hp / boss.maxHp < below;
  };
  window.__bossDead = () => log.events.some((e) => e.type === 'enemyKilled' && e.boss);
  window.__ready = () => !!(gw.fade && !gw.fade.covering);
  return true;
}

// ---- Node side ------------------------------------------------------------------------------

async function waitFor(page, fn, arg, timeout = 60000) {
  await page.waitForFunction(fn, { polling: 'raf', timeout }, arg);
}

/** Runs `frames` game frames as fast as the page allows (nothing filmed). */
async function run(page, frames, burst = FF_BURST) {
  await page.evaluate((n, b) => {
    window.__burst = b;
    window.__steps = n;
  }, frames, burst);
  await waitFor(page, () => window.__steps === 0, null, 600000);
}

function encoder(file) {
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '13', '-pix_fmt', 'yuv420p', '-g', '30', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))));
  return { ff, done };
}

/** Opens the segment's mission (or the menu) in a fresh context and hooks it, before any step. */
async function open(browser, base, seg) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(VIEW);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // Gun sounds on (off by default in the game): logged on a stem of their own, mixed in lower.
  await page.evaluateOnNewDocument(() => localStorage.setItem('spaceflight.settings', JSON.stringify({ gunSounds: true })));
  const url = seg.menu ? `${base}?quality=ultra` : `${base}?mission=${seg.mission}&${seg.flags}`;
  await page.goto(url, { waitUntil: 'load' });
  const comp = seg.menu ? 'StartScreen' : 'GameWorld';
  await waitFor(page, (name) => {
    try {
      const c = cc.director.getScene().getChildByName('World').getComponent(name);
      return !!c && (name === 'StartScreen' ? !!c.fade : !!c.s);
    } catch {
      return false;
    }
  }, comp, 90000);
  await page.evaluate(pageSetup, { menu: !!seg.menu, pilot: seg.pilot ?? 'hunt' });
  return { context, page, errors, url };
}

async function film(browser, base, seg) {
  let { context, page, errors, url } = await open(browser, base, seg);

  // Warm up (the fade-in), then fast-forward to the moment.
  await run(page, seg.warm);
  await waitFor(page, () => window.__ready(), null, 30000).catch(() => run(page, 30));
  if (seg.ff && seg.ff.until === 'kill') {
    // Two passes: find the frame the boss dies on, then replay the mission (the same seed and a
    // per-frame autopilot make it the same fight) and start filming `before` frames ahead of it.
    await page.evaluate(() => {
      window.__hit = false;
      window.__until = { kind: 'dead' };
    });
    await run(page, seg.ff.max);
    const kill = await page.evaluate(() => (window.__hit ? window.__frame : -1));
    if (kill < 0) console.warn(`  ${seg.id}: the boss didn't die within ${seg.ff.max} frames`);
    await context.close();
    ({ context, page, errors, url } = await open(browser, base, seg));
    await run(page, Math.max(seg.warm, kill - seg.ff.before));
    seg = Object.assign({}, seg, { expectKill: kill });
  } else if (seg.ff) {
    // The page stops the run on the frame the condition holds (a boss can lose its last 10% in a
    // second, between two checks from out here).
    const { until, after = 0, below = 0.1, max } = seg.ff;
    await page.evaluate((u, b) => {
      window.__hit = false;
      window.__until = { kind: u, below: b };
    }, until, below);
    await run(page, max);
    const hit = await page.evaluate(() => window.__hit);
    if (!hit) console.warn(`  ${seg.id}: fast-forward hit its limit (${max} frames)`);
    if (await page.evaluate(() => window.__bossDead())) console.warn(`  ${seg.id}: the boss died before filming`);
    if (after > 0) await run(page, after);
  }

  // Film.
  const clip = path.join(OUT, 'clips', `${seg.id}.mp4`);
  const { ff, done } = encoder(clip);
  // Special on clip frame k = the step numbered start + k + 1.
  const start = await page.evaluate((specials) => {
    window.__burst = 1;
    const at = window.__frame;
    window.__specials = specials.map((k) => at + k + 1);
    return at;
  }, seg.special ?? []);
  let frames = 0;
  let killAt = -1;
  const started = Date.now();
  const most = LIMIT ? Math.min(LIMIT, seg.frames) : seg.frames;
  for (; frames < most; frames++) {
    await page.evaluate(() => {
      window.__steps = 1;
    });
    await waitFor(page, () => window.__steps === 0);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 92, optimizeForSpeed: true });
    if (!ff.stdin.write(jpeg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (seg.afterKill && killAt < 0 && (await page.evaluate(() => (window.__bossDead ? window.__bossDead() : false)))) killAt = frames;
    if (killAt >= 0 && frames - killAt >= seg.afterKill) {
      frames++;
      break;
    }
    if (frames % 60 === 0) process.stdout.write(`\r  ${seg.id}: ${frames}/${seg.frames} frames`);
  }
  ff.stdin.end();
  await done;
  const log = await page.evaluate(() => window.__log);
  await context.close();

  // Frames relative to the clip: a step numbered `f` first shows in clip frame f − start − 1.
  const rel = (list) => list.map((e) => Object.assign({}, e, { f: e.f - start - 1 }));
  const inClip = (e) => e.f >= 0 && e.f < frames;
  const sounds = rel(log.sounds);
  // Music running when filming starts: the last track started before it (with its age).
  const music = sounds.filter((e) => e.kind === 'music' || e.kind === 'musicStop');
  const record = {
    id: seg.id,
    note: seg.note,
    url: url.replace(base, '/'),
    fps: FPS,
    frames,
    size: [VIEW.width * VIEW.deviceScaleFactor, VIEW.height * VIEW.deviceScaleFactor],
    music: music.filter((e) => e.f < frames),
    sounds: sounds.filter((e) => e.kind !== 'music' && e.kind !== 'musicStop' && (inClip(e) || e.kind === 'loopStart' || e.kind === 'loopStop')),
    events: rel(log.events).filter(inClip),
    boss: rel(log.boss).filter(inClip),
    errors,
  };
  fs.writeFileSync(path.join(OUT, 'events', `${seg.id}.json`), JSON.stringify(record, null, 1));
  if (seg.expectKill !== undefined) {
    // The replay should be the same fight: the kill lands `before` frames in.
    const kill = record.events.find((e) => e.type === 'enemyKilled' && e.boss);
    console.log(`  ${seg.id}: boss killed on clip frame ${kill ? kill.f : 'none'} (planned ${seg.ff.before - 1})`);
  }
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`\r  ${seg.id}: ${frames} frames (${(frames / FPS).toFixed(1)} s) in ${secs} s, ${record.events.length} events, ${record.sounds.length} sounds${errors.length ? `, ${errors.length} page errors` : ''}`);
}

if (!fs.existsSync(path.join(BUILD, 'index.html'))) {
  console.error(`youtube/capture: no build at ${BUILD} — run npm run build:web first`);
  process.exit(1);
}
for (const dir of ['clips', 'events']) fs.mkdirSync(path.join(OUT, dir), { recursive: true });
const wanted = process.argv.slice(2);
const segments = wanted.length ? SEGMENTS.filter((s) => wanted.includes(s.id)) : SEGMENTS;
if (!segments.length) {
  console.error(`youtube/capture: no such segment (${wanted.join(', ')}); have ${SEGMENTS.map((s) => s.id).join(', ')}`);
  process.exit(1);
}

const { server, url } = await serve(BUILD);
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  // The GPU through ANGLE/D3D11 (without it Chrome falls back to software WebGL and the game to
  // its lowest tier); audio may start without a gesture so the game loads and starts its sounds.
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--force-color-profile=srgb', '--mute-audio'],
});
try {
  for (const seg of segments) await film(browser, url, seg);
} finally {
  await browser.close();
  server.close();
}
