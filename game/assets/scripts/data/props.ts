// Props built by tools/assets/build-props.mjs (station modules, turrets, pickup icons).

import type { PropId } from './types';

/** resources path of a prop's prefab. */
export function propPath(id: PropId): string {
  return `models/props/${id}/${id}`;
}

/** Station modules are built in pack tiles: one tile is this many world units across. */
export const STATION_TILE = 1.6;
/** Station height squash, so buildings stay below the flight plane seen from the tilted camera. */
export const STATION_HEIGHT = 0.4;
