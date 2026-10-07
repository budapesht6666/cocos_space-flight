// What youtube/capture.mjs films: one clip per segment, 1080×1920 at 60 fps of game time.
//
// Each game segment opens a mission straight from the URL (practice flags: god mode, Power IV,
// a loadout) and flies an autopilot: `hunt` keeps under the lowest enemy, `boss` under the boss.
//   warm      game frames to run before filming (the scene's fade-in, the wave arriving);
//   ff        fast-forward until a condition: `boss` — the boss is on screen (+ `after` frames),
//             `bossLow` — the boss is out of armour and below `below` of its HP,
//             `kill` — `before` frames ahead of the boss's death (found in a first pass);
//   frames    frames to film (the most, with `afterKill`);
//   afterKill stop this many frames after the boss dies;
//   special   frames (from the start of filming) to fire the Special on.
// The `menu` segment films the title screen's turntable instead.

const PRACTICE = 'god=1&power=4&quality=ultra&seed=7';

export const SEGMENTS = [
  {
    id: 'ice',
    note: 'Ice Moons: a wave torn apart by Scatter + Swarm, Nova Bomb at 1 s',
    mission: 's2m1',
    flags: `t=21&${PRACTICE}&primary=scatter&secondary=swarm&drones=gunDrone,guardian`,
    pilot: 'hunt',
    warm: 120,
    frames: 480,
    special: [60],
  },
  {
    id: 'ion',
    note: 'Nebula Drift: Ion Laser and Wing Cannons cut a wing apart',
    mission: 's3m1',
    flags: `t=43&${PRACTICE}&primary=ion&secondary=wing&drones=gunDrone,guardian`,
    pilot: 'hunt',
    warm: 120,
    frames: 420,
  },
  {
    id: 'hive',
    note: 'Ice Moons boss: the Hive Mother arrives and opens fire',
    mission: 's2m3',
    flags: `t=110.5&${PRACTICE}&primary=plasma&secondary=swarm&drones=gunDrone,collector`,
    pilot: 'boss',
    warm: 30,
    ff: { until: 'boss', after: 150, max: 1800 },
    frames: 360,
  },
  {
    id: 'warden-kill',
    note: 'Outer Ring boss: the Warden goes down — chain blasts, hitstop, slow motion, MISSION COMPLETE',
    mission: 's1m3',
    flags: `t=117.5&${PRACTICE}&level=5&primary=pulse&secondary=rail&drones=gunDrone,guardian`,
    pilot: 'boss',
    warm: 30,
    ff: { until: 'kill', before: 90, max: 9000 },
    frames: 900,
    afterKill: 240,
  },
  {
    id: 'leviathan',
    note: 'Nebula Drift boss: the Leviathan serpent, its laser and bullet curtains',
    mission: 's3m3',
    flags: `t=109.5&${PRACTICE}&primary=tesla&secondary=wing&drones=guardian,gunDrone`,
    pilot: 'boss',
    warm: 30,
    ff: { until: 'boss', after: 240, max: 1800 },
    frames: 420,
  },
  {
    id: 'leviathan-kill',
    note: 'The Leviathan dies: last hits on the exposed head, chain blasts, slow motion',
    mission: 's3m3',
    flags: `t=109.5&${PRACTICE}&level=5&primary=tesla&secondary=rail&drones=guardian,gunDrone`,
    pilot: 'boss',
    warm: 30,
    ff: { until: 'kill', before: 120, max: 12000 },
    frames: 900,
    afterKill: 240,
  },
  {
    id: 'title',
    note: 'Title screen: logo, the Spitfire on its turntable, TAP TO START',
    menu: true,
    warm: 60,
    frames: 300,
  },
];
