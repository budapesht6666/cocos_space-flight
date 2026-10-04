# Space Flight

Вертикальный 2.5D shoot 'em up для iPhone: low-poly 3D-корабли с камерой сверху, управление одним пальцем, кампания из 5 секторов с медалями, четырьмя сложностями и ангаром апгрейдов.

**Статус:** этап 0, подготовка. Прогресс — в [docs/PLAN.md](docs/PLAN.md).

## Коротко об игре

- Тянешь пальцем — корабль летит, стрельба автоматическая. Щит, корпус и спецспособности (Nova Bomb, Overdrive, Time Warp…).
- 6 типов основного оружия, вспомогательное оружие, дроны-напарники; апгрейды за кредиты.
- 15 миссий в 5 секторах, у каждого сектора свой босс. 4 медали на миссию: Hunter, Exterminator, Rescuer, Untouchable.
- Сложности Normal, Hard, Insane, Nightmare.
- Вдохновлено Sky Force Reloaded и Tyrian 2000. Подробно — в [docs/GDD.md](docs/GDD.md).

## Технологии

| | |
|---|---|
| Движок | [Cocos Creator 3.8 LTS](https://docs.cocos.com/creator/3.8/manual/en/) |
| Язык | TypeScript |
| Платформы | Web / PWA (разработка и основной релиз, бесплатный хостинг) → нативная iOS на свой iPhone (облачная сборка и Sideloadly, бесплатно) |
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
tools/        вспомогательные скрипты (баланс и т.п.)
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

Скиллы проекта лежат в `.claude/skills/`: `playtest`, `add-asset`.

## Лицензии

- **Ассеты:** авторы и лицензии — в таблице Credits в [docs/ASSETS.md](docs/ASSETS.md).
- **Код:** лицензия пока не выбрана.
