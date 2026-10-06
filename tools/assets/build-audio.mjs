// Builds the game's sound effects and music from CC0 packs (docs/ASSETS.md), into
// game/assets/resources/audio/{sfx,music}. Each effect is one or more variants (picked at random in
// game, so a gun that fires ten times a second doesn't drill one sample into the ear); a variant is
// cut from a source sound, optionally pitched, layered with another, faded and level-matched.
//
// - Rapid sounds (fast guns, hits, ticks, taps) and the beam loop are mono WAV: an mp3 starts with
//   ~25 ms of encoder delay, which smears rapid fire and clicks at a loop's seam. The rest is mono mp3.
// - The WARNING siren is our own: a two-tone square wave like the NES music around it.
// - Music: SketchyLogic's NES Shooter Music, mono mp3.
//
// ffmpeg decodes and encodes; the cutting and mixing happens here on raw samples.
//
// Usage: npm run build:audio
// Sources: art-source/kenney-sci-fi-sounds, kenney-impact-sounds, kenney-interface-sounds,
// sketchylogic-nes-shooter-music (see docs/ASSETS.md).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'art-source');
const OUT = path.join(ROOT, 'game/assets/resources/audio');
const RATE = 44100;
/** WAV effects are stored at this rate (they are short; the top octave matters little). */
const WAV_RATE = 32000;
const MP3_SFX = '80k';
const MP3_MUSIC = '96k';

const SCIFI = 'kenney-sci-fi-sounds';
const IMPACT = 'kenney-impact-sounds';
const UI = 'kenney-interface-sounds';
const NES = 'sketchylogic-nes-shooter-music';

/**
 * A variant: `src` pack/file; `at`/`dur` cut (s); `pitch` (2 = an octave up, shorter); `gain`
 * (linear, after peak normalisation); `fadeIn`/`fadeOut` (s); `mix` another variant laid on top.
 */
const v = (pack, file, opts = {}) => Object.assign({ src: path.join(SRC, pack, file) }, opts);

