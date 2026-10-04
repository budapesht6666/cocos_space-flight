---
name: playtest
description: Run Space Flight and check it visually — open the Cocos preview at iPhone size via Playwright MCP, drive the ship with mouse drags, force game events from the page, take screenshots, read console errors; or capture the editor via the cocos MCP. Use after gameplay or visual changes, before saying a task is done, or when asked to run the game, «запусти», «проверь игру», «сделай скриншот», «плейтест».
---

# Playtest

Goal: see the game running and report what actually happens — no claims without a screenshot or console output.

## 1. Preview must be running

- The Cocos editor must be open with `game/` and the `Game` scene open (preview plays the current scene). Preview server: `http://localhost:7456`.
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
- Tap (restart after game over): `browser_mouse_click_xy` with `delay: 60`.
- Force situations from the page — the live systems are reachable through the `GameWorld` component:
  ```js
  const gw = cc.director.getScene().getChildByName('World').getComponent('GameWorld');
  gw.s.fx.explode(-1.5, -2, 'medium');     // effects
  gw.s.player.damage(1);                     // hits (reset gw.s.player.invulnerable = 0 between hits)
  gw.s.ctx.bus.on('playerHit', e => ...);    // observe events over time
  gw.state, gw.score, gw.s.director.elapsed  // state
  ```
  In page scripts use component class names as strings (`getComponent('cc.MeshRenderer')`) — the page's global `cc` doesn't expose every class.
- Short-lived effects disappear before a screenshot lands — use `?slowmo=0.25`.

## 4. Check

- `browser_console_messages` level `warning`: any error you caused is a failure.
  Known preview-only noise: `[Physics] PhysicsSystem initDefaultMaterial() Failed to load builtinMaterial` (physics module is disabled in the project; the editor's preview engine still pokes it).
- With `?debug=1`: the engine stats panel (FPS, draw calls, instances, triangles) and our label (enemies / bullets / fx, wave time, power). Desktop numbers are a sanity check only — the real target is an iPhone.
- Pixel colours: crop a screenshot with `sharp` (root devDependency) to check colours objectively.

## 5. Report

Short summary in Russian: what was tested, what was seen (key screenshots), console errors, FPS / draw calls, what wasn't verified.
