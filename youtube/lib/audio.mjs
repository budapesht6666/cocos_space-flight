// Sound for the YouTube clips, rebuilt offline from the game's own files and levels: the capture
// logs every sound call with its frame (youtube/capture.mjs), and this lays the same sounds on a
// timeline at 48 kHz — the game's mix (data/audio.ts volumes × default settings), in game time.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';

register('../../tools/lib/ts-loader.mjs', import.meta.url);

const ROOT = path.resolve(import.meta.dirname, '../..');
const SCRIPTS = path.join(ROOT, 'game/assets/scripts');
const RESOURCES = path.join(ROOT, 'game/assets/resources/audio');
const load = (file) => import(new URL(`file:///${path.join(SCRIPTS, file).replace(/\\/g, '/')}`).href);

const audioData = await load('data/audio.ts');
const settingsData = await load('data/settings.ts');
const settingsCore = await load('core/settings.ts');

export const { SFX, MUSIC, MUSIC_FX } = audioData;
export const RATE = 48000;
export const FPS = 60;
/** The game's default volume settings (Settings → MUSIC, SOUND FX). */
export const MUSIC_GAIN = settingsCore.volumeGain(settingsData.SETTINGS.defaults.music);
export const SFX_GAIN = settingsCore.volumeGain(settingsData.SETTINGS.defaults.sfx);
/** The ship's guns and drones: their own stem (the game plays them only with GUN SOUNDS on). */
/** Guns under the rest in a mix: the game ships them off by default because rapid fire drowned the fight. */
export const GUNS_LEVEL = 0.55;
export const GUNS = new Set(['pulse', 'scatter', 'seeker', 'ion', 'plasma', 'tesla', 'swarm', 'wing', 'rail', 'rear', 'drone']);

const decoded = new Map();

/** A sound file of the game as mono float samples at RATE (`sfx/hit_2`, `music/boss`). */
export function samples(name) {
  const cached = decoded.get(name);
  if (cached) return cached;
  const base = path.join(RESOURCES, name);
  const file = ['.wav', '.mp3'].map((ext) => base + ext).find((f) => fs.existsSync(f));
  if (!file) throw new Error(`no sound file for ${name}`);
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(RATE), 'pipe:1'], { maxBuffer: 1 << 28 });
  const data = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4).slice();
  decoded.set(name, data);
  return data;
}

/** Seconds of a sound file. */
export function seconds(name) {
  return samples(name).length / RATE;
}

/** The effect id of a clip name: `explodeSmall_1` → `explodeSmall`. */
export function sfxId(clip) {
  return clip.replace(/_\d+$/, '');
}

/** Adds `src` × gain into `out` from sample `at` (clipped to `out`), optionally looping it until `until`. */
export function place(out, src, at, gain, until = -1, envelope = null) {
  const end = until >= 0 ? Math.min(until, out.length) : Math.min(out.length, at + src.length);
  for (let i = Math.max(0, at); i < end; i++) {
    const k = i - at;
    const s = until >= 0 ? src[k % src.length] : src[k];
    out[i] += s * gain * (envelope ? envelope(i) : 1);
  }
}

/** A short fade at both ends of [from, to) so a cut or a loop's edges don't click. */
export function edges(from, to, fade = Math.round(RATE * 0.01)) {
  return (i) => Math.min(1, (i - from) / fade, (to - i) / fade);
}

/** Writes mono float samples as a 16-bit stereo WAV (the game is mono). */
export function writeWav(file, mono, gain = 1) {
  const n = mono.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, mono[i] * gain));
    const s = Math.round(v * 32767);
    buf.writeInt16LE(s, 44 + i * 4);
    buf.writeInt16LE(s, 46 + i * 4);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

/** Peak of a buffer. */
export function peak(buf) {
  let p = 0;
  for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i]));
  return p;
}

/**
 * Effects and the Ion Laser loop of a capture log into two stems (`sfx`, `guns`) of `length`
 * samples. Each effect's `gap` (rate limit) is applied in game time, as the game does in real
 * time (the capture runs slower than real time, so it let every call through).
 * `from`: the log frame that lands at sample 0.
 */
