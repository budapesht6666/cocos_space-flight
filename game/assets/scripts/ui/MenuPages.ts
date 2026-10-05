// Menu pages around the campaign: Main (CONTINUE, CAMPAIGN, HANGAR), Campaign (a sector pager with
// its missions) and Mission (difficulties with medals and records, LAUNCH). The hangar has its own
// file. Layout is in design units (720 wide, at least 1280 tall), anchored to the screen edges.

import { Graphics, KeyCode, Label, Node } from 'cc';
import { hasMedal, medalCount } from '../core/medals';
import { continueTarget, difficultyUnlocked, missionUnlocked, sectorMedals, sectorOf, sectorState, type SectorState } from '../core/progress';
import { CAMPAIGN_DIFFICULTIES, SECTORS } from '../data/campaign';
import { DIFFICULTY_ORDER } from '../data/difficulty';
import { MEDALS } from '../data/medals';
import { MISSIONS } from '../data/missions';
import type { Difficulty, MissionId } from '../data/types';
import { toColor } from '../fx/RenderKit';
import { SaveService } from '../services/SaveService';
import { pageHeader, pageRoot, type MenuHost, type MenuPage } from './MenuPage';
import { drawButton, drawCard, drawChevron, drawLock, drawMedal, onTap, placeLabel, UI, uiLabel, uiNode } from './UiKit';

const CARD_WIDTH = 640;
const LEFT = -CARD_WIDTH / 2 + 26;
const RIGHT = CARD_WIDTH / 2 - 26;

function titleOf(mission: MissionId): string {
  return MISSIONS[mission].title;
}

/** "MISSION 1-2 · HARD" */
export function pickLabel(mission: MissionId, difficulty: Difficulty): string {
  return `${titleOf(mission)}  ·  ${difficulty.toUpperCase()}`;
}

// ---- Main -----------------------------------------------------------------------------------

export class MainPage implements MenuPage {
  readonly root: Node;
  readonly pose = { row: 0.43, scale: 1.05 };
  readonly logo = true;
  private readonly playTitle: Label;
  private readonly playSub: Label;

  constructor(parent: Node, private readonly host: MenuHost) {
    const font = host.font;
    this.root = pageRoot(parent, 'MainPage');
    const play = uiNode(this.root, 'Continue', 560, 128, { bottom: 336, centerX: true });
    drawButton(play.addComponent(Graphics), 560, 128, true);
    this.playTitle = uiLabel(play, 'Title', 38, UI.white, {}, font);
    placeLabel(this.playTitle, 0, 18);
    this.playSub = uiLabel(play, 'Sub', 22, UI.accent, {}, font);
    placeLabel(this.playSub, 0, -28);
    onTap(play, () => host.launch());
    this.button('CAMPAIGN', 216, () => host.open('campaign'));
    this.button('HANGAR', 100, () => host.open('hangar'));
  }

  enter(): void {
    const save = SaveService.data;
    this.host.pick = continueTarget(save.records, save.last);
    this.playTitle.string = save.last ? 'CONTINUE' : 'PLAY';
    this.playSub.string = pickLabel(this.host.pick.mission, this.host.pick.difficulty);
  }

  key(code: KeyCode): boolean {
    if (code === KeyCode.ENTER || code === KeyCode.SPACE) {
      this.host.launch();
      return true;
    }
    // 1–3: the missions of Sector 1.
    const i = code - KeyCode.DIGIT_1;
    const missions = SECTORS[0].missions;
    if (i >= 0 && i < missions.length && (this.host.unlockAll || missionUnlocked(SaveService.records, missions[i]))) {
      this.host.pick.mission = missions[i];
      this.host.open('mission');
      return true;
    }
    return false;
  }

  private button(text: string, bottom: number, fn: () => void): void {
    const node = uiNode(this.root, text, 560, 96, { bottom, centerX: true });
    drawButton(node.addComponent(Graphics), 560, 96, false);
    const label = uiLabel(node, 'Label', 32, UI.white, {}, this.host.font);
    label.string = text;
    placeLabel(label, 0, 0);
    onTap(node, fn);
  }
}

