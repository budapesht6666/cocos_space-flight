// Sound for every filmed segment, from its capture log (youtube/out/events/<id>.json):
//   youtube/out/audio/<id>.music.wav   the music as the game played it (crossfades, intro → loop)
//   youtube/out/audio/<id>.sfx.wav     effects: explosions, hits, Nova, lasers, pickups, WARNING…
//   youtube/out/audio/<id>.guns.wav    the ship's guns, drones and the Ion Laser beam
//   youtube/out/audio/<id>.mix.wav     all three, guns lower (GUNS_LEVEL), at the game's balance
//   youtube/out/preview/<id>.mp4       the clip with that mix, loudness-normalised for listening
// Stems keep the game's levels, so an editor can rebalance them; 48 kHz, 16-bit stereo.
//
// Usage: npm run youtube:mix [ids…]

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { effects, FPS, GUNS_LEVEL, music, peak, RATE, writeWav } from './lib/audio.mjs';

const OUT = path.join(import.meta.dirname, 'out');

const wanted = process.argv.slice(2);
const logs = fs
  .readdirSync(path.join(OUT, 'events'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .filter((id) => !wanted.length || wanted.includes(id));
if (!logs.length) {
  console.error('youtube/mix: no capture logs — run npm run youtube:capture first');
  process.exit(1);
}

for (const id of logs) {
  const log = JSON.parse(fs.readFileSync(path.join(OUT, 'events', `${id}.json`), 'utf8'));
  const length = Math.round((log.frames / FPS) * RATE);
  const bed = music(log, length);
  const { sfx, guns } = effects(log, length);
  const mix = new Float32Array(length);
  for (let i = 0; i < length; i++) mix[i] = bed[i] + sfx[i] + GUNS_LEVEL * guns[i];
  // Headroom for the stems' sum: scale the mix only if it would clip.
  const top = peak(mix);
  const audio = path.join(OUT, 'audio');
  writeWav(path.join(audio, `${id}.music.wav`), bed);
  writeWav(path.join(audio, `${id}.sfx.wav`), sfx);
  writeWav(path.join(audio, `${id}.guns.wav`), guns);
  writeWav(path.join(audio, `${id}.mix.wav`), mix, top > 0.98 ? 0.98 / top : 1);

  const clip = path.join(OUT, 'clips', `${id}.mp4`);
  const preview = path.join(OUT, 'preview', `${id}.mp4`);
  fs.mkdirSync(path.dirname(preview), { recursive: true });
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', clip, '-i', path.join(audio, `${id}.mix.wav`),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', String(RATE), '-c:a', 'aac', '-b:a', '192k', '-shortest', preview]);
  const tracks = [...new Set(log.music.filter((e) => e.kind === 'music').map((e) => e.clip))].join(' → ') || 'none';
  console.log(`${id}: ${(log.frames / FPS).toFixed(1)} s, music ${tracks}, ${log.sounds.length} sound calls, peak ${top.toFixed(2)}`);
}
