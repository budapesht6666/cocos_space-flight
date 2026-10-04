---
name: add-enemy
description: Add a new enemy type (or a fire pattern, flight path or boss) to Space Flight purely through data — EnemyDef, MoveSpec, EmitterSpec, drops — and check it in the game. Use when asked «добавь врага», «новый враг», «сделай мини-босса», «новый паттерн пуль», «пусть враг стреляет кольцом», «новая траектория».
---

# Add enemy

Enemies are data. Behaviour code is shared (`core/motion.ts`, `core/emitter.ts`, `game/EnemySystem.ts`); a new enemy should need **no new code**. If it truly needs a new movement kind or look, that is a code change in `core/` with tests — do it deliberately, not as part of "just adding an enemy".

Coordinates in content: x in half-widths of the field (-1 left edge … 1 right edge), depth as a fraction of the visible height (0 top … 1 bottom, negative = above the screen). Angles: degrees, 0 = up the screen, positive = to the right; aimed shots start from the direction to the player.

## 1. Pick the parts (GDD §9)

| Part | Where | Options |
|---|---|---|
| Look | `EnemyDef.look` | `model` (ship glb with its own texture, `tools/assets/build-ships.mjs`), `prop` (vertex-coloured prop from `tools/assets/build-props.mjs`; `aim` names the child node that turns towards the player, e.g. turret `head`), `rock` (procedural asteroid) |
| Movement | `EnemyDef.move` (`data/types.ts` → `MoveSpec`) | `straight`, `sine`, `dive` (aim then ram), `path` (Catmull-Rom through points, `data/paths.ts`), `hover` (enter, sway, leave; `time: Infinity` for bosses), `drift` (asteroids), `ground` (on set pieces) |
| Attacks | `EnemyDef.attacks[]` → `data/patterns.ts` | Emitter fields: `count`, `gapDeg` (fan) or `ring`, `aim`, `angleDeg`, `spinDeg` (spiral), `volleys` + `volleyInterval` (burst), `cooldown`, `delay`, `densityStep` (difficulty), `speedStep`. Gate with `minDifficulty`; boss phases with `hpBelow` / `hpAbove` |
| Drops | `EnemyDef.drops` | credits, big credits, optional `extra` pickup with chance |
| Flags | | `ground` (set-piece target, can't be rammed), `obstacle` (not counted in kill rate), `split` (fragments must use `drift`) |

Enemy bullets look: `ENEMY_BULLETS` in `data/weapons.ts` (pink-orange with a white core — keep enemy fire readable). Enemies use **Red/Purple** models only (GDD §6).

## 2. Add the data

1. Add the id to the `EnemyId` union in `data/types.ts` (and `PatternId` for a new pattern).
2. Add the `EnemyDef` to `ENEMIES` in `data/enemies.ts`; a new pattern goes to `PATTERNS` via `pattern({...})`.
3. Reference it from a mission (`data/missions.ts`) — spawn event, set-piece turret (`data/setPieces.ts`) or a `boss` event. Pools are sized automatically (`core/missionNeeds.ts`).
4. Budgets: enemy ≤ 3.5k triangles, heavy ≤ 9k (max 2 on screen), boss ≤ 10k; ≤ 500 enemy bullets total.

## 3. Verify

1. `npm test` — `tests/data/validation.test.ts` checks references, paths, patterns, splits and preloading. Add a case there if the new enemy introduces a new kind of rule.
2. `npm run typecheck`.
3. Playtest (skill `playtest`): jump to its spawn with `?t=<seconds before>&god=1&seed=7`, `?slowmo=0.25` to read the pattern, `?difficulty=hard` for gated attacks. Check the hit flash, death explosion, drops, console errors, draw calls in `?debug=1`.
4. Record it in GDD §9 if it's a new role; update the PLAN checklist.