// ---- Campaign: one sector at a time ---------------------------------------------------------

const MISSION_CARD_HEIGHT = 176;
const MISSION_CARD_GAP = 22;
const MISSIONS_TOP = 316;
const DIFF_MEDAL_R = 13;

interface MissionCard {
  node: Node;
  gfx: Graphics;
  title: Label;
  sub: Label;
  medals: Label;
  rows: { name: Label }[];
  icons: Graphics;
  mission: MissionId | null;
}

export class CampaignPage implements MenuPage {
  readonly root: Node;
  readonly pose = null;
  readonly logo = false;
  private index = 0;
  private readonly number: Label;
  private readonly name: Label;
  private readonly medals: Label;
  private readonly stripe: Graphics;
  private readonly prev: Node;
  private readonly next: Node;
  private readonly cards: MissionCard[] = [];
  private readonly closed: Node;
  private readonly closedIcon: Graphics;
  private readonly closedTitle: Label;
  private readonly closedText: Label;

  constructor(parent: Node, private readonly host: MenuHost) {
    const font = host.font;
    this.root = pageRoot(parent, 'CampaignPage');
    pageHeader(this.root, 'CAMPAIGN', host);
    this.number = uiLabel(this.root, 'Number', 24, UI.accent, { top: 140, centerX: true }, font);
    this.name = uiLabel(this.root, 'Name', 44, UI.white, { top: 172, centerX: true }, font);
    this.stripe = uiNode(this.root, 'Stripe', 0, 0, { top: 236, centerX: true }).addComponent(Graphics);
    this.medals = uiLabel(this.root, 'Medals', 22, UI.gold, { top: 252, centerX: true }, font);
    this.prev = this.arrow(-1);
    this.next = this.arrow(1);

    const per = Math.max(...SECTORS.map((s) => s.missions.length), 3);
    for (let i = 0; i < per; i++) {
      const node = uiNode(this.root, `Card${i}`, CARD_WIDTH, MISSION_CARD_HEIGHT, { top: MISSIONS_TOP + i * (MISSION_CARD_HEIGHT + MISSION_CARD_GAP), centerX: true });
      const gfx = node.addComponent(Graphics);
      const title = uiLabel(node, 'Title', 32, UI.white, {}, font);
      placeLabel(title, LEFT, 44, 'left');
      const sub = uiLabel(node, 'Sub', 22, UI.accent, {}, font);
      placeLabel(sub, LEFT, 4, 'left');
      const medals = uiLabel(node, 'Medals', 20, UI.dim, {}, font);
      placeLabel(medals, LEFT, -48, 'left');
      const icons = uiNode(node, 'Icons', 0, 0, {}).addComponent(Graphics);
      const rows = CAMPAIGN_DIFFICULTIES.map((d, r) => {
        const name = uiLabel(node, `Row-${d}`, 18, UI.white, {}, font);
        placeLabel(name, 112, this.rowY(r), 'right');
        return { name };
      });
      const card: MissionCard = { node, gfx, title, sub, medals, rows, icons, mission: null };
      onTap(node, () => this.openMission(card));
      this.cards.push(card);
    }

    this.closed = uiNode(this.root, 'Closed', CARD_WIDTH, 360, { top: MISSIONS_TOP, centerX: true });
    drawCard(this.closed.addComponent(Graphics), CARD_WIDTH, 360, null, true);
    this.closedIcon = uiNode(this.closed, 'Icon', 0, 0, {}).addComponent(Graphics);
    this.closedTitle = uiLabel(this.closed, 'Title', 36, UI.white, {}, font);
    placeLabel(this.closedTitle, 0, 0);
    this.closedText = uiLabel(this.closed, 'Text', 22, UI.dim, {}, font);
    placeLabel(this.closedText, 0, -80);
  }

  enter(): void {
    const sector = sectorOf(this.host.pick.mission);
    this.index = sector ? SECTORS.indexOf(sector) : 0;
    this.refresh();
  }

