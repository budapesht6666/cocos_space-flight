import type { EnemyDef, EnemyId } from './types';

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  scout: {
    id: 'scout',
    model: 'models/ships/bob_red/bob_red',
    size: 1.15,
    hp: 3,
    radius: 0.5,
    score: 100,
    contactDamage: 1,
    move: { kind: 'sine', speed: 4.2, amplitude: 1.3, frequency: 0.45 },
    explosion: 'small',
  },
  dart: {
    id: 'dart',
    model: 'models/ships/dispatcher_red/dispatcher_red',
    size: 1.3,
    hp: 4,
    radius: 0.45,
    score: 150,
    contactDamage: 1,
    move: { kind: 'dive', enterSpeed: 7, holdTime: 0.7, holdDepth: 0.25, diveSpeed: 17 },
    explosion: 'medium',
  },
};