/** Effects: id → { format, variants }. Levels are matched to a peak of −1 dBFS; volumes are in data/audio.ts. */
const SFX = {
  // Primary weapons.
  pulse: { format: 'wav', variants: [0, 1, 2, 3].map((i) => v(SCIFI, `laserSmall_00${i}.ogg`, { dur: 0.22, fadeOut: 0.08 })) },
  scatter: { format: 'wav', variants: [0, 1, 3].map((i) => v(SCIFI, `laserRetro_00${i}.ogg`, { dur: 0.2, pitch: 0.85, fadeOut: 0.08 })) },
  seeker: { format: 'mp3', variants: [0, 1, 2].map((i) => v(SCIFI, `thrusterFire_00${i}.ogg`, { at: 0.4 + i * 0.7, dur: 0.34, pitch: 1.3, fadeIn: 0.02, fadeOut: 0.2 })) },
  ion: { format: 'wav', loop: true, variants: [v(SCIFI, 'engineCircular_002.ogg', { at: 0.5, dur: 2.2, pitch: 1.5 })] },
  plasma: { format: 'mp3', variants: [0, 1, 2].map((i) => v(SCIFI, `laserLarge_00${i}.ogg`, { dur: 0.45, pitch: 0.9, fadeOut: 0.2 })) },
  tesla: { format: 'wav', variants: [0, 1, 2, 3].map((i) => v(SCIFI, `computerNoise_00${i}.ogg`, { at: 0.6 + i * 0.9, dur: 0.16, fadeIn: 0.005, fadeOut: 0.08 })) },
  // Secondary weapons and the gun drone.
  swarm: { format: 'mp3', variants: [3, 4].map((i) => v(SCIFI, `thrusterFire_00${i}.ogg`, { at: 1.0, dur: 0.42, pitch: 1.1, fadeIn: 0.02, fadeOut: 0.25 })) },
  wing: { format: 'wav', variants: [0, 1, 2].map((i) => v(SCIFI, `laserSmall_00${i}.ogg`, { dur: 0.2, pitch: 1.3, fadeOut: 0.07 })) },
  rail: { format: 'mp3', variants: [3, 4].map((i) => v(SCIFI, `laserLarge_00${i}.ogg`, { dur: 0.6, pitch: 0.7, fadeOut: 0.3 })) },
  rear: { format: 'wav', variants: [2, 3, 4].map((i) => v(SCIFI, `laserRetro_00${i}.ogg`, { dur: 0.2, pitch: 0.75, fadeOut: 0.08 })) },
  drone: { format: 'wav', variants: [3, 4].map((i) => v(SCIFI, `laserSmall_00${i}.ogg`, { dur: 0.16, pitch: 1.6, fadeOut: 0.06 })) },
  // Hits and explosions.
  hit: { format: 'wav', variants: [0, 1, 2, 3].map((i) => v(IMPACT, `impactMetal_light_00${i}.ogg`, { dur: 0.14, fadeOut: 0.07 })) },
  hitArmored: { format: 'wav', variants: [0, 1, 2].map((i) => v(IMPACT, `impactPlate_light_00${i}.ogg`, { dur: 0.22, fadeOut: 0.1 })) },
  explodeSmall: { format: 'mp3', variants: [0, 2].map((i) => v(SCIFI, `explosionCrunch_00${i}.ogg`, { dur: 0.7, fadeOut: 0.3 })) },
  explodeMedium: { format: 'mp3', variants: [1, 3].map((i) => v(SCIFI, `explosionCrunch_00${i}.ogg`, { dur: 1.2, fadeOut: 0.5, mix: v(SCIFI, 'lowFrequency_explosion_001.ogg', { gain: 0.5 }) })) },
  explodeLarge: { format: 'mp3', variants: [v(SCIFI, 'lowFrequency_explosion_000.ogg', { mix: v(SCIFI, 'explosionCrunch_004.ogg', { gain: 0.7 }) })] },
  blast: { format: 'mp3', variants: [v(SCIFI, 'explosionCrunch_004.ogg', { dur: 0.6, pitch: 1.2, fadeOut: 0.3 })] },
  playerDied: { format: 'mp3', variants: [v(SCIFI, 'lowFrequency_explosion_000.ogg', { mix: v(SCIFI, 'explosionCrunch_003.ogg', { pitch: 0.8 }) })] },
  // The ship.
  playerHit: { format: 'mp3', variants: [0, 1].map((i) => v(IMPACT, `impactPunch_heavy_00${i}.ogg`, { dur: 0.45, fadeOut: 0.2, mix: v(SCIFI, 'explosionCrunch_000.ogg', { dur: 0.45, gain: 0.5 }) })) },
  shieldHit: { format: 'mp3', variants: [0, 1, 2].map((i) => v(SCIFI, `forceField_00${i}.ogg`, { dur: 0.45, pitch: 1.2, fadeOut: 0.25 })) },
  shieldDown: { format: 'mp3', variants: [v(IMPACT, 'impactGlass_heavy_000.ogg')] },
  graze: { format: 'wav', variants: [v(UI, 'tick_002.ogg'), v(UI, 'tick_004.ogg')] },
  blocked: { format: 'wav', variants: [0, 1].map((i) => v(IMPACT, `impactGlass_light_00${i}.ogg`)) },
  // Pickups and pods.
  credit: { format: 'wav', variants: [v(UI, 'pluck_001.ogg'), v(UI, 'pluck_002.ogg')] },
  power: { format: 'mp3', variants: [v(UI, 'maximize_008.ogg')] },
  repair: { format: 'mp3', variants: [v(UI, 'confirmation_004.ogg')] },
  shieldUp: { format: 'mp3', variants: [v(UI, 'maximize_004.ogg')] },
  energy: { format: 'mp3', variants: [v(UI, 'maximize_006.ogg')] },
  podRescued: { format: 'mp3', variants: [v(UI, 'confirmation_002.ogg')] },
  podsLaunched: { format: 'mp3', variants: [v(UI, 'question_001.ogg')] },
  podLost: { format: 'mp3', variants: [v(UI, 'error_005.ogg')] },
  // Enemies' armour.
  enemyShieldBroken: { format: 'mp3', variants: [v(IMPACT, 'impactGlass_medium_000.ogg', { dur: 0.4, fadeOut: 0.15 })] },
  armorBroken: { format: 'mp3', variants: [v(IMPACT, 'impactBell_heavy_000.ogg')] },
  // Specials.
  nova: { format: 'mp3', variants: [v(SCIFI, 'forceField_004.ogg', { pitch: 0.6, mix: v(SCIFI, 'lowFrequency_explosion_001.ogg', { gain: 0.8 }) })] },
  overdrive: { format: 'mp3', variants: [v(SCIFI, 'spaceEngineLarge_000.ogg', { at: 0.5, dur: 1.2, pitch: 1.25, fadeIn: 0.05, fadeOut: 0.6 })] },
  phase: { format: 'mp3', variants: [v(SCIFI, 'forceField_002.ogg', { pitch: 0.8 })] },
  warp: { format: 'mp3', variants: [v(NES, 'Warp Jingle.wav')] },
  warning: { format: 'mp3', variants: [{ synth: 'siren' }] },
  // Menu.
  uiTap: { format: 'wav', variants: [v(UI, 'select_002.ogg')] },
  uiBack: { format: 'wav', variants: [v(UI, 'back_002.ogg')] },
  uiTab: { format: 'wav', variants: [v(UI, 'toggle_002.ogg')] },
  uiEquip: { format: 'mp3', variants: [v(UI, 'maximize_002.ogg')] },
  uiBuy: { format: 'mp3', variants: [v(UI, 'confirmation_001.ogg')] },
  uiDenied: { format: 'mp3', variants: [v(UI, 'error_002.ogg')] },
  launch: { format: 'mp3', variants: [v(SCIFI, 'doorOpen_001.ogg')] },
  cheat: { format: 'mp3', variants: [v(UI, 'maximize_009.ogg')] },
};