  key(code: KeyCode): boolean {
    if (code === KeyCode.ARROW_LEFT || code === KeyCode.ARROW_RIGHT) {
      this.turn(code === KeyCode.ARROW_LEFT ? -1 : 1);
      return true;
    }
    const i = code - KeyCode.DIGIT_1;
    if (i >= 0 && i < this.cards.length) {
      this.openMission(this.cards[i]);
      return true;
    }
    return false;
  }

  private rowY(r: number): number {
    return 30 - r * 52;
  }

  private arrow(dir: number): Node {
    const node = uiNode(this.root, dir < 0 ? 'Prev' : 'Next', 90, 110, dir < 0 ? { top: 150, left: 20 } : { top: 150, right: 20 });
    const g = node.addComponent(Graphics);
    drawButton(g, 90, 110, false);
    drawChevron(g, 0, 0, 40, dir, UI.white);
    onTap(node, () => this.turn(dir));
    return node;
  }

  private turn(dir: number): void {
    const i = this.index + dir;
    if (i < 0 || i >= SECTORS.length) return;
    this.index = i;
    this.refresh();
  }

  private state(): SectorState {
    const sector = SECTORS[this.index];
    if (sector.missions.length > 0 && this.host.unlockAll) return 'open';
    return sectorState(SaveService.records, sector);
  }

  private refresh(): void {
    const sector = SECTORS[this.index];
    const records = SaveService.records;
    const state = this.state();
    this.number.string = `SECTOR ${sector.id}`;
    this.name.string = sector.name;
    const color = toColor(sector.color);
    this.stripe.clear();
    this.stripe.fillColor = color;
    this.stripe.roundRect(-140, -3, 280, 6, 3);
    this.stripe.fill();
    this.prev.active = this.index > 0;
    this.next.active = this.index < SECTORS.length - 1;

    const open = state === 'open';
    const tally = sectorMedals(records, sector);
    this.medals.node.active = open;
    this.medals.string = `MEDALS  ${tally.earned} / ${tally.total}`;
    this.closed.active = !open;
    this.cards.forEach((card, i) => {
      const mission = open ? sector.missions[i] ?? null : null;
      card.node.active = mission !== null;
      card.mission = mission;
      if (mission) this.drawMission(card, mission);
    });
    if (open) return;

    const g = this.closedIcon;
    g.clear();
    if (state === 'locked') {
      const prev = SECTORS[this.index - 1];
      drawLock(g, 0, 90, 70, UI.dim);
      this.closedTitle.string = 'LOCKED';
      this.closedText.string = `Defeat ${prev.boss} and earn\n${prev.medalsToAdvance} medals in ${prev.name}`;
    } else {
      this.closedTitle.string = 'COMING SOON';
      this.closedText.string = `New enemies and the boss\n${sector.boss} are on their way`;
    }
  }

  private drawMission(card: MissionCard, mission: MissionId): void {
    const records = SaveService.records;
    const def = MISSIONS[mission];
    const unlocked = this.host.unlockAll || missionUnlocked(records, mission);
    drawCard(card.gfx, CARD_WIDTH, MISSION_CARD_HEIGHT, null, !unlocked);
    card.title.string = def.title;
    card.title.color = unlocked ? UI.white : UI.dim;
    card.sub.string = def.subtitle;
    card.sub.color = unlocked ? UI.accent : UI.dim;
    const g = card.icons;
    g.clear();
    if (!unlocked) {
      const i = SECTORS[this.index].missions.indexOf(mission);
      card.medals.string = i > 0 ? `CLEAR ${titleOf(SECTORS[this.index].missions[i - 1])} TO UNLOCK` : 'LOCKED';
      card.medals.color = UI.dim;
      for (const row of card.rows) row.name.node.active = false;
      drawLock(g, RIGHT - 30, 0, 56, UI.dim);
      return;
    }
    let earned = 0;
    CAMPAIGN_DIFFICULTIES.forEach((d, r) => {
      const row = card.rows[r];
      row.name.node.active = true;
      row.name.string = d.toUpperCase();
      const record = SaveService.record(mission, d);
      const open = this.host.unlockAll || difficultyUnlocked(records, mission, d);
      row.name.color = open ? UI.white : UI.dim;
      const y = this.rowY(r);
      if (!open) {
        drawLock(g, 150, y, 28, UI.dim);
        return;
      }
      earned += medalCount(record?.medals ?? 0);
      MEDALS.forEach((m, k) => drawMedal(g, m.id, 148 + k * 36, y, DIFF_MEDAL_R, record !== null && hasMedal(record.medals, m.id)));
    });
    const total = CAMPAIGN_DIFFICULTIES.length * MEDALS.length;
    card.medals.string = `MEDALS  ${earned} / ${total}`;
    card.medals.color = earned > 0 ? UI.gold : UI.dim;
  }

