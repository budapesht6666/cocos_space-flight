// Music and sound effects (GDD §18), one for the page load: a node kept across scenes carries two
// music sources (one fades in while the other fades out) and the effect sources. Effects are
// loaded up front (they are small); music tracks load on first use and stay cached. Volumes come
// from the settings (services/SettingsService.ts); levels per sound from data/audio.ts.
//
// iOS Safari plays nothing until the first touch: the engine resumes its audio context then, and
// music asked for earlier starts on it (the title's "Tap to start" is that touch).

import { AudioClip, AudioSource, Director, Node, director, game, resources } from 'cc';
import { volumeGain } from '../core/settings';
import { MUSIC, MUSIC_FX, musicPath, SFX, sfxPath } from '../data/audio';
import type { MusicId, Settings, SfxId } from '../data/types';
import { SettingsService } from './SettingsService';

/** Music plays this much quieter while the game is paused. */
const DUCK = 0.4;

interface Deck {
  node: Node;
  source: AudioSource;
  track: MusicId | null;
  /** Fade level 0..1 and where it is heading. */
  level: number;
  target: number;
  /** What follows a track that does not loop. */
  next: MusicId | null;
}

interface State {
  root: Node;
  sfx: AudioSource;
  loop: AudioSource;
  loopId: SfxId | null;
  decks: [Deck, Deck];
  /** The deck playing (or about to play) the wanted track. */
  front: number;
  /** Requested track; a load finishing late for another one is dropped. */
  wanted: MusicId | null;
  musicGain: number;
  sfxGain: number;
  ducked: boolean;
}

let state: State | null = null;
const clips = new Map<string, AudioClip>();
const loading = new Set<string>();
/** Real time (ms) each effect last played, for its `gap`. */
const lastPlayed = new Map<SfxId, number>();

function load(path: string, done?: (clip: AudioClip) => void): void {
  const cached = clips.get(path);
  if (cached) {
    done?.(cached);
    return;
  }
  if (loading.has(path) && !done) return;
  loading.add(path);
  resources.load(path, AudioClip, (err, clip) => {
    loading.delete(path);
    if (err || !clip) {
      console.warn(`[AudioService] could not load ${path}`, err);
      return;
    }
    clips.set(path, clip);
    done?.(clip);
  });
}

function deck(root: Node, name: string): Deck {
  const node = new Node(name);
  root.addChild(node);
  const source = node.addComponent(AudioSource);
  source.playOnAwake = false;
  const d: Deck = { node, source, track: null, level: 0, target: 0, next: null };
  node.on(AudioSource.EventType.ENDED, () => onEnded(d));
  return d;
}

function applySettings(s: Readonly<Settings>): void {
  if (!state) return;
  state.musicGain = volumeGain(s.music);
  state.sfxGain = volumeGain(s.sfx);
  state.sfx.volume = state.sfxGain;
  if (state.loopId) state.loop.volume = state.sfxGain * SFX[state.loopId].volume;
  for (const d of state.decks) applyDeck(d);
}

function applyDeck(d: Deck): void {
  if (!state) return;
  const def = d.track ? MUSIC[d.track] : null;
  d.source.volume = def ? def.volume * d.level * state.musicGain * (state.ducked ? DUCK : 1) : 0;
}

/** A track that does not loop has ended: its follow-up starts at once, on the same deck. */
function onEnded(d: Deck): void {
  if (!state || d.track === null || state.decks[state.front] !== d) return;
  const next = d.next;
  d.track = null;
  if (next) start(next, MUSIC[next].next ?? null, false);
}

/** Puts a track on the front deck; with `fade`, the old one fades out while the new one fades in. */
function start(id: MusicId, next: MusicId | null, fade: boolean): void {
  const s = state;
  if (!s) return;
  s.wanted = id;
  load(musicPath(id), (clip) => {
    if (!state || state.wanted !== id) return;
    const old = s.decks[s.front];
    const useOther = fade && old.track !== null;
    if (useOther) {
      old.target = 0;
      s.front = 1 - s.front;
    }
    const d = s.decks[s.front];
    d.source.stop();
    d.source.clip = clip;
    d.source.loop = MUSIC[id].loop;
    d.track = id;
    d.next = next;
    d.level = useOther ? 0 : 1;
    d.target = 1;
    applyDeck(d);
    d.source.play();
  });
}

