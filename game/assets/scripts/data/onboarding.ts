// Mission 1-1 teaches as it goes (GDD §19): no tutorial screen, hints over the fight when the
// moment comes. Each has a touch and a keyboard wording; `{special}` is the equipped Special's name.

export type HintId = 'move' | 'fire' | 'power' | 'special';

export const ONBOARDING = {
  hints: {
    move: { touch: 'DRAG ANYWHERE TO MOVE', keys: 'ARROWS OR WASD TO MOVE' },
    fire: { touch: 'YOUR GUNS FIRE ON THEIR OWN', keys: 'YOUR GUNS FIRE ON THEIR OWN' },
    power: { touch: 'GRAB P TO POWER UP', keys: 'GRAB P TO POWER UP' },
    special: { touch: 'TAP {special} WHEN IT GETS HOT', keys: 'SPACE FIRES {special}' },
  } as Record<HintId, { touch: string; keys: string }>,
  /** The move hint stays until the ship has travelled this far (world units) or this long (s). */
  moveDistance: 3,
  moveTimeout: 8,
  /** Seconds the other hints stay up (P and the Special: until used, or this long). */
  hintTime: 3.2,
  /** Pause between two hints, seconds. */
  gap: 1,
  /** The Special hint waits for a charge and at least this many enemy bullets on screen. */
  specialBullets: 6,
};