  private openMission(card: MissionCard): void {
    const mission = card.mission;
    if (!mission || !card.node.active) return;
    if (!this.host.unlockAll && !missionUnlocked(SaveService.records, mission)) return;
    this.host.pick.mission = mission;
    this.host.open('mission');
  }
}

// ---- Mission: difficulties, medals, LAUNCH --------------------------------------------------

const ROW_HEIGHT = 182;
const ROW_GAP = 18;
const ROWS_TOP = 196;
const ROW_MEDAL_R = 26;

interface DifficultyRow {
  difficulty: Difficulty;
  node: Node;
  gfx: Graphics;
  name: Label;
  best: Label;
  detail: Label;
  icons: Graphics;
}

export class MissionPage implements MenuPage {
  readonly root: Node;
  readonly pose = null;
  readonly logo = false;
  private readonly title: Label;
  private readonly subtitle: Label;
  private readonly rows: DifficultyRow[] = [];
  private readonly launchLabel: Label;

  constructor(parent: Node, private readonly host: MenuHost) {
    const font = host.font;
    this.root = pageRoot(parent, 'MissionPage');
    this.title = pageHeader(this.root, '', host);
    this.subtitle = uiLabel(this.root, 'Subtitle', 28, UI.accent, { top: 136, centerX: true }, font);

    CAMPAIGN_DIFFICULTIES.forEach((difficulty, i) => {
      const node = uiNode(this.root, `Row-${difficulty}`, CARD_WIDTH, ROW_HEIGHT, { top: ROWS_TOP + i * (ROW_HEIGHT + ROW_GAP), centerX: true });
      const gfx = node.addComponent(Graphics);
      const name = uiLabel(node, 'Name', 34, UI.white, {}, font);
      placeLabel(name, LEFT, 50, 'left');
      const best = uiLabel(node, 'Best', 24, UI.white, {}, font);
      placeLabel(best, LEFT, -6, 'left');
      const detail = uiLabel(node, 'Detail', 20, UI.dim, {}, font);
      placeLabel(detail, LEFT, -52, 'left');
      const icons = uiNode(node, 'Icons', 0, 0, {}).addComponent(Graphics);
      const row: DifficultyRow = { difficulty, node, gfx, name, best, detail, icons };
      onTap(node, () => this.select(difficulty));
      this.rows.push(row);
    });

    // What each medal asks for.
    const legendTop = ROWS_TOP + CAMPAIGN_DIFFICULTIES.length * (ROW_HEIGHT + ROW_GAP) + 16;
    const legend = uiNode(this.root, 'Legend', CARD_WIDTH, MEDALS.length * 46, { top: legendTop, centerX: true });
    const lg = uiNode(legend, 'Icons', 0, 0, {}).addComponent(Graphics);
    MEDALS.forEach((m, i) => {
      const y = (MEDALS.length * 46) / 2 - 23 - i * 46;
      drawMedal(lg, m.id, LEFT + 18, y, 17, true);
      const name = uiLabel(legend, `Name-${m.id}`, 20, UI.white, {}, font);
      name.string = m.name;
      placeLabel(name, LEFT + 48, y, 'left');
      const hint = uiLabel(legend, `Hint-${m.id}`, 18, UI.dim, {}, font);
      hint.string = m.hint;
      placeLabel(hint, RIGHT, y, 'right');
    });

    const hangar = uiNode(this.root, 'Hangar', 220, 104, { bottom: 48, left: 40 });
    drawButton(hangar.addComponent(Graphics), 220, 104, false);
    const hangarLabel = uiLabel(hangar, 'Label', 28, UI.white, {}, font);
    hangarLabel.string = 'HANGAR';
    placeLabel(hangarLabel, 0, 0);
    onTap(hangar, () => host.open('hangar'));
    const launch = uiNode(this.root, 'Launch', 380, 104, { bottom: 48, right: 40 });
    drawButton(launch.addComponent(Graphics), 380, 104, true);
    this.launchLabel = uiLabel(launch, 'Label', 34, UI.white, {}, font);
    this.launchLabel.string = 'LAUNCH';
    placeLabel(this.launchLabel, 0, 0);
    onTap(launch, () => host.launch());
  }

