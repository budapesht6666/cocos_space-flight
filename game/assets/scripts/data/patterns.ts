// Enemy fire patterns, shared by enemies and bosses. Angles in degrees, speeds in units/s.

import type { EmitterSpec, PatternId } from './types';

const BASE: EmitterSpec = {
  bullet: 'orb',
  speed: 7,
  count: 1,
  gapDeg: 0,
  ring: false,
  aim: true,
  angleDeg: 0,
  spinDeg: 0,
  volleys: 1,
  volleyInterval: 0,
  cooldown: 2,
  delay: 0.5,
  densityStep: 0,
  speedStep: 0,
};

function pattern(spec: Partial<EmitterSpec>): EmitterSpec {
  return Object.assign({}, BASE, spec);
}

export const PATTERNS: Record<PatternId, EmitterSpec> = {
  /** Single aimed shot (Scouts from Hard). */
  scoutShot: pattern({ speed: 6.5, cooldown: 2.8, delay: 0.9 }),
  /** Three aimed shots in quick succession (GDD: Gunship). */
  gunshipBurst: pattern({ speed: 8, volleys: 3, volleyInterval: 0.14, cooldown: 1.9, delay: 0.5, gapDeg: 10, densityStep: 1 }),
  turretShot: pattern({ speed: 7, cooldown: 1.7, delay: 0.4 }),
  turretFan: pattern({ speed: 6.5, count: 3, gapDeg: 14, cooldown: 2.4, delay: 0.7, densityStep: 1 }),
  /** Aimed fan in layered volleys. */
  marauderFan: pattern({ speed: 7, count: 5, gapDeg: 11, volleys: 3, volleyInterval: 0.2, speedStep: 0.8, cooldown: 2.4, delay: 1.2, densityStep: 1 }),
  /** Two offset rings of big orbs. */
  marauderRing: pattern({ bullet: 'orbLarge', speed: 5, count: 14, ring: true, aim: false, volleys: 2, volleyInterval: 0.4, spinDeg: 13, cooldown: 3.2, delay: 0.8, densityStep: 4 }),
  /** Rotating four-arm spiral. */
  marauderSpiral: pattern({ speed: 5.5, count: 4, ring: true, aim: false, volleys: 30, volleyInterval: 0.09, spinDeg: 9, cooldown: 2.5, delay: 0.5, densityStep: 1 }),

  /** Volatile elites: one slow ring when they die ("revenge bullets"). */
  volatileRing: pattern({ speed: 3.8, count: 8, ring: true, aim: false, cooldown: 99, delay: 0, densityStep: 2 }),

  /** Dreadnought side guns: aimed fans. */
  dreadnoughtGun: pattern({ speed: 7.5, count: 3, gapDeg: 12, cooldown: 1.9, delay: 1.0, densityStep: 1 }),
  /** Wide sweeping wall with gaps. */
  dreadnoughtBroadside: pattern({ speed: 5.2, count: 7, gapDeg: 16, aim: false, volleys: 3, volleyInterval: 0.32, spinDeg: 6, cooldown: 2.8, delay: 1.4, densityStep: 2 }),
  /** Fast aimed stream (66%). */
  dreadnoughtLance: pattern({ speed: 10, count: 1, gapDeg: 6, volleys: 9, volleyInterval: 0.07, cooldown: 2.3, delay: 0.6, densityStep: 1 }),
  /** Spinning rings of big orbs (33%). */
  dreadnoughtBarrage: pattern({ bullet: 'orbLarge', speed: 4.6, count: 14, ring: true, aim: false, volleys: 3, volleyInterval: 0.36, spinDeg: 8, cooldown: 2.6, delay: 0.5, densityStep: 3 }),

  /** Warden turret pods: aimed bursts of three. */
  wardenPod: pattern({ speed: 7.5, count: 3, gapDeg: 10, volleys: 3, volleyInterval: 0.13, cooldown: 2.1, delay: 1.2, densityStep: 1 }),
  /** Core, phase 1: slow aimed big orbs. */
  wardenAimed: pattern({ bullet: 'orbLarge', speed: 5.4, count: 3, gapDeg: 18, cooldown: 2.3, delay: 1.6, densityStep: 2 }),
  /** Core, phase 2 (66%): rotating rings. */
  wardenRings: pattern({ speed: 4.8, count: 12, ring: true, aim: false, volleys: 4, volleyInterval: 0.45, spinDeg: 7.5, cooldown: 1.9, delay: 0.6, densityStep: 4 }),
  /** Core, phase 2: aimed fan between the rings. */
  wardenFlower: pattern({ speed: 6.5, count: 5, gapDeg: 9, cooldown: 2.9, delay: 1.4, densityStep: 2 }),
  /** Core, phase 3 (33%): desperation spiral. */
  wardenSpiral: pattern({ speed: 5.2, count: 5, ring: true, aim: false, volleys: 36, volleyInterval: 0.08, spinDeg: 11, cooldown: 1.4, delay: 0.4, densityStep: 1 }),
};
