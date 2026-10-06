// Enemy fire patterns, shared by enemies and bosses. Angles in degrees, speeds in units/s.

import type { EmitterSpec, LaserId, LaserSpec, PatternId } from './types';

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

  // ---- Sector 2: Ice Moons -------------------------------------------------------------------
  /** Spinner: a slow three-arm spiral off the turning saucer. */
  spinnerSpiral: pattern({ speed: 4.3, count: 3, ring: true, aim: false, volleys: 14, volleyInterval: 0.11, spinDeg: 9, cooldown: 2.2, delay: 0.8, densityStep: 1 }),
  /** Spinner from Hard: a ring between the spirals. */
  spinnerRing: pattern({ speed: 3.8, count: 10, ring: true, aim: false, cooldown: 3.6, delay: 2.2, densityStep: 2 }),
  /** Splitter: an aimed pair. */
  splitterShot: pattern({ speed: 6.5, count: 2, gapDeg: 9, cooldown: 2.4, delay: 0.9, densityStep: 1 }),
  /** Mines: a ring when they blow, by the ship or by their fuse. */
  mineBurst: pattern({ speed: 4.2, count: 10, ring: true, aim: false, cooldown: 99, delay: 0, densityStep: 2 }),
  /** Cyclone (s2m1): a four-arm spiral that never stops. */
  cycloneSpiral: pattern({ speed: 4.8, count: 3, ring: true, aim: false, volleys: 20, volleyInterval: 0.13, spinDeg: 9, cooldown: 1.4, delay: 1.2, densityStep: 1 }),
  /** 66%: rings of big orbs. */
  cycloneRing: pattern({ bullet: 'orbLarge', speed: 4.4, count: 12, ring: true, aim: false, volleys: 2, volleyInterval: 0.5, spinDeg: 15, cooldown: 2.8, delay: 0.6, densityStep: 3 }),
  /** 33%: a counter-turning spiral on top of the first (the rings stop). */
  cycloneStorm: pattern({ speed: 4.0, count: 3, ring: true, aim: false, volleys: 22, volleyInterval: 0.16, spinDeg: -11, cooldown: 1.2, delay: 0.4, densityStep: 1 }),
  /** Shatterer (s2m2): layered aimed fans. */
  shattererFan: pattern({ speed: 7, count: 5, gapDeg: 10, volleys: 3, volleyInterval: 0.18, speedStep: 0.7, cooldown: 2.3, delay: 1.2, densityStep: 1 }),
  /** 66%: a wide wall with gaps, sweeping. */
  shattererRain: pattern({ speed: 5, count: 9, gapDeg: 13, aim: false, volleys: 4, volleyInterval: 0.3, spinDeg: 5, cooldown: 2.6, delay: 0.8, densityStep: 2 }),
  /** 33%: spinning rings. */
  shattererRings: pattern({ speed: 4.6, count: 14, ring: true, aim: false, volleys: 3, volleyInterval: 0.35, spinDeg: 9, cooldown: 2.2, delay: 0.4, densityStep: 3 }),
  /** Hive Mother: aimed fans in layers. */
  hiveFan: pattern({ speed: 6.8, count: 5, gapDeg: 12, volleys: 3, volleyInterval: 0.2, speedStep: 0.8, cooldown: 2.6, delay: 1.6, densityStep: 1 }),
  /** 66%: rings of big orbs. */
  hiveRing: pattern({ bullet: 'orbLarge', speed: 4.5, count: 14, ring: true, aim: false, volleys: 2, volleyInterval: 0.45, spinDeg: 12, cooldown: 3.0, delay: 0.8, densityStep: 3 }),
  /** 33%: a six-arm spiral. */
  hiveSpiral: pattern({ speed: 5, count: 6, ring: true, aim: false, volleys: 28, volleyInterval: 0.09, spinDeg: 7, cooldown: 1.6, delay: 0.4, densityStep: 1 }),

  // ---- Sector 3: Nebula Drift ----------------------------------------------------------------
  /** Carrier: aimed fans from the hull while it launches Scouts. */
  carrierGuns: pattern({ speed: 6.5, count: 3, gapDeg: 14, cooldown: 2.6, delay: 1.0, densityStep: 1 }),
  /** Lancer from Hard: a single aimed shot between beams. */
  lancerShot: pattern({ speed: 7, cooldown: 2.9, delay: 1.8 }),
  /** Arbiter (s3m1): aimed fans between the beams. */
  arbiterFan: pattern({ speed: 7.2, count: 5, gapDeg: 11, volleys: 2, volleyInterval: 0.2, cooldown: 2.4, delay: 1.4, densityStep: 1 }),
  /** 33%: a ring. */
  arbiterRing: pattern({ speed: 4.6, count: 16, ring: true, aim: false, volleys: 2, volleyInterval: 0.4, spinDeg: 11, cooldown: 2.4, delay: 0.6, densityStep: 3 }),
  /** Broodship (s3m2): a sweeping broadside. */
  broodBroadside: pattern({ speed: 5.2, count: 7, gapDeg: 16, aim: false, volleys: 3, volleyInterval: 0.32, spinDeg: 6, cooldown: 2.9, delay: 1.4, densityStep: 2 }),
  /** 66%: a fast aimed stream. */
  broodLance: pattern({ speed: 9.5, count: 1, volleys: 8, volleyInterval: 0.08, cooldown: 2.5, delay: 0.6, densityStep: 1, gapDeg: 6 }),
  /** 33%: rings of big orbs. */
  broodBarrage: pattern({ bullet: 'orbLarge', speed: 4.6, count: 14, ring: true, aim: false, volleys: 3, volleyInterval: 0.36, spinDeg: 8, cooldown: 2.6, delay: 0.5, densityStep: 3 }),
  /** Leviathan segments: an aimed shot now and then, spread over the body by their delays. */
  segmentShot: pattern({ speed: 6.5, cooldown: 3.2, delay: 1.5 }),
  /** Segments from Hard: small rings. */
  segmentRing: pattern({ speed: 4, count: 6, ring: true, aim: false, cooldown: 4.5, delay: 3, densityStep: 2 }),
  /** Leviathan head: aimed fans. */
  leviathanFan: pattern({ speed: 7, count: 5, gapDeg: 10, volleys: 3, volleyInterval: 0.16, speedStep: 0.6, cooldown: 2.5, delay: 1.5, densityStep: 1 }),
  /** 66%: rings of big orbs. */
  leviathanRings: pattern({ bullet: 'orbLarge', speed: 4.4, count: 12, ring: true, aim: false, volleys: 3, volleyInterval: 0.4, spinDeg: 10, cooldown: 2.8, delay: 0.6, densityStep: 3 }),
  /** 33%: a five-arm spiral. */
  leviathanSpiral: pattern({ speed: 5, count: 5, ring: true, aim: false, volleys: 30, volleyInterval: 0.09, spinDeg: 10, cooldown: 1.6, delay: 0.4, densityStep: 1 }),
};