export function effects(log, length, from = 0) {
  const sfx = new Float32Array(length);
  const guns = new Float32Array(length);
  const last = new Map();
  const ordered = log.sounds.slice().sort((a, b) => a.f - b.f);
  let loopOn = null;
  const closeLoop = (f) => {
    if (!loopOn) return;
    const a = Math.round(((loopOn.f - from) / FPS) * RATE);
    const b = Math.round(((f - from) / FPS) * RATE);
    if (b > 0 && a < length) place(guns, samples(`sfx/${loopOn.clip}`), a, loopOn.volume, Math.min(b, length), edges(a, b));
    loopOn = null;
  };
  for (const e of ordered) {
    if (e.kind === 'loopStart') {
      if (!loopOn) loopOn = e;
      continue;
    }
    if (e.kind === 'loopStop') {
      closeLoop(e.f);
      continue;
    }
    if (e.kind !== 'sfx') continue;
    const id = sfxId(e.clip);
    const def = SFX[id];
    const gap = def ? def.gap * FPS : 0;
    const prev = last.get(id);
    if (prev !== undefined && e.f - prev < gap) continue;
    last.set(id, e.f);
    const at = Math.round(((e.f - from) / FPS) * RATE);
    if (at >= length) continue;
    place(GUNS.has(id) ? guns : sfx, samples(`sfx/${e.clip}`), at, e.volume * SFX_GAIN);
  }
  closeLoop(from + (length / RATE) * FPS);
  return { sfx, guns };
}

/**
 * The music of a capture log as one stem: tracks start where the log says (negative frames are
 * before the clip), a track without a loop is followed by its `next` when it ends, and a new
 * track crossfades over the old one like AudioService does.
 */
export function music(log, length, from = 0) {
  const out = new Float32Array(length);
  const starts = log.music.filter((e) => e.kind === 'music' && e.clip).sort((a, b) => a.f - b.f);
  // Expand into plays: [start sample, track], with non-looping tracks chained to their next.
  const plays = [];
  for (const e of starts) {
    const at = Math.round(((e.f - from) / FPS) * RATE);
    if (plays.length && plays[plays.length - 1].track === e.clip) continue;
    plays.push({ at, track: e.clip, fadeIn: plays.length > 0 });
  }
  const timeline = [];
  for (let i = 0; i < plays.length; i++) {
    const p = plays[i];
    const end = i + 1 < plays.length ? plays[i + 1].at : Infinity;
    let at = p.at;
    let track = p.track;
    let fadeIn = p.fadeIn;
    for (;;) {
      const def = MUSIC[track];
      const len = samples(`music/${track}`).length;
      if (def.loop || !def.next || at + len >= end) {
        timeline.push({ at, track, until: end, fadeIn, loop: def.loop });
        break;
      }
      timeline.push({ at, track, until: at + len, fadeIn, loop: false });
      at += len;
      track = def.next;
      fadeIn = false;
    }
  }
  const crossfade = Math.round(MUSIC_FX.crossfade * RATE);
  const fadeOut = Math.round(MUSIC_FX.fadeOut * RATE);
  for (let i = 0; i < timeline.length; i++) {
    const t = timeline[i];
    const next = timeline[i + 1];
    // A crossfaded successor: this one keeps playing while it fades out.
    const tail = next && next.fadeIn ? fadeOut : 0;
    const stop = Math.min(length, t.until === Infinity ? length : t.until + tail);
    if (stop <= 0 || t.at >= length) continue;
    const src = samples(`music/${t.track}`);
    const gain = MUSIC[t.track].volume * MUSIC_GAIN;
    const env = (s) => {
      let k = 1;
      if (t.fadeIn) k = Math.min(k, (s - t.at) / crossfade);
      if (tail && s >= t.until) k = Math.min(k, 1 - (s - t.until) / tail);
      return Math.max(0, k);
    };
    place(out, src, t.at, gain, t.loop || tail ? stop : Math.min(stop, t.at + src.length), env);
  }
  return out;
}
