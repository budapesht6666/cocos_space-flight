---
name: playtest
description: Run Space Flight and check it visually — open the Cocos preview at iPhone size via Playwright MCP, drive the ship with mouse drags, force game events from the page, take screenshots, read console errors; or capture the editor via the cocos MCP. Use after gameplay or visual changes, before saying a task is done, or when asked to run the game, «запусти», «проверь игру», «сделай скриншот», «плейтест».
---

# Playtest

Goal: see the game running and report what actually happens — no claims without a screenshot or console output.

## 1. Preview must be running

- The Cocos editor must be open with `game/`. Preview plays the scene **open in the editor**: `Menu` (start screen, the build's first scene) or `Game`. From Menu, any URL with `?mission=` jumps straight into the game once per page load, so gameplay links work with either scene open. Preview server: `http://localhost:7456`.
- After `refresh_assets` or `save_current_scene` the editor **reloads open preview pages by itself** — wait for it (a page evaluate during reload fails with "Execution context was destroyed"; just repeat it).
- If the editor is closed, ask the user to open it — don't claim anything is verified.

## 2. Open at iPhone size

Playwright MCP runs with a 390×844 viewport and `vision` caps (`.mcp.json`).

1. `browser_navigate` to `http://localhost:7456/?debug=1&seed=7` (+ any of `god=1`, `power=1..4`, `t=<sec>`, `slowmo=0.25` — list in CLAUDE.md «Отладка»).
2. The preview page shows the game in a 720-px "Design Resolution" frame that doesn't fit the viewport. Switch to full-page canvas with `browser_evaluate`:
   ```js
   () => new Promise(r => setTimeout(() => { document.querySelector('li[data-device="WebpageFullScreen"]').click(); setTimeout(() => r('ok'), 4000); }, 600))
   ```
   This does not persist — repeat after every navigation/reload.
3. Screenshot to `.playwright-mcp/<name>.png`, then `Read` it to look at it.

## 3. Drive it

- Move: `browser_mouse_drag_xy` (mouse drags arrive as touches; relative drag moves the ship by the same fraction of the screen).
- Tap (play again on the results screen): `browser_mouse_click_xy` with `delay: 60`.
- On-screen buttons (CSS px at 390×844): pause ≈ (357, 53), NOVA ≈ (330, 765); pause panel RESUME ≈ (195, 389), RESTART ≈ (195, 454), MENU ≈ (195, 519); results RETRY ≈ (76, 660), NEXT ≈ (195, 660, only after a win), MENU ≈ (314, 660). Keys: `Space` = Nova Bomb, `Escape`/`P` = pause, `Enter` = tap / RETRY.
- Start screen (no URL flags): tap anywhere → menu; NORMAL ≈ (126, 462), HARD ≈ (264, 462); mission cards 1-1 ≈ (195, 552), 1-2 ≈ (195, 645), 1-3 ≈ (195, 738). Keys: Enter/Space = start, 1–3 = mission, ←/→ = difficulty. The StartScreen component: `cc.director.getScene().getChildByName('World').getComponent('StartScreen')`.
- Press UI buttons from the page without coordinates: `gw.input.pressed.add('retry' | 'next' | 'menu' | 'pause')` (`'menu'` works on the pause and results panels).
- URL flags (CLAUDE.md «Отладка»): `mission=s1m1..s1m3`, `difficulty=hard`, `t=<sec>` (mission clock, skips the intro), `god=1`, `power=1..4`, `seed=7`, `slowmo=0.05..4`, `elite=1` / `elite=volatile`. Runs with cheats are "practice": not recorded. Reset records: `localStorage.removeItem('spaceflight.records')`.
- Force situations from the page — the live systems are reachable through the `GameWorld` component:
  ```js
  const gw = cc.director.getScene().getChildByName('World').getComponent('GameWorld');
  const s = gw.s;
  s.fx.explode(-1.5, -2, 'medium');                  // effects
  s.player.vitals.invulnerable = 0; s.player.hit();   // one hit (shield first, then hull)
  s.pickups.spawn('power', 0, -2);                    // pickups: credit, bigCredit, power, repair, shield, energy
  gw.specialQueued = true;                            // Nova Bomb
  s.ctx.bus.on('shieldHit', e => ...);                // observe events: enemyKilled, playerHit, graze, pickupCollected, novaBomb, banner…
  s.mission.phase, s.mission.timeline.time, s.mission.timeline.holding, s.mission.result (medals mask, pods)
  s.score.stats (pods), s.mission.podsTotal, s.player.vitals, s.enemyBullets.count
  s.enemies.boss, boss.parts, s.enemies.isArmored(boss), e.elite                // bosses, parts, elites
  s.ctx.bus.on('podsLaunched' | 'podLost' | 'armorBroken' | 'enemyShieldBroken', ...)
  gw.freeze = 999;                                    // freeze the simulation (rendering continues) for a clean screenshot
  ```
  In page scripts use component class names as strings (`getComponent('cc.MeshRenderer')`) — the page's global `cc` doesn't expose every class. Wait for `gw.s` before touching it (boot loads models asynchronously).
- **Whole mission in ~40–60 s:** `?god=1&slowmo=4&debug=1` plus an autopilot that flies over escape pods first and otherwise keeps the ship under the lowest enemy, then poll until `s.mission.phase === 'results'` and read `s.mission.result`:
  ```js
  setInterval(() => {
    const p = s.player; if (p.mode !== 'control') return;
    let pod = null;
    for (const k of s.pickups.active) if (k.def.pod && (!pod || k.z > pod.z)) pod = k;
    if (pod) { p.targetX = Math.max(-4, Math.min(4, pod.x)); p.targetZ = pod.z; return; }
    let best = null;
    for (const e of s.enemies.active) if (!e.dead && e.z < p.z - 1 && e.z > s.playfield.topZ && (!best || e.z > best.z)) best = e;
    p.targetX = best ? Math.max(-4, Math.min(4, best.x)) : 0;
    p.targetZ = s.playfield.zAt(0.75);
  }, 50);
  ```
  After `refresh_assets` the editor reloads the page a second or two later: attach the autopilot after that reload, or the evaluate dies with "Execution context was destroyed".
- **Boss timing:** `?t=<boss t>&power=4&god=1` with the autopilot aiming at `boss.parts[0] ?? boss`; wrap `s.mission.tick` to count game time between `armorBroken`, the 66/33% HP marks and the kill.
  Compare enemy pool sizes with `missionNeeds` (`Array.from(s.enemies.pools).map(([id, p]) => id + ':' + p.totalCreated)`): growth means a mid-game `instantiate`.
- Short-lived effects disappear before a screenshot lands — use `?slowmo=0.25` or `gw.freeze = 999`.

## 3b. Release build and the live site

- Build (CLAUDE.md «Команды»), then serve `game/build/web-mobile` with `python -m http.server 8080` and open `http://localhost:8080/` — the first frame can be black while it loads; check again after a few seconds.
- Live: `https://spaceflight.p1gog.duckdns.org/` after `npm run deploy:web`. Check `navigator.serviceWorker.getRegistrations()` and `caches.keys()` (one `spaceflight-<build>` cache).

## 4. Check

- `browser_console_messages` level `warning`: any error you caused is a failure.
  Known preview-only noise: `[Physics] PhysicsSystem initDefaultMaterial() Failed to load builtinMaterial` (physics module is disabled in the project; the editor's preview engine still pokes it).
- With `?debug=1`: the engine stats panel (FPS, draw calls, instances, triangles) and our label (enemies, player/enemy shots, pickups, fx; mission, difficulty, clock, phase/hold, Power). Desktop numbers are a sanity check only — the real target is an iPhone.
- Pixel colours: crop a screenshot with `sharp` (root devDependency) to check colours objectively.

## 5. Report

Short summary in Russian: what was tested, what was seen (key screenshots), console errors, FPS / draw calls, what wasn't verified.