/** Per frame: music fades. Real time, so it keeps going through pauses and hitstops. */
function tick(): void {
  const s = state;
  if (!s) return;
  const dt = game.deltaTime;
  for (let i = 0; i < s.decks.length; i++) {
    const d = s.decks[i];
    if (d.level === d.target) continue;
    const step = dt / (d.target > d.level ? MUSIC_FX.crossfade : MUSIC_FX.fadeOut);
    d.level = d.target > d.level ? Math.min(d.target, d.level + step) : Math.max(d.target, d.level - step);
    applyDeck(d);
    if (d.level === 0 && d.target === 0) {
      d.source.stop();
      d.track = null;
    }
  }
}

export const AudioService = {
  /** Each scene's entry component calls this; the first call builds the audio node and loads the effects. */
  init(): void {
    if (state) return;
    const scene = director.getScene();
    if (!scene) return;
    const root = new Node('Audio');
    scene.addChild(root);
    director.addPersistRootNode(root);
    const sfx = root.addComponent(AudioSource);
    sfx.playOnAwake = false;
    const loopNode = new Node('Loop');
    root.addChild(loopNode);
    const loop = loopNode.addComponent(AudioSource);
    loop.playOnAwake = false;
    loop.loop = true;
    state = { root, sfx, loop, loopId: null, decks: [deck(root, 'MusicA'), deck(root, 'MusicB')], front: 0, wanted: null, musicGain: 1, sfxGain: 1, ducked: false };
    applySettings(SettingsService.current);
    SettingsService.listen(applySettings);
    director.on(Director.EVENT_AFTER_UPDATE, tick);
    for (const id of Object.keys(SFX) as SfxId[]) for (let i = 0; i < SFX[id].variants; i++) load(sfxPath(id, i));
  },

  /** Starts loading a track before it is needed (a mission's music, the boss). */
  preload(id: MusicId): void {
    load(musicPath(id));
  },

  /**
   * Plays a track, crossfading from the current one; the same track keeps playing. `then`: what
   * follows a track that does not loop (otherwise its own `next`).
   */
  music(id: MusicId, then: MusicId | null = null): void {
    const s = state;
    if (!s) return;
    const d = s.decks[s.front];
    if (s.wanted === id && d.track === id && d.target > 0) return;
    start(id, then ?? MUSIC[id].next ?? null, true);
  },

  /** Fades the music out. */
  stopMusic(): void {
    const s = state;
    if (!s) return;
    s.wanted = null;
    for (const d of s.decks) {
      d.target = 0;
      d.next = null;
    }
  },

  /** Quieter music while the game is paused. */
  duck(ducked: boolean): void {
    if (!state || state.ducked === ducked) return;
    state.ducked = ducked;
    for (const d of state.decks) applyDeck(d);
  },

  /** Plays an effect (a random variant), unless it played less than its `gap` ago. */
  play(id: SfxId, scale = 1): void {
    const s = state;
    if (!s || s.sfxGain <= 0) return;
    const def = SFX[id];
    const now = game.totalTime;
    const last = lastPlayed.get(id);
    if (last !== undefined && now - last < def.gap * 1000) return;
    const clip = clips.get(sfxPath(id, Math.floor(Math.random() * def.variants)));
    if (!clip) return;
    lastPlayed.set(id, now);
    s.sfx.playOneShot(clip, def.volume * scale);
  },

  /** A looping effect (the Ion Laser's beam) on or off. One loop at a time. */
  loop(id: SfxId, on: boolean): void {
    const s = state;
    if (!s) return;
    if (!on) {
      if (s.loopId === id) {
        s.loop.stop();
        s.loopId = null;
      }
      return;
    }
    if (s.loopId === id) return;
    const clip = clips.get(sfxPath(id, 0));
    if (!clip) return;
    s.loopId = id;
    s.loop.clip = clip;
    s.loop.volume = s.sfxGain * SFX[id].volume;
    s.loop.play();
  },
};
