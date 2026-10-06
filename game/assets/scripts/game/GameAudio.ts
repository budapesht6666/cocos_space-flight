// The mission's sound: effects for what happens on the event bus, the Ion Laser's beam loop (the
// ship's guns only with the GUN SOUNDS setting: rapid fire drowned the fight), and
// the music — a start jingle into the mission's track, the boss theme from the WARNING on, the
// win jingle on MISSION COMPLETE, a fade-out on defeat. Playback is services/AudioService.ts.

import { DRONE_SFX, PICKUP_SFX, SPECIAL_SFX, WEAPON_SFX } from '../data/audio';
import type { DroneId, MissionDef, SfxId, WeaponId } from '../data/types';
import { AudioService } from '../services/AudioService';
import { SettingsService } from '../services/SettingsService';
import type { GameContext } from './GameContext';
import type { WeaponSystem } from './WeaponSystem';

const EXPLOSION_SFX: Record<'small' | 'medium' | 'large', SfxId> = {
  small: 'explodeSmall',
  medium: 'explodeMedium',
  large: 'explodeLarge',
};

function shotSfx(source: WeaponId | DroneId): SfxId | undefined {
  return (WEAPON_SFX as Partial<Record<string, SfxId>>)[source] ?? DRONE_SFX[source as DroneId];
}

export class GameAudio {
  /** The GUN SOUNDS setting, read once: settings change only in the menu. */
  private readonly guns = SettingsService.current.gunSounds;

  constructor(
    ctx: GameContext,
    private readonly mission: MissionDef,
    private readonly weapons: WeaponSystem,
  ) {
    AudioService.preload(mission.music);
    AudioService.preload('jingleStart');
    if (mission.events.some((e) => e.type === 'boss')) {
      AudioService.preload('bossIntro');
      AudioService.preload('boss');
    }
    AudioService.preload('jingleWin');

    const bus = ctx.bus;
    if (this.guns) {
      bus.on('shot', (e) => {
        const id = shotSfx(e.source);
        if (id) AudioService.play(id);
      });
    }
    bus.on('enemyHit', (e) => AudioService.play(e.armored ? 'hitArmored' : 'hit'));
    bus.on('enemyKilled', (e) => AudioService.play(e.boss ? 'explodeLarge' : e.part ? 'explodeMedium' : EXPLOSION_SFX[e.def.explosion]));
    bus.on('enemyShieldBroken', () => AudioService.play('enemyShieldBroken'));
    bus.on('armorBroken', () => AudioService.play('armorBroken'));
    bus.on('playerHit', () => AudioService.play('playerHit'));
    bus.on('shieldHit', (e) => AudioService.play(e.shield === 0 ? 'shieldDown' : 'shieldHit'));
    bus.on('playerDied', () => {
      AudioService.play('playerDied');
      AudioService.stopMusic();
    });
    bus.on('graze', () => AudioService.play('graze'));
    bus.on('pickupCollected', (e) => AudioService.play(PICKUP_SFX[e.kind]));
    bus.on('novaBomb', () => AudioService.play('nova'));
    bus.on('special', (e) => AudioService.play(SPECIAL_SFX[e.def.id]));
    bus.on('blast', () => AudioService.play('blast'));
    bus.on('bulletBlocked', () => AudioService.play('blocked'));
    bus.on('podsLaunched', () => AudioService.play('podsLaunched'));
    bus.on('podLost', () => AudioService.play('podLost'));
    bus.on('banner', (e) => {
      if (e.style === 'warning') {
        AudioService.play('warning');
        AudioService.music('bossIntro');
      } else if (e.style === 'success') {
        AudioService.music('jingleWin');
      }
    });
  }

  /** The mission (re)starts; `seek` > 0 jumps in without the intro. */
  start(seek: number): void {
    if (seek > 0) AudioService.music(this.mission.music);
    else AudioService.music('jingleStart', this.mission.music);
  }

  /** Per frame; `over`: the results screen is up. */
  tick(paused: boolean, over: boolean): void {
    AudioService.loop('ion', this.guns && this.weapons.beamOn && !paused && !over);
    AudioService.duck(paused);
  }

  /** The results screen: after a defeat the menu theme comes back (a win's jingle leads into it). */
  results(complete: boolean): void {
    AudioService.loop('ion', false);
    if (!complete) AudioService.music('menu');
  }

  /** Leaving the scene. */
  stop(): void {
    AudioService.loop('ion', false);
    AudioService.duck(false);
  }
}
