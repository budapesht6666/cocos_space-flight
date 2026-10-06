// Stage 6 menu logic: the hangar's ship card, cheat codes, settings; and the audio data's files.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyCheat, findCheat, hasCheat } from '../../game/assets/scripts/core/cheats';
import { buyUpgrade, upgradeLevel, upgradeUnlocked } from '../../game/assets/scripts/core/economy';
import { buildLoadout, owns } from '../../game/assets/scripts/core/loadout';
import { openHangarItems, shipUnlocked, unlockHint } from '../../game/assets/scripts/core/progress';
import { applyRun, type RecordMap } from '../../game/assets/scripts/core/records';
import { loadSave, newSave, SAVE_VERSION, serializeSave } from '../../game/assets/scripts/core/save';
import { defaultSettings, parseSettings, qualityChoices, stepSetting, volumeGain } from '../../game/assets/scripts/core/settings';
import { formatFactor, shipStats, shipTraits, statCeilings, statDelta } from '../../game/assets/scripts/core/shipCard';
import { MUSIC, musicPath, PICKUP_SFX, SFX, sfxPath, WEAPON_SFX } from '../../game/assets/scripts/data/audio';
import { CHEATS } from '../../game/assets/scripts/data/cheats';
import { UPGRADE_ORDER, UPGRADES } from '../../game/assets/scripts/data/economy';
import { MISSIONS } from '../../game/assets/scripts/data/missions';
import { SETTINGS } from '../../game/assets/scripts/data/settings';
import { SHIPS } from '../../game/assets/scripts/data/player';
import type { MusicId, SfxId } from '../../game/assets/scripts/data/types';

const RESOURCES = path.resolve(__dirname, '../../game/assets/resources');

