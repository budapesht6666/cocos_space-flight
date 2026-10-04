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
};
