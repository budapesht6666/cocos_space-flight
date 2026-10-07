// The plain Short: ≤ 30 s of the filmed segments with the game's sound, hard cuts, no overlays —
// ready to upload as is, and the reference cut for a fancier edit (youtube/REMOTION_PROMPT.md).
//
// Picture: the pieces of PIECES, in order. Sound: one continuous music bed — the boss intro on
// the first frame into the boss theme, the win jingle on MISSION COMPLETE, the jingle's follow-up
// (the menu theme) under the title — with each piece's own effects and guns laid frame-exact.
// Loudness: −14 LUFS (YouTube's reference), true peak under −1.5 dB: a limiter, then a measured gain.
//
// Usage: npm run youtube:cut   → youtube/out/space-flight-short.mp4

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { edges, effects, FPS, GUNS_LEVEL, music, RATE, writeWav } from './lib/audio.mjs';

const OUT = path.join(import.meta.dirname, 'out');

/**
 * The edit, in seconds of each clip. `kill`: times count from the boss's death in that clip
 * (from its log). `jingle`: the win jingle starts on this piece's MISSION COMPLETE banner.
 */
const PIECES = [
  { clip: 'ice', from: 0, to: 4.6 }, // Nova Bomb at 1.0 s — the hook
  { clip: 'ion', from: 0.6, to: 4.6 },
  { clip: 'hive', from: 0.5, to: 4.0 },
  { clip: 'warden-kill', kill: true, from: -1.2, to: 2.3 },
  { clip: 'leviathan', from: 0.5, to: 4.5 },
  { clip: 'leviathan-kill', kill: true, from: -1.8, to: 3.4, jingle: true },
  { clip: 'title', from: 0.2, to: 3.2 },
];

const logs = new Map();
function logOf(id) {
  if (!logs.has(id)) logs.set(id, JSON.parse(fs.readFileSync(path.join(OUT, 'events', `${id}.json`), 'utf8')));
  return logs.get(id);
}

// Resolve pieces to frames of their clips.
let total = 0;
const pieces = PIECES.map((p) => {
  const log = logOf(p.clip);
  let base = 0;
  if (p.kill) {
    const kill = log.events.find((e) => e.type === 'enemyKilled' && e.boss);
    if (!kill) throw new Error(`${p.clip}: no boss kill in the log`);
    base = kill.f;
  }
  const from = Math.max(0, base + Math.round(p.from * FPS));
  const to = Math.min(log.frames, base + Math.round(p.to * FPS));
  const piece = { ...p, log, fromF: from, toF: to, at: total };
  total += to - from;
  return piece;
});
const length = Math.round((total / FPS) * RATE);

// Effects and guns, piece by piece.
const sfx = new Float32Array(length);
const guns = new Float32Array(length);
for (const p of pieces) {
  const len = Math.round(((p.toF - p.fromF) / FPS) * RATE);
  const stems = effects(p.log, len, p.fromF);
  const at = Math.round((p.at / FPS) * RATE);
  const fade = edges(0, len, Math.round(RATE * 0.012));
  for (let i = 0; i < len && at + i < length; i++) {
    const k = fade(i);
    sfx[at + i] += stems.sfx[i] * k;
    guns[at + i] += stems.guns[i] * k;
  }
}

// One music bed for the whole Short.
const jinglePiece = pieces.find((p) => p.jingle);
const banner = jinglePiece && jinglePiece.log.events.find((e) => e.type === 'banner' && e.style === 'success' && e.f >= jinglePiece.fromF && e.f < jinglePiece.toF);
const bedLog = { music: [{ f: 0, kind: 'music', clip: 'bossIntro' }] };
if (banner) bedLog.music.push({ f: jinglePiece.at + (banner.f - jinglePiece.fromF), kind: 'music', clip: 'jingleWin' });
const bed = music(bedLog, length);
// The title's last half second: everything fades out.
const tailFade = Math.round(RATE * 0.6);

const mix = new Float32Array(length);
for (let i = 0; i < length; i++) {
  const k = Math.min(1, (length - i) / tailFade);
  mix[i] = (bed[i] + sfx[i] + GUNS_LEVEL * guns[i]) * k;
}
const wav = path.join(OUT, 'audio', 'short.mix.wav');
writeWav(wav, mix, 0.9);

// Loudness in two passes: a limiter (explosions peak far above the rest, and would cap the gain),
// then measure, then one plain gain to −14 LUFS that keeps the true peak under −1.5 dB.
const LIMIT = 'alimiter=level_in=2.2:limit=0.75:attack=2:release=80:level=false';
// ffmpeg prints the measurement on stderr.
const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', `${LIMIT},loudnorm=I=-14:TP=-1.5:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const measured = JSON.parse((probe.match(/{[sS]*}/) || ['{}'])[0]);
const loudness = Number(measured.input_i);
const truePeak = Number(measured.input_tp);
const gain = Number.isFinite(loudness) ? Math.min(-14 - loudness, -1.5 - truePeak) : 0;
const loudnorm = `${LIMIT},volume=${gain.toFixed(2)}dB`;

// Picture: trim each clip and concatenate; then the sound, normalised.
const inputs = [];
const chains = [];
pieces.forEach((p, i) => {
  inputs.push('-i', path.join(OUT, 'clips', `${p.clip}.mp4`));
  chains.push(`[${i}:v]trim=start_frame=${p.fromF}:end_frame=${p.toF},setpts=PTS-STARTPTS[v${i}]`);
});
const graph = `${chains.join(';')};${pieces.map((_, i) => `[v${i}]`).join('')}concat=n=${pieces.length}:v=1:a=0[v]`;
const file = path.join(OUT, 'space-flight-short.mp4');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-i', wav, '-filter_complex', graph, '-map', '[v]', '-map', `${pieces.length}:a`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart',
  '-af', loudnorm, '-ar', String(RATE), '-c:a', 'aac', '-b:a', '192k', '-shortest', file], { stdio: 'inherit' });

// The edit as a table, for the description and for a re-edit.
const edl = pieces.map((p) => ({ clip: p.clip, from: +(p.fromF / FPS).toFixed(3), to: +(p.toF / FPS).toFixed(3), at: +(p.at / FPS).toFixed(3) }));
fs.writeFileSync(path.join(OUT, 'space-flight-short.edl.json'), JSON.stringify({ seconds: +(total / FPS).toFixed(2), jingleAt: banner ? +((jinglePiece.at + banner.f - jinglePiece.fromF) / FPS).toFixed(2) : null, pieces: edl }, null, 1));
console.log(`space-flight-short.mp4: ${(total / FPS).toFixed(1)} s, ${pieces.length} pieces${banner ? `, win jingle at ${((jinglePiece.at + banner.f - jinglePiece.fromF) / FPS).toFixed(1)} s` : ''}`);
