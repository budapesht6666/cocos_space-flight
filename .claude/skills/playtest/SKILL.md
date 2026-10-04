---
name: playtest
description: Run Space Flight and check it visually — open the Cocos preview (or a web-mobile build) at iPhone size via Playwright MCP, drive the ship with mouse drags, take screenshots, read console errors; or capture the editor Game View via the cocos MCP. Use after gameplay or visual changes, before saying a task is done, or when asked to run the game, «запусти», «проверь игру», «сделай скриншот», «плейтест».
---

# Playtest

Goal: see the game running and report what actually happens — no claims without a screenshot or console output.

## 1. Get a running build

Prefer, in order:

1. **Editor preview** — the Cocos editor is open with `game/`. With the cocos MCP available, start preview in browser mode (`run_project_preview`); otherwise ask the user to press ▶. URL: `http://localhost:7456`.
2. **Web-mobile build** — when the editor is closed and the CLI path is known (CLAUDE.md → «Окружение»):
   build with `--build "configPath=build-configs/web-mobile.json"`, then serve `game/build/web-mobile` with
   `npx http-server game/build/web-mobile -p 8080 -c-1` (run in background), URL `http://localhost:8080`.

If neither is possible, say so and stop — do not report the change as verified.

## 2. Open at iPhone size

Playwright MCP is configured with a 390×844 viewport and `vision` caps (see `.mcp.json`).

- Navigate with debug params so the game lands in the state you need, e.g.
  `http://localhost:7456/?debug=1&god=1&mission=s1m1&t=0` (list of params: CLAUDE.md → «Отладка»).
- Wait ~3 s for the engine to boot, then take a screenshot.

## 3. Drive it

The game is a canvas — use coordinate tools, not the accessibility snapshot:

- Move the ship: `browser_mouse_drag_xy` (e.g. from 195,700 to 100,700, then to 290,650).
- Tap UI / special button: `browser_mouse_click_xy`.
- Take screenshots at the moments that matter (enemies on screen, explosion, HUD, results).

## 4. Check

- Console: read messages, any `error` or uncaught exception is a failure to report.
- FPS / draw calls / entity counts from the `?debug=1` overlay (desktop numbers are only a sanity check — real target is the iPhone).
- For editor-only checks (scene layout, prefab setup) use the cocos MCP screenshot of the Game View instead.

## 5. Report

Short summary in Russian: what was tested, what was seen (attach key screenshots), console errors, FPS, and anything not verified.
Screenshots live in `.playwright-mcp/` (gitignored).
