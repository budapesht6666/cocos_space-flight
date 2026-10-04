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

New flight paths go to `data/paths.ts` (≤ 8 points; x within ±1.6, depth −0.5…1.6).

## Pacing (GDD §11, s1m1 as reference)

- 3–4 minutes including the boss; sections of 25–35 s split by `waitClear`.
- Introduce one new thing per section; mix air waves with a set piece or an asteroid drift.
- At least 3 `bonus: 'power'` waves (validated) so Power IV is reachable; one `energy`/`shield` bonus mid-mission.
- Keep pressure readable: no more than ~2 shooters plus a formation at once on Normal; Hard adds Scout fire and density automatically.

## Verify

1. Add the id to `MissionId` (`data/types.ts`) and the def to `MISSIONS`.
2. `npm test` — validation checks sorting, references, trail stagger, Power bonuses, boss at the end, preloading.
3. Play it: `http://localhost:7456/?mission=<id>&debug=1&seed=7`. Full run fast: `&god=1&slowmo=4` with the autopilot snippet from the `playtest` skill; check the results screen. Then a real run on Normal without god mode.
4. Update `docs/PLAN.md` and, if the mission introduces something, `docs/GDD.md`.
