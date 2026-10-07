# Space Flight

Вертикальный 2.5D shoot 'em up для телефона: low-poly 3D-корабли с камерой сверху, управление одним пальцем, кампания из трёх секторов с боссами, медалями, четырьмя сложностями и ангаром апгрейдов. Бесплатно, без рекламы, играется в браузере и ставится на экран «Домой».

**▶ Играть:** https://spaceflight.p1gog.duckdns.org/ · **Страница игры:** https://spaceflight.p1gog.duckdns.org/about/

<p>
  <img src="docs/media/gameplay.gif" width="216" alt="Геймплей: Ice Moons, Nebula Drift, босс Leviathan">
  <img src="site/about/media/shot-hive-mother.webp" width="216" alt="Босс Hive Mother">
  <img src="site/about/media/shot-nebula-ion.webp" width="216" alt="Ion Laser в Nebula Drift">
  <img src="site/about/media/shot-hangar.webp" width="216" alt="Ангар">
</p>

**Статус:** версия 1.0 — этап 9, релиз PWA (этап 8, нативная iOS, отложен). Прогресс — в [docs/PLAN.md](docs/PLAN.md).

## Коротко об игре

- Тянешь пальцем — корабль летит, стрельба автоматическая. Щит, корпус и Special: Nova Bomb, Overdrive, Phase Shield, Time Warp.
- 6 основных пушек, 4 вспомогательных, 3 дрона; Power I–IV в миссии, апгрейды за кредиты в ангаре. Три корабля в трёх расцветках.
- 9 миссий в 3 секторах (Outer Ring, Ice Moons, Nebula Drift): шесть мини-боссов и три босса — Warden, Hive Mother, Leviathan. 4 медали на миссию: Hunter, Exterminator, Rescuer, Untouchable.
- Сложности Normal, Hard, Insane, Nightmare; элитные враги.
- Вдохновлено Sky Force Reloaded и Tyrian 2000. Подробно — в [docs/GDD.md](docs/GDD.md).

## Технологии

| | |
|---|---|
| Движок | [Cocos Creator 3.8 LTS](https://docs.cocos.com/creator/3.8/manual/en/) |
| Язык | TypeScript |
| Платформы | Web / PWA на своём VPS (разработка и основной релиз); нативная iOS на свой iPhone (облачная сборка и Sideloadly) — отложена |
| Тесты | Vitest (чистая логика), Playwright (визуальные плейтесты) |
| Ассеты | Бесплатные: CC0 и аналоги (Quaternius, Kenney…), см. [docs/ASSETS.md](docs/ASSETS.md) |

## Быстрый старт

### 1. Установка

1. Установить [Node.js](https://nodejs.org/) 20+ (сейчас стоит 24).
2. Скачать и установить [Cocos Dashboard](https://www.cocos.com/en/creator-download). Галку «Install Visual Studio 2022» не ставить: она нужна только для нативных Windows-сборок.
3. В Dashboard → **Installs** установить последнюю **Cocos Creator 3.8.x**.

### 2. Открыть проект

- **Первый раз** (проект ещё не создан): Dashboard → **New Project** → шаблон **Empty (3D)**. Location — папка этого репозитория, Name — `game`.
- **Дальше:** Dashboard → **Projects** → **Add** → папка `game/`.

### 3. Запуск

- **В браузере:** кнопка ▶ **Preview** в редакторе, откроется `http://localhost:7456`.
- **На iPhone:** телефон в той же Wi‑Fi-сети; наведи курсор на IP-адрес в тулбаре редактора и отсканируй QR-код. Игра откроется в Safari.
- **Тесты и типы:** `npm install`, затем `npm test` и `npm run typecheck` (typecheck требует, чтобы проект хотя бы раз открывался в редакторе).

## Структура

```
docs/         документация: GDD, план, архитектура, ассеты, платформы
game/         проект Cocos Creator (assets/, settings/, extensions/)
tests/        unit-тесты чистой логики
site/         страница игры (/about/): описание, видео, скриншоты, установка
tools/        вспомогательные скрипты: конвейеры ассетов, баланс, сборка и выкатка web
build-configs/ конфиги сборки Cocos для CLI и CI
.claude/      настройки и скиллы Claude Code
```

Подробно — в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Документация

| Документ | О чём |
|---|---|
| [docs/GDD.md](docs/GDD.md) | Геймдизайн: механики, оружие, враги, боссы, кампания, экономика |
| [docs/PLAN.md](docs/PLAN.md) | Этапы разработки и текущий прогресс |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Устройство кода и бюджеты производительности |
| [docs/ASSETS.md](docs/ASSETS.md) | Источники графики и звука, лицензии, Credits |
| [docs/PLATFORMS.md](docs/PLATFORMS.md) | Web, iOS (в том числе без Mac), Android |
| [CLAUDE.md](CLAUDE.md) | Правила разработки для Claude Code |
| [prd.md](prd.md) | Исходная постановка |

## Разработка с Claude Code

Подключено:
- **Context7** — актуальная документация Cocos.
- **Playwright MCP** — браузерные плейтесты (`.mcp.json`).
- **Funplay Cocos MCP** — управление редактором, скриншоты сцены. Сервер слушает `127.0.0.1:28456`, пока открыт редактор. Расширение в git не хранится; установка:
  ```bash
  git clone --depth 1 https://github.com/FunplayAI/funplay-cocos-mcp.git game/extensions/funplay-cocos-mcp
  ```
  После установки перезапустить редактор.

Скиллы проекта лежат в `.claude/skills/`: `playtest`, `add-asset`, `add-enemy`, `add-mission`, `add-weapon`.

## Лицензии

- **Ассеты:** авторы и лицензии — в таблице Credits в [docs/ASSETS.md](docs/ASSETS.md).
- **Код:** лицензия пока не выбрана.
