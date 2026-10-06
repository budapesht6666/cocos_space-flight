// Balance table (PLAN stage 5): prints the arsenal's damage per second in typical situations, time
// to kill each enemy, mission income and hangar costs, and writes them to docs/BALANCE.md.
// The numbers come from game/assets/scripts/core/balance.ts, so they always match the data.
//
// Usage: npm run balance            (writes docs/BALANCE.md)
//        npm run balance -- --print (prints only)

import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

register('./lib/ts-loader.mjs', import.meta.url);

const ROOT = path.resolve(import.meta.dirname, '..');
const SCRIPTS = path.join(ROOT, 'game/assets/scripts');
const load = (file) => import(new URL(`file:///${path.join(SCRIPTS, file).replace(/\\/g, '/')}`).href);

const balance = await load('core/balance.ts');
const { PRIMARIES, SECONDARIES } = await load('data/weapons.ts');
const { UPGRADES } = await load('data/economy.ts');

const SITUATION_NAMES = {
  focus: 'Босс',
  small: 'Мелкая',
  armor: 'Броня',
  close: 'Вплотную',
  wave: 'Волна V',
  trail: 'Цепочка',
  cluster: 'Группа',
  flank: 'Фланг',
  rear: 'Сзади',
};

const fmt = (n) => (Number.isFinite(n) ? (n >= 100 ? n.toFixed(0) : n.toFixed(1)) : '—');
const name = (id) => UPGRADES[id].name;