/** Music: id → source file (mono mp3). */
const MUSIC = {
  menu: 'Map.wav',
  mercury: 'Mercury.wav',
  venus: 'Venus.wav',
  mars: 'Mars.wav',
  bossIntro: 'BossIntro.wav',
  boss: 'BossMain.wav',
  jingleStart: 'Intro Jingle.wav',
  jingleWin: 'Win Jingle.wav',
};

function ffmpeg(args, input) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { input, maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

/** Mono float samples at RATE. */
function decode(file) {
  if (!fs.existsSync(file)) throw new Error(`missing source ${file}`);
  const buf = ffmpeg(['-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(RATE), 'pipe:1']);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
}

/** Resampled by linear interpolation: pitch 2 plays an octave up in half the time. */
function repitch(x, pitch) {
  if (pitch === 1) return x;
  const n = Math.floor(x.length / pitch);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i * pitch;
    const k = Math.floor(t);
    const f = t - k;
    y[i] = x[k] * (1 - f) + (x[k + 1] ?? 0) * f;
  }
  return y;
}

function peak(x) {
  let p = 0;
  for (const s of x) p = Math.max(p, Math.abs(s));
  return p;
}

/** Two-tone alarm: square wave alternating 880 / 660 Hz every 0.18 s, 1.5 s with a fade. */
function siren() {
  const n = Math.floor(RATE * 1.5);
  const y = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = Math.floor(t / 0.18) % 2 === 0 ? 880 : 660;
    phase += f / RATE;
    // 25% pulse wave, like the NES's second duty cycle.
    y[i] = (phase % 1 < 0.25 ? 1 : -1) * 0.5;
  }
  return y;
}

function render(spec) {
  if (spec.synth === 'siren') return fade(siren(), 0.005, 0.3);
  let x = decode(spec.src);
  const at = Math.floor((spec.at ?? 0) * RATE);
  // Cut long enough that the pitch change still leaves `dur` seconds.
  const pitch = spec.pitch ?? 1;
  const len = spec.dur !== undefined ? Math.floor(spec.dur * RATE * pitch) : x.length - at;
  x = x.slice(at, at + len);
  x = repitch(x, pitch);
  const p = peak(x);
  if (p > 0) for (let i = 0; i < x.length; i++) x[i] /= p;
  const gain = spec.gain ?? 1;
  for (let i = 0; i < x.length; i++) x[i] *= gain;
  if (spec.mix) {
    const m = render(spec.mix);
    const out = new Float32Array(Math.max(x.length, m.length));
    for (let i = 0; i < out.length; i++) out[i] = (x[i] ?? 0) + (m[i] ?? 0);
    x = out;
  }
  return fade(x, spec.fadeIn ?? 0.003, spec.fadeOut ?? 0.01);
}

function fade(x, fadeIn, fadeOut) {
  const a = Math.min(x.length, Math.floor(fadeIn * RATE));
  const b = Math.min(x.length, Math.floor(fadeOut * RATE));
  for (let i = 0; i < a; i++) x[i] *= i / a;
  for (let i = 0; i < b; i++) x[x.length - 1 - i] *= i / b;
  return x;
}

/** A loop: the tail crossfaded into the head, so the seam is seamless. */
function makeLoop(x, overlap = 0.25) {
  const o = Math.floor(overlap * RATE);
  const n = x.length - o;
  const y = x.slice(0, n);
  for (let i = 0; i < o; i++) {
    const k = i / o;
    y[i] = x[n + i] * (1 - k) + x[i] * k;
  }
  return y;
}

function normalize(x, level = 0.89) {
  const p = peak(x);
  if (p > 0) for (let i = 0; i < x.length; i++) x[i] *= level / p;
  return x;
}

function write(x, file, format, bitrate) {
  const pcm = Buffer.from(x.buffer, x.byteOffset, x.byteLength);
  const codec = format === 'wav' ? ['-ar', String(WAV_RATE), '-c:a', 'pcm_s16le'] : ['-c:a', 'libmp3lame', '-b:a', bitrate];
  ffmpeg(['-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', 'pipe:0', ...codec, file], pcm);
}

function clean(dir, keep) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.meta')) continue;
    if (!keep.has(f)) {
      fs.rmSync(path.join(dir, f));
      fs.rmSync(path.join(dir, `${f}.meta`), { force: true });
    }
  }
}