  enter(): void {
    const pick = this.host.pick;
    const def = MISSIONS[pick.mission];
    this.title.string = def.title;
    this.subtitle.string = def.subtitle;
    // Keep the difficulty if it is open here, else the hardest open one below it.
    if (!this.isOpen(pick.difficulty) || CAMPAIGN_DIFFICULTIES.indexOf(pick.difficulty) < 0) {
      let best: Difficulty = CAMPAIGN_DIFFICULTIES[0];
      for (const d of CAMPAIGN_DIFFICULTIES) {
        if (DIFFICULTY_ORDER.indexOf(d) <= DIFFICULTY_ORDER.indexOf(pick.difficulty) && this.isOpen(d)) best = d;
      }
      pick.difficulty = best;
    }
    this.refresh();
  }

  key(code: KeyCode): boolean {
    if (code === KeyCode.ENTER || code === KeyCode.SPACE) {
      this.host.launch();
      return true;
    }
    if (code === KeyCode.ARROW_LEFT || code === KeyCode.ARROW_RIGHT) {
      const i = CAMPAIGN_DIFFICULTIES.indexOf(this.host.pick.difficulty) + (code === KeyCode.ARROW_LEFT ? -1 : 1);
      if (i >= 0 && i < CAMPAIGN_DIFFICULTIES.length) this.select(CAMPAIGN_DIFFICULTIES[i]);
      return true;
    }
    return false;
  }

  private isOpen(d: Difficulty): boolean {
    return this.host.unlockAll || difficultyUnlocked(SaveService.records, this.host.pick.mission, d);
  }

  private select(difficulty: Difficulty): void {
    if (!this.isOpen(difficulty)) return;
    this.host.pick.difficulty = difficulty;
    this.refresh();
  }

  private refresh(): void {
    const pick = this.host.pick;
    for (const row of this.rows) {
      const d = row.difficulty;
      const open = this.isOpen(d);
      const selected = open && d === pick.difficulty;
      drawCard(row.gfx, CARD_WIDTH, ROW_HEIGHT, selected ? UI.buttonEdge : null, !open);
      row.name.string = d.toUpperCase();
      row.name.color = open ? UI.white : UI.dim;
      const g = row.icons;
      g.clear();
      if (!open) {
        const prev = DIFFICULTY_ORDER[DIFFICULTY_ORDER.indexOf(d) - 1];
        row.best.string = 'LOCKED';
        row.best.color = UI.dim;
        row.detail.string = `Earn all 4 medals on ${prev.toUpperCase()}`;
        drawLock(g, RIGHT - 40, 0, 60, UI.dim);
        continue;
      }
      const record = SaveService.record(pick.mission, d);
      const played = record !== null && (record.score > 0 || record.clears > 0);
      row.best.string = played ? `BEST  ${record.score.toLocaleString('en-US')}` : 'NOT PLAYED YET';
      row.best.color = played ? UI.gold : UI.dim;
      row.detail.string = record && record.clears > 0 ? `KILLS ${Math.round(record.killRate * 100)}%  ·  CLEARED ×${record.clears}` : played ? 'NOT CLEARED YET' : '';
      MEDALS.forEach((m, k) => drawMedal(g, m.id, RIGHT - ROW_MEDAL_R - (MEDALS.length - 1 - k) * 62, 6, ROW_MEDAL_R, record !== null && hasMedal(record.medals, m.id)));
    }
  }
}
