---
name: add-weapon
description: Add or retune a player weapon in Space Flight — Power I–IV bullet forms, fire rate, damage, bolt look — through data in data/weapons.ts, and check it in game. Use when asked «добавь оружие», «новое оружие», «поправь Pulse Cannon», «сделай Scatter Gun», «настрой Power».
---

# Add weapon

Player weapons live in `data/weapons.ts` as `WeaponDef`; `game/PlayerSystem.ts` fires the current Power form every `fireInterval`. Today only straight bolts exist (Pulse Cannon). GDD §7 lists the arsenal for stage 5.

## What data alone can do

A `WeaponDef` with `powerForms[0..3]` — each form is a list of streams `{ x, angleDeg }` (offset across the ship, angle from straight up). That covers Pulse Cannon variants and **Scatter Gun**-like fans (more streams, wider angles), plus fire rate, bullet speed, damage, hit radius and bolt size/colour (`color` should stay in the cyan-blue family: player shots ≠ enemy shots).

## What needs code (stage 5)

Homing (Seeker Missiles), beams (Ion Laser, Rail Lance), chains (Tesla Arc), area damage (Plasma Orbs), damage falloff with distance, secondary slots with their own cooldowns, drones. Add a `kind` to `WeaponDef` and a small engine-free behaviour in `core/` with Vitest tests first, then wire it into `PlayerSystem`/`BulletSystem`. Keep bullets pooled and instanced: one `BulletLook` (material) per visual, ≤ 1 draw call each.

## Steps

1. Add the id to `WeaponId` (`data/types.ts`) and the def to `data/weapons.ts`.
2. Until the hangar (stage 4) exists, the weapon in use is passed in `GameWorld.boot()` (`PULSE_CANNON`) — switch it there to try a new one.
3. Balance sanity: DPS per Power = streams × damage / fireInterval. Pulse: I ≈ 11, IV ≈ 55. Scouts have 3 HP, Gunships 22, the Marauder 520 (×1.4 on Hard).
4. `npm test` (validation requires 4 Power forms), `npm run typecheck`.
5. Playtest each Power with `?power=1..4&god=1&seed=7`, `?slowmo=0.25` to inspect the pattern; watch draw calls and the bullet count in `?debug=1`.