const sfxDir = path.join(OUT, 'sfx');
const musicDir = path.join(OUT, 'music');
const sfxFiles = new Set();
let bytes = 0;
for (const [id, def] of Object.entries(SFX)) {
  def.variants.forEach((spec, i) => {
    let x = render(spec);
    if (def.loop) x = makeLoop(x);
    normalize(x);
    const name = `${id}_${i}.${def.format}`;
    sfxFiles.add(name);
    fs.mkdirSync(sfxDir, { recursive: true });
    write(x, path.join(sfxDir, name), def.format, MP3_SFX);
    bytes += fs.statSync(path.join(sfxDir, name)).size;
  });
}
clean(sfxDir, sfxFiles);
const musicFiles = new Set();
for (const [id, file] of Object.entries(MUSIC)) {
  const x = normalize(decode(path.join(SRC, NES, file)), 0.94);
  const name = `${id}.mp3`;
  musicFiles.add(name);
  fs.mkdirSync(musicDir, { recursive: true });
  write(x, path.join(musicDir, name), 'mp3', MP3_MUSIC);
  bytes += fs.statSync(path.join(musicDir, name)).size;
}
clean(musicDir, musicFiles);
console.log(`audio: ${sfxFiles.size} effect files, ${musicFiles.size} music tracks, ${(bytes / 1024).toFixed(0)} KB`);
