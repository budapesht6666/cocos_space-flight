// ==UserScript==
// @name         Space Flight — white-hat trainer (own game only)
// @namespace    spaceflight.whitehat
// @version      1.0.0
// @description  Stage 10 proof of concept: shows what a userscript can do to the web build. Reaches the engine through the page's own globals (cc, System). No network access, no GM_* APIs, runs only on the game's own hosts.
// @match        https://spaceflight.p1gog.duckdns.org/*
// @match        http://localhost/*
// @match        http://127.0.0.1/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

// Hotkeys (Alt + key), panel at the bottom-left, Alt+H hides it:
//   G  god mode (no hits, shield full) — silent: the game's own `god` flag stays off, so the run still pays
//   P  hold Power IV          S  keep all Special charges     A  ship follows the nearest enemy
//   K  kill everything on screen                              J  jump the mission clock +25 s
//   F  forge the run: perfect score, all medals, end the mission as complete (records + credits get saved)
//   W  wallet 1,000,000,000 credits, saved       U  open every mission/difficulty/ship/hangar item, saved
//
// How it works and why it works: docs/SECURITY_REPORT.md. Everything here is plain JavaScript running in
// the page next to the game (`@grant none` = the page's own world), which is exactly what the
// "Tamper-style" managers do. The script never leaves the page: no fetch, no XHR, no external @require.

(function () {
  'use strict';

  var HOSTS = ['spaceflight.p1gog.duckdns.org', 'localhost', '127.0.0.1'];
  if (HOSTS.indexOf(location.hostname) < 0) return;
  if (window.__spaceflightTrainer) return;

  var MISSIONS = ['s1m1', 's1m2', 's1m3', 's2m1', 's2m2', 's2m3', 's3m1', 's3m2', 's3m3'];
  var DIFFICULTIES = ['normal', 'hard', 'insane', 'nightmare'];
  var on = { god: false, power: false, specials: false, aim: false };
  var note = 'ready';
  var SaveService = null;

  function mod(name) {
    return System.import('chunks:///_virtual/' + name);
  }

  function systems() {
    var scene = cc.director.getScene();
    var gw = scene && scene.getComponentInChildren('GameWorld');
    return gw && gw.s ? gw.s : null;
  }

  function persist() {
    // setLast() writes the whole in-memory save; keep the pick the player had.
    var last = SaveService.data.last || { mission: 's1m1', difficulty: 'normal' };
    SaveService.setLast(last.mission, last.difficulty);
  }

  var actions = {
    god: function () { on.god = !on.god; return 'god ' + on.god; },
    power: function () { on.power = !on.power; return 'power IV ' + on.power; },
    specials: function () { on.specials = !on.specials; return 'specials ' + on.specials; },
    aim: function () { on.aim = !on.aim; return 'auto-aim ' + on.aim; },

    kill: function () {
      var s = systems();
      if (!s) return 'not in a mission';
      var list = s.enemies.active.slice();
      for (var i = 0; i < list.length; i++) s.enemies.damage(list[i], 1e9, 1);
      return 'hit ' + list.length + ' enemies';
    },

    jump: function () {
      var s = systems();
      if (!s) return 'not in a mission';
      s.mission.timeline.seek(s.mission.timeline.time + 25);
      return 'clock → ' + s.mission.timeline.time.toFixed(0) + ' s';
    },

    forge: function () {
      var s = systems();
      if (!s || s.mission.phase === 'results') return 'not in a fight';
      // The two things the "practice" check looks at (debug.god, debug.t) stay untouched.
      var st = s.score.stats;
      st.score = 2000000000;
      st.credits = 40000;
      st.kills = s.enemies.spawnedTally;
      st.pods = s.mission.podsTotal;
      s.player.vitals.hullLost = 0;
      s.mission.finish(true);
      return 'run forged and finished';
    },

    wallet: function () {
      if (!SaveService) return 'save module not loaded';
      var d = SaveService.data;
      d.credits = 1e9;
      d.earned = Math.max(d.earned, d.credits);
      persist();
      return 'wallet 1,000,000,000 saved';
    },

    unlock: function () {
      if (!SaveService) return 'save module not loaded';
      var records = SaveService.data.records;
      for (var m = 0; m < MISSIONS.length; m++) {
        for (var d = 0; d < DIFFICULTIES.length; d++) {
          var key = MISSIONS[m] + ':' + DIFFICULTIES[d];
          var r = records[key] || (records[key] = { score: 0, medals: 0, killRate: 0, clears: 0 });
          r.score = Math.max(r.score, 1000000);
          r.medals = 15;
          r.killRate = 1;
          r.clears = Math.max(r.clears, 1);
        }
      }
      persist();
      return 'all missions cleared on every difficulty, saved';
    },
  };

  function tick() {
    var s = systems();
    if (!s) return;
    var p = s.player;
    var v = p.vitals;
    if (on.god && p.alive) {
      v.invulnerable = Math.max(v.invulnerable, 1);
      v.shield = v.maxShield;
      v.hull = v.maxHull;
    }
    if (on.power) p.power = 4;
    if (on.specials) {
      v.charges = 9;
      v.energy = 1;
    }
    if (on.aim && p.alive && p.mode === 'control') {
      var best = null;
      var bestD = Infinity;
      var list = s.enemies.active;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.dead || e.parent || e.z > p.z) continue;
        var d = p.z - e.z;
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best) p.x += (best.x - p.x) * 0.25;
    }
  }

  // ---- panel ----------------------------------------------------------------------------------

  var panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483647;padding:6px 8px;border-radius:6px;' +
    'background:rgba(0,0,0,.72);color:#9fe6a0;font:11px/1.35 Consolas,monospace;pointer-events:none;white-space:pre;max-width:46vw';
  document.documentElement.appendChild(panel);

  function flag(b) { return b ? 'ON ' : 'off'; }

  function draw() {
    panel.textContent = 'TRAINER (alt+key)\n' +
      '[G] god ' + flag(on.god) + '  [P] power ' + flag(on.power) + '\n' +
      '[S] specials ' + flag(on.specials) + '  [A] aim ' + flag(on.aim) + '\n' +
      '[K] kill  [J] +25s  [F] forge run\n' +
      '[W] wallet  [U] unlock all  [H] hide\n> ' + note;
  }

  var KEYS = { KeyG: 'god', KeyP: 'power', KeyS: 'specials', KeyA: 'aim', KeyK: 'kill', KeyJ: 'jump', KeyF: 'forge', KeyW: 'wallet', KeyU: 'unlock' };

  function run(name) {
    try {
      note = actions[name]();
    } catch (err) {
      note = name + ' failed: ' + err;
    }
    draw();
    return note;
  }

  window.addEventListener('keydown', function (e) {
    if (!e.altKey) return;
    if (e.code === 'KeyH') {
      panel.style.display = panel.style.display === 'none' ? '' : 'none';
      e.preventDefault();
      return;
    }
    var name = KEYS[e.code];
    if (!name) return;
    // Alt+P / Alt+W / Alt+A / Alt+S are also the game's pause and WASD: don't let them through.
    e.preventDefault();
    e.stopPropagation();
    run(name);
  }, true);

  mod('SaveService.ts').then(function (m) { SaveService = m.SaveService; });
  setInterval(function () {
    try { tick(); } catch (err) { /* the scene is changing */ }
  }, 16);
  draw();

  // For the test harness (tools/security/pentest.mjs): the same actions without keyboard events.
  window.__spaceflightTrainer = { run: run, state: on };
})();
