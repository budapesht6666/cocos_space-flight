// Weighted random choice. Engine-free.

/** Picks an item with probability proportional to its weight; `roll` is uniform in [0, 1). */
export function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, roll: number): T {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  let r = roll * total;
  for (const item of items) {
    r -= Math.max(0, weight(item));
    if (r < 0) return item;
  }
  return items[items.length - 1];
}
