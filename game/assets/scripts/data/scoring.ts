// Score and combo tuning (GDD §15).

export const COMBO = {
  /** Kills within this many seconds keep the chain alive. */
  window: 2,
  /** Chain length per multiplier step: ×2 after 4 kills, ×3 after 8... */
  killsPerStep: 4,
  maxMultiplier: 8,
};

export const SCORE = {
  graze: 20,
  /** Per remaining shield unit at the end of a mission. */
  shieldBonus: 500,
  /** Mission clear without hull damage. */
  noDamageBonus: 5000,
};
