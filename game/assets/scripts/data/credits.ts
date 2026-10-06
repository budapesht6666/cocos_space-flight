// The in-game Credits page (docs/ASSETS.md «Credits» is the full record with links and file lists).
// CC0 needs no credit, but the authors deserve it; OFL and CC-BY require it.

export interface CreditLine {
  /** What it is in the game. */
  what: string;
  author: string;
  /** The pack or product. */
  source: string;
  /** Empty when there is nothing to name. */
  license: string;
}

export const CREDITS: readonly CreditLine[] = [
  { what: 'SHIPS AND PICKUPS', author: 'Quaternius', source: 'Ultimate Spaceships · Ultimate Space Kit', license: 'CC0' },
  { what: 'STATIONS, TURRETS, DRONES', author: 'Kenney', source: 'Space Kit', license: 'CC0' },
  { what: 'MUSIC', author: 'SketchyLogic', source: 'NES Shooter Music', license: 'CC0' },
  { what: 'SOUND EFFECTS', author: 'Kenney', source: 'Sci-fi · Impact · Interface Sounds', license: 'CC0' },
  { what: 'FONT', author: 'Matt McInerney', source: 'Orbitron', license: 'SIL OFL 1.1' },
  { what: 'MADE WITH', author: 'Cocos Creator 3.8', source: '', license: '' },
];