/** Enemy lasers (game/LaserSystem.ts). Warnings stay the same on every difficulty: they are the tell. */
export const LASERS: Record<LaserId, LaserSpec> = {
  /** Lancer: a sniper beam at the ship. */
  lancerBeam: { warn: 1.0, fire: 0.45, width: 0.42, length: 30, count: 1, gapDeg: 0, aim: true, angleDeg: 0, sweepDeg: 0, cooldown: 2.4, delay: 0.7 },
  /** Arbiter: a heavier beam, then two (66%), then a sweep (33%). */
  arbiterBeam: { warn: 1.1, fire: 0.6, width: 0.6, length: 30, count: 1, gapDeg: 0, aim: true, angleDeg: 0, sweepDeg: 0, cooldown: 2.2, delay: 1.2 },
  arbiterTwin: { warn: 1.1, fire: 0.6, width: 0.5, length: 30, count: 2, gapDeg: 22, aim: true, angleDeg: 0, sweepDeg: 0, cooldown: 2.4, delay: 0.8 },
  arbiterSweep: { warn: 1.2, fire: 1.4, width: 0.55, length: 30, count: 1, gapDeg: 0, aim: true, angleDeg: 0, sweepDeg: 26, cooldown: 2.8, delay: 1.0 },
  /** Leviathan: the head charges a wide beam at the ship, later sweeping it. */
  leviathanBeam: { warn: 1.3, fire: 0.8, width: 0.85, length: 32, count: 1, gapDeg: 0, aim: true, angleDeg: 0, sweepDeg: 0, cooldown: 3.0, delay: 2.0 },
  leviathanSweep: { warn: 1.3, fire: 1.6, width: 0.75, length: 32, count: 1, gapDeg: 0, aim: true, angleDeg: 0, sweepDeg: 30, cooldown: 2.8, delay: 1.0 },
};
