---
name: add-mission
description: Build or edit a Space Flight mission timeline in data — waves, formations, paths, set pieces with turrets, waitClear holds, power-up waves and the boss — then play it through. Use when asked «добавь миссию», «сделай s1m2», «поправь волны», «перестрой таймлайн», «добавь станцию в миссию», «миссия слишком лёгкая/сложная».
---

# Add mission

A mission is a `MissionDef` in `data/missions.ts`: title, sector subtitle, `scrollSpeed` (background), `groundSpeed` (set pieces), and a **sorted** list of timed events. `core/LevelTimeline.ts` plays it; `game/MissionDirector.ts` runs intro → combat → outro → results.

## Timeline rules

- Times are seconds of the **mission clock**, which starts after the intro and **stops** while a `waitClear` waits for the field to empty or a boss is announced/alive. Events after a hold stay relative to its end.
- Staggered members (`stagger`) run on real time, so they keep coming during a hold.
- `?t=<sec>` seeks the clock (skips the intro and everything before, holds included).

## Event types (`data/types.ts`)

| Event | Fields | Notes |
|---|---|---|
| `spawn` | `enemy`, `formation` (`single`, `line`, `v`, `column`, `trail`), `x`, optional `move` (e.g. `PATHS.swoop`), `mirror`, `stagger`, `bonus`, `minDifficulty` | `trail` needs `stagger` (members follow one path one after another). `bonus` drops a pickup where the last member dies — only if the whole group was destroyed. Use helpers `single`, `line(n, gap)`, `v(n)`, `column(n)`, `trail(n)` |
| `setPiece` | `piece` (`data/setPieces.ts`), `x` | Ground structure with turrets; scrolls at `groundSpeed` |
| `waitClear` | optional `timeout` | Use between sections; always give a timeout so a dodging enemy can't stall the mission |
| `boss` | `enemy`, `x` | WARNING banner (`BOSS_WARNING_TIME`), HP bar, the clock holds until it dies. Last event of the mission |
| `decor` | `field` (`data/decor.ts`: `asteroidField`, `denseField`, `debris`), `duration` | Background rocks drift far below the flight plane for `duration` seconds. Purely visual: use it to sell an asteroid belt section |

New flight paths go to `data/paths.ts` (≤ 8 points; x within ±1.6, depth −0.5…1.6).

Set pieces (`data/setPieces.ts`): `outpost`, `relay`, `refinery` (mining platform), `depot` (fuel spine), `bastion` (fortress with 4 guns). Each may launch **escape pods** (`pods: { count, x, z }`) once all its turrets are destroyed — that's what the Rescuer medal counts. A new piece: modules are `station_*` props (`npm run build:props`), turrets stand on flat platforms.

## Pacing (GDD §11, s1m1 as reference)

- 3–4 minutes including the boss; sections of 25–35 s split by `waitClear`.
- Introduce one new thing per section; mix air waves with a set piece or an asteroid drift.
- At least 3 `bonus: 'power'` waves (validated) so Power IV is reachable; one `energy`/`shield` bonus mid-mission.
- Every mission offers escape pods (validated): 2–4 set pieces with turrets. Give the player time to clear a station's guns before it scrolls off — don't stack heavy air waves on top of a station's entry.
- Keep pressure readable: no more than ~2 shooters plus a formation at once on Normal; Hard adds Scout fire and density automatically.

## Verify

1. Add the id to `MissionId` (`data/types.ts`), the def to `MISSIONS`, the id to `MISSION_ORDER` (NEXT and CONTINUE follow it) and to its sector's `missions` in `data/campaign.ts` (the campaign page lists them; the last mission of a sector is its boss mission, which opens the next sector and the ship unlocked by it). A new sector: fill its `missions`, it stops being "coming soon".
2. `npm test` — validation checks sorting, references, trail stagger, Power bonuses, boss at the end, preloading.
3. Play it: `http://localhost:7456/?mission=<id>&debug=1&seed=7`. Full run fast: `&god=1&slowmo=4` with the autopilot snippet from the `playtest` skill; check the results screen (medals, pods N/N). Then a real run on Normal without god mode, and `&difficulty=hard`.
4. Update `docs/PLAN.md` and, if the mission introduces something, `docs/GDD.md`.
