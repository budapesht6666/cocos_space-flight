---
name: add-weapon
description: Add or retune a player weapon, drone or Special in Space Flight — Primary/Secondary Power I–IV forms, fire rate, damage, range, pierce, splash, homing, beams, chain lightning, bolt looks, hangar price and unlock — through data, check it against the balance table and in game. Use when asked «добавь оружие», «новое оружие», «поправь Pulse Cannon», «сделай Scatter Gun сильнее», «настрой Power», «новый дрон», «новая спецспособность», «перебалансируй оружие».
---

# Add weapon (arsenal)

The arsenal is data (stage 5): combat in `data/weapons.ts`, hangar name / price / unlock in `data/economy.ts`, behaviour shared by kind in `game/WeaponSystem.ts` (guns), `game/DroneSystem.ts` (drones), `game/PlayerSystem.ts` (Specials). Math is engine-free in `core/arsenal.ts`; the balance table is `core/balance.ts` → `npm run balance` → `docs/BALANCE.md`. GDD §7, §14.

## What data alone can do

`WeaponDef` (`data/types.ts`) has three kinds:

- **`bolts`** — projectiles. Per Power form (`forms[0..3]`): `streams` (`x` across, `z` back from the nose, `angleDeg` from straight up — 180 shoots backwards), `damage` and `scale` multipliers, `splash` radius. Per weapon: `interval`, `burst { count, gap }`, `speed`, `damage`, `radius`, `life` + `falloff` (range, damage drop), `pierce` (enemies per bolt), `splashDamage` (fraction to neighbours), `homing { turnRate, delay }`, `jitterDeg`, `armorPierce`, and `bolt` — a look in `BOLTS` (size, colour, glow, round, pool). Covers Pulse, Scatter, Seeker, Plasma and all Secondaries.
- **`beam`** — a continuous beam from the nose to the top of the screen: `dps`, `armorPierce`, `color`, per form `width`, `damage`, optional angled `side` beams.
- **`chain`** — lightning: `interval`, `damage`, `decay` per jump, `range` (to the target's edge), `jump`, per form `targets` and `damage`.

Drones (`DRONES`): `gun` (share of the Primary's peak DPS), `guardian` (orbit, block radius, recharge), `collector` (reach, speed); levels 1–3. Specials (`SPECIALS`): `nova`, `overdrive`, `phase`, `warp` with times and strengths; `label` ≤ 5 letters (the HUD button).

Player shots stay in the cool family (blue, cyan, teal, violet, white): pink and orange are enemy bullets.

## What needs code

A new behaviour no field covers (e.g. a bouncing shot, a mine layer, a drone that shoots homing missiles): add a field or kind to the type, the engine-free math to `core/arsenal.ts` with a Vitest test, the behaviour in the system, and the same rule in `core/balance.ts` so the table stays honest. Keep everything pooled and allocation-free per step; one look = one instanced material.

## Steps

1. **Ids:** add to `PrimaryId` / `SecondaryId` / `DroneId` / `SpecialId` in `data/types.ts`; for a new projectile look, a `BoltId` and its `BOLTS` entry (pool = peak alive at level 5, Power IV, Overdrive).
2. **Combat data** in `data/weapons.ts`.
3. **Hangar** in `data/economy.ts`: an `UPGRADES` entry (helpers `gun()`, `drone()`, `special()` — values start at 0 = not owned, first cost = licence) with `unlock` (`{ mission }` or `{ medals }`), and its id in `UPGRADE_ORDER` within its slot's block. The WEAPONS tab lists it by `group`.
4. **Debug flags** pick ids up automatically (`?primary=<id>` etc., `debug/DebugFlags.ts` reads the tables).
5. **Balance:** `npm run balance` and read `docs/BALANCE.md`. `npm test` holds the rules: no Primary is the best in more than half the situations, every weapon has a niche (best or ≥ 85% of the best somewhere), every Primary deals 50–110% of the Pulse Cannon on a boss, Secondaries stay below half of it, Power never makes a weapon weaker. Pulse Cannon is the reference: ~11 DPS at Power I, ~56 at IV (level 1); weapon level 5 ×1.92. HP: Scout 3, Gunship 22, Marauder 520, Warden 950 (armour 25% while its modules live).
6. `npm run typecheck`, `npm test`.
7. **Playtest** (skill `playtest`): `?mission=s1m1&god=1&power=1..4&seed=7&debug=1&primary=<id>` (+ `secondary`, `drones`, `special`, `level`), `?slowmo=0.25` to inspect a pattern, `gw.freeze = 999` for a clean screenshot. Watch draw calls and shots in `?debug=1`; after a full Hard run with the weapon, `s.playerBullets.pools[i].totalCreated` must not have grown. Then the hangar: buy it (`?credits=50000`, unlock with records or `?unlock=1`), equip, LAUNCH.
8. Update GDD §7 (and §14 for prices/unlocks), PLAN.
