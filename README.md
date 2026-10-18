# Space Flight

**Русский** · [English](README.en.md)

Вертикальный 2.5D shoot 'em up для телефона: low-poly 3D-корабли, камера сверху, управление одним пальцем. Кампания из трёх секторов с боссами, медали, четыре уровня сложности и ангар апгрейдов. Бесплатно и без рекламы: играется в браузере, ставится на экран «Домой», есть приложения для Android и iPhone.

**▶ Играть:** https://spaceflight.p1gog.duckdns.org/ · **Страница игры:** https://spaceflight.p1gog.duckdns.org/about/

<p>
  <img src="docs/media/gameplay.gif" width="216" alt="Геймплей: Ice Moons, Nebula Drift, босс Leviathan">
  <img src="site/about/media/shot-hive-mother.webp" width="216" alt="Босс Hive Mother">
  <img src="site/about/media/shot-nebula-ion.webp" width="216" alt="Ion Laser в Nebula Drift">
  <img src="site/about/media/shot-hangar.webp" width="216" alt="Ангар">
</p>

**Статус:** версия 1.0, проект завершён. Основной релиз — PWA; APK для Android и `.ipa` для iPhone собираются в GitHub Actions и скачиваются со [страницы игры](https://spaceflight.p1gog.duckdns.org/about/). История разработки — в [docs/PLAN.md](docs/PLAN.md).

## Коротко об игре

- Корабль следует за пальцем и стреляет сам. Защищают щит и корпус, а на крайний случай есть Special: Nova Bomb, Overdrive, Phase Shield или Time Warp.
- 6 основных пушек, 4 вспомогательных, 3 дрона. В миссии оружие прокачивается до Power IV, между миссиями — апгрейды за кредиты в ангаре. Три корабля, у каждого три расцветки.
- 9 миссий в 3 секторах (Outer Ring, Ice Moons, Nebula Drift): шесть мини-боссов и три босса — Warden, Hive Mother, Leviathan. В каждой миссии 4 медали: Hunter, Exterminator, Rescuer, Untouchable.
- Сложности Normal, Hard, Insane, Nightmare; элитные враги.
- Вдохновлено Sky Force Reloaded и Tyrian 2000. Подробнее — в [docs/GDD.md](docs/GDD.md).

## Технологии

| | |
|---|---|
| Движок | [Cocos Creator 3.8 LTS](https://docs.cocos.com/creator/3.8/manual/en/) |
| Язык | TypeScript |
| Платформы | Web / PWA на своём VPS (основной релиз); Android (APK) и iOS (неподписанный `.ipa`, ставится через Sideloadly) — сборка в GitHub Actions |
| Тесты | Vitest (чистая логика), Playwright (визуальные плейтесты) |
| Ассеты | Только бесплатные: CC0 и аналоги (Quaternius, Kenney…), см. [docs/ASSETS.md](docs/ASSETS.md) |

## Быстрый старт

### 1. Установка

1. Установить [Node.js](https://nodejs.org/) 20+ (проект ведётся на 24).
2. Скачать и установить [Cocos Dashboard](https://www.cocos.com/en/creator-download). Галочку «Install Visual Studio 2022» можно не ставить: она нужна только для нативных сборок под Windows.
3. В Dashboard → **Installs** установить **Cocos Creator 3.8.x** (проект сделан на 3.8.8).

### 2. Открыть проект

Dashboard → **Projects** → **Add** → папка `game/` из этого репозитория.

### 3. Запуск

- **В браузере:** кнопка ▶ **Preview** в редакторе, откроется `http://localhost:7456`.
- **На iPhone:** телефон в той же сети Wi‑Fi; наведите курсор на IP-адрес в тулбаре редактора и отсканируйте QR-код — игра откроется в Safari.
- **Тесты и проверка типов:** `npm install`, затем `npm test` и `npm run typecheck` (для typecheck проект должен хотя бы раз открыться в редакторе).

## Структура

```
docs/          документация: GDD, план, архитектура, ассеты, платформы
game/          проект Cocos Creator (assets/, settings/, native/)
tests/         unit-тесты чистой логики
site/          страница игры (/about/): описание, видео, скриншоты, установка
tools/         скрипты: конвейеры ассетов, баланс, сборка и выкатка web, CI
build-configs/ конфиги сборки Cocos для CLI и CI
youtube/       съёмка и монтаж ролика для YouTube Shorts
.github/       GitHub Actions: сборка APK и .ipa
.claude/       настройки и скиллы Claude Code
```

Подробнее — в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Документация

| Документ | О чём |
|---|---|
| [docs/GDD.md](docs/GDD.md) | Геймдизайн: механики, оружие, враги, боссы, кампания, экономика |
| [docs/PLAN.md](docs/PLAN.md) | Этапы разработки и что в них сделано |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Устройство кода и бюджеты производительности |
| [docs/BALANCE.md](docs/BALANCE.md) | Таблица баланса оружия и экономики (генерируется `npm run balance`) |
| [docs/ASSETS.md](docs/ASSETS.md) | Источники графики и звука, лицензии, Credits |
| [docs/PLATFORMS.md](docs/PLATFORMS.md) | Web, iOS (в том числе без Mac), Android |
| [docs/SECURITY_REPORT.md](docs/SECURITY_REPORT.md) | Аудит безопасности сборки и сервера |
| [CLAUDE.md](CLAUDE.md) | Правила разработки для Claude Code |
| [prd.md](prd.md) | Исходная постановка задачи |

## Разработка с Claude Code

Подключено:
- **Context7** — актуальная документация Cocos.
- **Playwright MCP** — браузерные плейтесты (`.mcp.json`).
- **Funplay Cocos MCP** — управление редактором и скриншоты сцены. Сервер слушает `127.0.0.1:28456`, пока открыт редактор. Расширение в git не хранится; установка:
  ```bash
  git clone --depth 1 https://github.com/FunplayAI/funplay-cocos-mcp.git game/extensions/funplay-cocos-mcp
  ```
  После установки перезапустите редактор.

Скиллы проекта лежат в `.claude/skills/`: `playtest`, `add-asset`, `add-enemy`, `add-mission`, `add-weapon`.

## Лицензии

- **Ассеты:** авторы и лицензии — в таблице Credits в [docs/ASSETS.md](docs/ASSETS.md).
- **Код:** лицензия пока не выбрана.