function audioFile(resourcePath: string): string | null {
  for (const ext of ['.wav', '.mp3']) {
    const file = path.join(RESOURCES, resourcePath + ext);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

describe('ship card', () => {
  const save = newSave();
  const stats = (id: keyof typeof SHIPS) => shipStats(SHIPS[id], buildLoadout(save, SHIPS[id]));

  it('table rows: hull and shield in pips, speed and firepower as factors', () => {
    const exe = stats('executioner');
    expect(exe.map((s) => s.id)).toEqual(['hull', 'shield', 'speed', 'firepower']);
    expect(exe[0]).toMatchObject({ value: 5, text: '5', pips: true });
    expect(exe[1]).toMatchObject({ value: 3, text: '3', pips: true });
    expect(exe[2].text).toBe('×0.85');
    expect(exe[3].text).toBe('×1.15');
    expect(stats('spitfire')[2].text).toBe('×1.0');
    expect(stats('striker')[2].text).toBe('×1.2');
  });

  it('pips fit the most any ship can have', () => {
    const ceil = statCeilings();
    expect(ceil.hull).toBe(Math.max(...UPGRADES.hull.values) + 2);
    expect(ceil.shield).toBe(Math.max(...UPGRADES.shield.values) + 1);
  });

  it('differences from the flown ship: signed, units for pips, percent for factors', () => {
    const spit = stats('spitfire');
    const exe = stats('executioner');
    expect(statDelta(exe[0], spit[0])).toEqual({ sign: 1, text: '+2' });
    expect(statDelta(exe[2], spit[2])).toEqual({ sign: -1, text: '−15%' });
    expect(statDelta(exe[3], spit[3])).toEqual({ sign: 1, text: '+15%' });
    expect(statDelta(spit[1], spit[1])).toEqual({ sign: 0, text: '' });
    expect(statDelta(stats('striker')[0], spit[0]).text).toBe('−1');
  });

  it('traits: what each ship does beyond the table', () => {
    expect(shipTraits(SHIPS.spitfire).map((t) => [t.id, t.value])).toEqual([['recovery', '1.5 s']]);
    expect(shipTraits(SHIPS.executioner).map((t) => [t.id, t.value])).toEqual([['reload', '−20%']]);
    expect(shipTraits(SHIPS.striker).map((t) => [t.id, t.value])).toEqual([
      ['graze', '+30%'],
      ['energy', '+30%'],
      ['charges', '+1'],
    ]);
    for (const ship of Object.values(SHIPS)) expect(shipTraits(ship).length, ship.id).toBeLessThanOrEqual(3);
  });

  it('factors print with one or two decimals', () => {
    expect(formatFactor(1)).toBe('×1.0');
    expect(formatFactor(1.2)).toBe('×1.2');
    expect(formatFactor(0.85)).toBe('×0.85');
  });
});

describe('cheats', () => {
  it('codes match without case or spaces; unknown ones do not', () => {
    expect(findCheat('p1gog.weapon')?.id).toBe('arsenal');
    expect(findCheat('  P1GOG.Credits ')?.id).toBe('credits');
    expect(findCheat('p1gog')).toBeNull();
    expect(findCheat('')).toBeNull();
  });

  it('credits: +50,000 to the wallet each time', () => {
    const save = newSave();
    applyCheat(save, CHEATS.credits);
    applyCheat(save, CHEATS.credits);
    expect(save.credits).toBe(100000);
    expect(save.earned).toBe(100000);
    expect(save.cheats).toEqual([]);
  });

  it('arsenal: every weapon, drone and Special licensed and open for upgrades; systems untouched', () => {
    const save = newSave();
    applyCheat(save, CHEATS.arsenal);
    expect(hasCheat(save, 'arsenal')).toBe(true);
    for (const id of UPGRADE_ORDER) {
      const def = UPGRADES[id];
      if (def.group === 'systems') {
        expect(upgradeLevel(save, id), id).toBe(0);
        continue;
      }
      expect(upgradeUnlocked(save, id), id).toBe(true);
      if (id !== 'droneBay') expect(owns(save, id as Parameters<typeof owns>[1]), id).toBe(true);
    }
    expect(upgradeLevel(save, 'droneBay')).toBe(1);
    // Levels above the licence are bought as usual.
    save.credits = 1000;
    expect(buyUpgrade(save, 'tesla')).toBe('bought');
    expect(upgradeLevel(save, 'tesla')).toBe(2);
    // Applying it again changes nothing.
    applyCheat(save, CHEATS.arsenal);
    expect(save.cheats).toEqual(['arsenal']);
    expect(upgradeLevel(save, 'tesla')).toBe(2);
  });

  it('save v4 keeps the cheats; a v3 save migrates with none; junk is dropped', () => {
    const save = newSave();
    applyCheat(save, CHEATS.arsenal);
    const back = loadSave(serializeSave(save), null);
    expect(back.status).toBe('loaded');
    expect(back.save.cheats).toEqual(['arsenal']);
    const v3 = { version: 3, credits: 10, earned: 10, upgrades: { scatter: 2 }, ship: 'spitfire', paints: {}, equip: { primary: 'scatter', secondary: null, drones: [], special: 'nova' }, records: {}, last: null };
    const migrated = loadSave(JSON.stringify(v3), null);
    expect(SAVE_VERSION).toBe(4);
    expect(migrated.status).toBe('migrated');
    expect(migrated.save.cheats).toEqual([]);
    expect(migrated.save.upgrades.scatter).toBe(2);
    const junk = loadSave(JSON.stringify(Object.assign({}, v3, { version: 4, cheats: ['arsenal', 'god', 7, 'arsenal'] })), null);
    expect(junk.save.cheats).toEqual(['arsenal']);
  });
});

describe('settings', () => {
  it('missing or broken values fall back to the defaults', () => {
    expect(parseSettings(null)).toEqual(defaultSettings());
    expect(parseSettings('not json')).toEqual(defaultSettings());
    const s = parseSettings(JSON.stringify({ music: 99, sfx: -3, sensitivity: 9, handedness: 'up', quality: 'ultra', showFps: 'yes' }));
    expect(s.music).toBe(SETTINGS.volumeSteps);
    expect(s.sfx).toBe(0);
    expect(s.sensitivity).toBe(SETTINGS.sensitivity.max);
    expect(s.handedness).toBe('right');
    expect(s.quality).toBe('ultra');
    expect(s.showFps).toBe(false);
  });

  it('graphics: the device tier until the player picks one; a stored tier wins, a stored AUTO (before stage 6) does not', () => {
    expect(defaultSettings().quality).toBe('ultra');
    expect(defaultSettings('mobile').quality).toBe('medium');
    expect(parseSettings(null, 'mobile').quality).toBe('medium');
    expect(parseSettings(JSON.stringify({ music: 3 }), 'mobile').quality).toBe('medium');
    expect(parseSettings(JSON.stringify({ quality: 'low' }), 'mobile').quality).toBe('low');
    expect(parseSettings(JSON.stringify({ quality: 'auto' }), 'mobile').quality).toBe('medium');
  });

  it('steps: volumes and sensitivity stop at their ends, choices wrap', () => {
    let s = defaultSettings();
    for (let i = 0; i < 20; i++) s = stepSetting(s, 'music', 1);
    expect(s.music).toBe(SETTINGS.volumeSteps);
    for (let i = 0; i < 20; i++) s = stepSetting(s, 'sensitivity', -1);
    expect(s.sensitivity).toBe(SETTINGS.sensitivity.min);
    expect(stepSetting(s, 'sensitivity', 1).sensitivity).toBe(0.7);
    expect(stepSetting(s, 'handedness', 1).handedness).toBe('left');
    const q = qualityChoices();
    expect(q[0]).toBe('ultra');
    expect(q).not.toContain('auto');
    expect(stepSetting(s, 'quality', -1).quality).toBe(q[q.length - 1]);
    expect(stepSetting(s, 'showFps', 1).showFps).toBe(true);
    // The original is left alone.
    expect(defaultSettings().music).toBe(SETTINGS.defaults.music);
  });

  it('volume gain: silent at 0, full at the top, quieter than linear between', () => {
    expect(volumeGain(0)).toBe(0);
    expect(volumeGain(SETTINGS.volumeSteps)).toBe(1);
    expect(volumeGain(5)).toBeLessThan(0.5);
  });
});

describe('audio data', () => {
  it('every effect variant and music track has its file', () => {
    for (const id of Object.keys(SFX) as SfxId[]) {
      for (let i = 0; i < SFX[id].variants; i++) expect(audioFile(sfxPath(id, i)), `${id} ${i}`).not.toBeNull();
      expect(audioFile(sfxPath(id, SFX[id].variants)), `${id}: more files than variants`).toBeNull();
      expect(SFX[id].volume, id).toBeGreaterThan(0);
      expect(SFX[id].volume, id).toBeLessThanOrEqual(1);
    }
    for (const id of Object.keys(MUSIC) as MusicId[]) {
      expect(audioFile(musicPath(id)), id).not.toBeNull();
      const next = MUSIC[id].next;
      if (next) expect(MUSIC[id].loop, `${id} has a next track, so it must end`).toBe(false);
    }
  });

  it('missions name a looping track; every weapon and pickup has a sound', () => {
    for (const m of Object.values(MISSIONS)) expect(MUSIC[m.music].loop, m.id).toBe(true);
    for (const id of Object.values(WEAPON_SFX)) expect(SFX[id]).toBeDefined();
    for (const id of Object.values(PICKUP_SFX)) expect(SFX[id]).toBeDefined();
  });
});

describe('hangar unlocks', () => {
  it('ships open with Sector 1 progress while it is the only sector: Executioner for mission 1-3, Striker for 12 medals', () => {
    const r: RecordMap = {};
    expect(unlockHint(r, SHIPS.executioner.unlock!)).toBe('CLEAR MISSION 1-3');
    expect(unlockHint(r, SHIPS.striker.unlock!)).toBe('EARN 12 MEDALS  ·  0 / 12');
    applyRun(r, 's1m3', 'normal', { complete: true, score: 1, medals: 0, killRate: 1 });
    expect(shipUnlocked(r, SHIPS.executioner)).toBe(true);
    expect(shipUnlocked(r, SHIPS.striker)).toBe(false);
    for (const m of ['s1m1', 's1m2', 's1m3'] as const) applyRun(r, m, 'normal', { complete: true, score: 1, medals: 15, killRate: 1 });
    expect(unlockHint(r, SHIPS.striker.unlock!)).toBe('EARN 12 MEDALS  ·  12 / 12');
    expect(shipUnlocked(r, SHIPS.striker)).toBe(true);
  });

  it('a run reports what it opened: compare the open list before and after', () => {
    const r: RecordMap = {};
    const before = openHangarItems(r);
    expect(before).toEqual([]);
    applyRun(r, 's1m3', 'normal', { complete: true, score: 1, medals: 0, killRate: 1 });
    const opened = openHangarItems(r).filter((n) => before.indexOf(n) < 0);
    expect(opened).toContain(SHIPS.executioner.name);
    expect(opened).toContain(UPGRADES.ion.name);
    expect(opened).not.toContain(SHIPS.striker.name);
  });
});

describe('gun sounds setting', () => {
  it('off by default, toggled by a step, kept when stored', () => {
    expect(defaultSettings().gunSounds).toBe(false);
    const on = stepSetting(defaultSettings(), 'gunSounds', 1);
    expect(on.gunSounds).toBe(true);
    expect(parseSettings(JSON.stringify(on)).gunSounds).toBe(true);
    expect(parseSettings(JSON.stringify({ gunSounds: 'yes' })).gunSounds).toBe(false);
  });
});