function weaponTable(ids, level) {
  const rows = balance.weaponRows(ids, level);
  const best = {};
  for (const s of balance.SITUATIONS) best[s] = Math.max(...rows.map((r) => r.situations[s]));
  const head = ['Оружие', 'Пик I', 'Пик IV', ...balance.SITUATIONS.map((s) => SITUATION_NAMES[s])];
  const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
  for (const r of rows) {
    const cells = balance.SITUATIONS.map((s) => {
      const v = fmt(r.situations[s]);
      return r.situations[s] >= best[s] - 1e-9 && best[s] > 0 ? `**${v}**` : v;
    });
    lines.push(`| ${name(r.id)} | ${fmt(r.peak[0])} | ${fmt(r.peak[1])} | ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

const TTK_ENEMIES = ['scout', 'gunship', 'turretHeavy', 'marauder', 'dreadnought', 'warden', 'spinner', 'carrier', 'cyclone', 'hiveMother', 'arbiter', 'leviathan'];

function ttkTable(ids, power, level) {
  const scale = { level, damage: 1, cooldown: 1 };
  const head = ['Оружие', ...TTK_ENEMIES];
  const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
  for (const id of ids) {
    const def = PRIMARIES[id] ?? SECONDARIES[id];
    const cells = TTK_ENEMIES.map((e) => fmt(balance.timeToKill(def, e, power, scale)));
    lines.push(`| ${name(id)} | ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

function incomeTable() {
  const rows = balance.allMissionIncome(['normal', 'hard', 'insane']);
  const lines = ['| Миссия | Сложность | Все кредиты | Прохождение | 4 первые медали | Итого максимум |', '|---|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.mission} | ${r.difficulty} | ${r.drops} | ${r.clear} | ${r.medals} | ${r.drops + r.clear + r.medals} |`);
  return { text: lines.join('\n'), rows };
}

function costTable() {
  const costs = balance.hangarCosts();
  const names = { systems: 'Системы (SYSTEMS)', primary: 'Primary', secondary: 'Secondary', drone: 'Дроны и Drone Bay', special: 'Special' };
  const total = Object.values(costs).reduce((a, b) => a + b, 0);
  const lines = ['| Группа | Всё куплено |', '|---|---|'];
  for (const [group, sum] of Object.entries(costs)) lines.push(`| ${names[group] ?? group} | ${sum.toLocaleString('ru-RU')} |`);
  lines.push(`| **Всего** | **${total.toLocaleString('ru-RU')}** |`);
  return { text: lines.join('\n'), total };
}

const primaries = Object.keys(PRIMARIES);
const secondaries = Object.keys(SECONDARIES);
const income = incomeTable();
const costs = costTable();
const avg = (rows, k = 0.8) => rows.reduce((a, r) => a + r.drops * k + r.clear, 0) / rows.length;
/** One playthrough of every mission on a difficulty: 80% of the credits, the clear and the first medals. */
const campaign = (difficulty) => income.rows.filter((r) => r.difficulty === difficulty).reduce((a, r) => a + r.drops * 0.8 + r.clear + r.medals, 0);
const sectorRuns = (prefix, difficulty) => income.rows.filter((r) => r.difficulty === difficulty && r.mission.startsWith(prefix));
const runLine = (difficulty) => ['s1', 's2', 's3'].map((p, i) => `Сектор ${i + 1} ≈ ${Math.round(avg(sectorRuns(p, difficulty)))}`).join(', ');

const doc = `# Баланс арсенала

> Сгенерировано \`npm run balance\` из данных игры (\`core/balance.ts\`). Руками не править: поменяй данные и перегенерируй.

Урон в секунду (DPS) при уровне оружия 1, Power IV (кроме столбцов «Пик I»), HP врагов на Normal. Уровень оружия 5 умножает всё на ×1.92 (урон ×1.6, скорострельность ×1.2), корабль Executioner — Primary ещё на ×1.15.

**Ситуации** (расстояния — от носа корабля, в юнитах; ширина поля 10):
- **Пик** — всё, что выпущено, попадает (верхняя граница).
- **Босс** — один крупный враг (радиус 1.5, как Marauder) в 7 впереди: широкие веера частично мажут, у Scatter Gun падает урон с дистанцией.
- **Мелкая** — враг размером с Gunship (радиус 0.75) там же: точность.
- **Броня** — ядро Warden под бронёй 25% (радиус 2): решает пробивание брони.
- **Вплотную** — 5 Scout в 3 впереди, через 1 юнит: рой у носа.
- **Волна V** — самая частая волна: клин из 7 Scout (шаг 1.2), вожак в 5 впереди.
- **Цепочка** — 5 Scout друг за другом через 1, от 4 впереди (стайки на сплайнах): пробивание и взрывы.
- **Группа** — плотная кучка из 4 целей размером со Scout (через 0.9) в 6 впереди: обломки астероида, гнездо турелей.
- **Фланг** — один враг сбоку (3.5 вбок, 3 вперёд).
- **Сзади** — один враг в 3 позади носа.

Во фронтальных ситуациях игрок прицеливается: корабль сдвигается вбок (до 2 юнитов) туда, где оружие наносит больше всего; на фланге и сзади — нет. Самонаводящиеся снаряды в модели попадают всегда; молния бьёт ближайшего в радиусе 5.5 от носа (до края цели) и перескакивает.

Жирным — лучший в ситуации. Правила (тест \`tests/core/balance.test.ts\`): ни одно оружие не лучшее везде, ни одно основное не лучшее больше чем в половине ситуаций, у каждого есть ниша (лучшее или не хуже 85% от лучшего хоть где-то), по боссу каждое основное даёт 50–110% от Pulse Cannon.

## Primary

${weaponTable(primaries, 1)}

## Secondary

${weaponTable(secondaries, 1)}

## Время убийства, секунды (Primary, Power IV, уровень 1, Normal, цель в 5 впереди)

HP: Scout 3, Gunship 22, Heavy Turret 16, Marauder 520, Dreadnought 640 (корпус), Warden 950 (ядро под бронёй 25%, пока живы модули; здесь вся жизнь под бронёй — верхняя оценка); Сектор 2 — Spinner 30, Cyclone 620, Hive Mother 1250 (панцирь 20% закрыт ~40% времени — здесь без него, нижняя оценка); Сектор 3 — Carrier 150, Arbiter 720, Leviathan 1300 (голова под бронёй 25%, пока живы 6 сегментов по 120 — верхняя оценка).

${ttkTable(primaries, 4, 1)}

## Доход за миссию

«Все кредиты» — если уничтожить всё и всё собрать; реальный прогон собирает ~70–90%. Бонус за прохождение — каждый раз, за медали — один раз. Секторы платят больше (\`SectorDef.pay\`: ×1, ×1.35, ×1.7 — дороже каждая монета и бонусы, монет столько же); Insane и Nightmare — ×3 монет, как Hard ×2. Миньоны Carrier и Hive Mother в модели не считаются (их приносит сверху сколько успеешь сбить).

${income.text}

## Цены ангара

${costs.text}

Средний прогон (80% кредитов + прохождение): Normal — ${runLine('normal')}; Hard — ${runLine('hard')}. Кампания целиком (80% кредитов, прохождения и первые медали): Normal ≈ ${Math.round(campaign('normal'))}, Hard ≈ ${Math.round(campaign('hard'))}, Insane ≈ ${Math.round(campaign('insane'))}. Цель GDD §14 — полный апгрейд (${costs.total.toLocaleString('ru-RU')}) ≈ все секторы на Normal и Hard и часть на Insane: Normal + Hard ≈ ${Math.round(campaign('normal') + campaign('hard'))}, с Insane ≈ ${Math.round(campaign('normal') + campaign('hard') + campaign('insane'))}.
`;

if (process.argv.includes('--print')) console.log(doc);
else {
  fs.writeFileSync(path.join(ROOT, 'docs/BALANCE.md'), doc);
  console.log(doc);
  console.log('→ docs/BALANCE.md');
}
