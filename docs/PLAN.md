# План разработки

> Отмечаем прогресс по ходу работы. «Готово, когда» — критерий приёмки этапа.
> **👤** — шаг делает пользователь, остальное делает Claude.

**Сейчас:** этап 0 закрыт. Следующий — этап 1, вертикальный срез.

---

## Этап 0 — Подготовка

- [x] Исследование: движок, платформы, ассеты, референсы
- [x] Решения зафиксированы: Cocos Creator 3.8 LTS, сначала Web → iOS, 3D low-poly 2.5D, кампания с апгрейдами, без монетизации, английский, режим максимальной автономии
- [x] Бюджет $0: релиз как PWA, нативная iOS только на свой iPhone через sideload; App Store вне рамок
- [x] Документация: README, CLAUDE.md, GDD, ARCHITECTURE, ASSETS, PLATFORMS
- [x] MCP: Context7 (глобально), Playwright (`.mcp.json`); скиллы `playtest` и `add-asset`
- [x] 👤 Установить [Cocos Dashboard](https://www.cocos.com/en/creator-download) 2.2.2 (галку «Install Visual Studio 2022» **не ставить**: она нужна только для нативных Windows-сборок) и Cocos Creator **3.8.8**
- [x] 👤 Создать проект: Dashboard → **New Project** → шаблон **Empty (3D)**, Location — корень репозитория, Name — `game`
- [x] Удалить вложенный `game/.git`, который создаёт Cocos (пустой, без коммитов)
- [x] Funplay MCP 0.6.4 в `game/extensions/` (в git не входит, ставится `git clone`), фиксированный порт 28456 в `game/funplay-cocos-mcp.config.json`, сервер `cocos` в `.mcp.json`
- [x] 👤 Перезапустить редактор, чтобы загрузилось расширение, и перезапустить сессию Claude Code
- [x] 👤 Переподключить сервер `cocos` через `/mcp` (сессия стартовала раньше редактора)
- [x] Проверить Cocos MCP: информация о проекте, иерархия сцены, скриншот редактора
- [x] Тулинг в корне: `package.json` (TypeScript 5.9, Vitest 5), `vitest.config.ts`, `npm run typecheck`; `game/tsconfig.json` strict и `skipLibCheck`; `game/.gitignore` от Cocos проверен
- [x] Проверено: typecheck видит типы `'cc'` и ловит ошибки (пробный файл); `npm test` зелёный; превью `localhost:7456` открывается в Playwright, ошибок в консоли нет
- [x] Записать точную версию Cocos и путь к `CocosCreator.exe` в CLAUDE.md
- [x] 👤 Выбрать корабли: пак Quaternius Ultimate Spaceships; игрок — Spitfire (старт), Executioner и Striker (открываются); glTF и текстуры скачаны
- [x] 👤 Подтвердить роли остальных кораблей как врагов (см. [ASSETS.md](ASSETS.md)). Эффекты и звуки выбираем, когда до них дойдёт дело (этапы 1 и 6)
- [x] Коммит инфраструктуры

**Готово, когда:** проект открывается в редакторе; Claude видит сцену через MCP и делает скриншот превью через Playwright; `npm test` и typecheck зелёные.

## Этап 1 — Вертикальный срез «Ощущение полёта»

Цель: на iPhone в Safari приятно летать и стрелять.

- [ ] Настройки проекта: портретное разрешение (сейчас по умолчанию 1280×720, ландшафт), ориентация portrait, экспорт конфига сборки `web-mobile` в `build-configs/` и проверка CLI-сборки
- [ ] Сцена Game: перспективная камера под наклоном, подгонка ширины поля под экран, скайбокс, слои параллакса
- [ ] Корабль игрока Spitfire (Orange): импорт glTF (поворот 180°, масштаб ~1 юнит, текстура 1024²), относительный драг, ограничения поля, крен
- [ ] `GameWorld` с фиксированным шагом, пулы, `EventBus` (+ unit-тесты `core/`)
- [ ] Pulse Cannon (Power I), инстансинг пуль
- [ ] Враги Scout (формации) и Dart; простой таймлайн-спавнер
- [ ] Коллизии (круги и сетка), урон, смерть врага
- [ ] Juice v1: вспышка попадания, взрыв частицами, тряска камеры, bloom
- [ ] HUD v1: корпус, очки; Game Over и рестарт
- [ ] Debug-оверлей (`?debug=1`: FPS, draw calls, сущности), `?god=1`
- [ ] Проверка на iPhone по Wi‑Fi

**Готово, когда:** 60 FPS на iPhone в Safari; полёт отзывчивый; взрывы «сочные»; пользователь одобрил ощущения.

## Этап 2 — Ядро систем

- [ ] Данные: `types.ts`, weapons, enemies, patterns, levels; тест валидации данных
- [ ] Паттерны движения (сплайны, синус, нырок, зависание) и стрельбы (aimed, spread, ring, spiral, burst)
- [ ] LevelDirector по таймлайну, события `waitClear`, `setPiece`, `boss`; `?mission=`, `?t=`
- [ ] Щит и корпус, неуязвимость, graze, Energy, Nova Bomb
- [ ] Пикапы: Credits (магнит), P, R, S, E
- [ ] Комбо и очки; пауза; экран результатов
- [ ] Враги Gunship, Asteroid, Turret на «земле»
- [ ] Первая полноценная миссия s1m1
- [ ] Скиллы `add-enemy`, `add-weapon`, `add-mission`, когда формат данных устоится

**Готово, когда:** миссия s1m1 проходится от интро до результатов; контент добавляется правкой данных без нового кода.

## Этап 3 — Контент Сектора 1

- [ ] Миссии s1m2 и s1m3, окружение Outer Ring (станции, астероидные поля)
- [ ] Мини-босс; босс **Warden**: части, 3 фазы, WARNING, slow-mo
- [ ] Медали (Hunter, Exterminator, Rescuer, Untouchable), Escape Pod
- [ ] Сложности Normal и Hard
- [ ] Публичная web-сборка для друзей (GitHub Pages, Cloudflare Pages или itch.io), PWA-манифест

**Готово, когда:** Сектор 1 проходится целиком на Normal и Hard, плейтест друзей по ссылке.

## Этап 4 — Мета-прогрессия

- [ ] `SaveService` с версиями и миграциями (с тестами)
- [ ] Сцены Boot и Menu: Title («Tap to start», разблокировка аудио), Main Menu, Sector Map, выбор миссии и сложности
- [ ] Ангар: снаряжение (слоты) и апгрейды; экономика из `data/economy.ts`
- [ ] Выбор корабля (Spitfire, Executioner, Striker) и расцветки (Orange, Blue, Green) в ангаре; открытие кораблей за боссов секторов 2 и 3
- [ ] Открытие секторов и сложностей, награды за первые медали
- [ ] Tech Chips (скрытые коллекционки) — опционально

**Готово, когда:** петля «миссия → результаты → ангар → миссия» работает, прогресс переживает перезагрузку.

## Этап 5 — Арсенал

- [ ] Primary: Scatter Gun, Ion Laser, Seeker Missiles, Plasma Orbs, Tesla Arc
- [ ] Secondary: Swarm Rockets, Wing Cannons, Rail Lance, Rear Guns
- [ ] Drones: Gun, Guardian, Collector
- [ ] Specials: Overdrive, Phase Shield, Time Warp
- [ ] Балансная таблица (`tools/`): DPS, TTK, доход за миссию; первая калибровка

**Готово, когда:** каждое оружие ощущается по-своему, ни одно не доминирует по таблице.

## Этап 6 — Звук и полировка

- [ ] Музыка (меню, сектор, босс), полный набор SFX, `AudioService` с кроссфейдом
- [ ] Анимации меню и переходов; онбординг в s1m1
- [ ] Settings: громкость, чувствительность, handedness, качество графики (Low/Medium/High), FPS
- [ ] Экран Credits (атрибуции)
- [ ] Проход по производительности: бюджеты из ARCHITECTURE §13

## Этап 7 — Секторы 2–5

Для каждого сектора: окружение и палитра, новые враги (по GDD §9), 3 миссии, босс, сложности Insane и Nightmare, элитные модификаторы.

- [ ] Сектор 2 — Ice Moons, Hive Mother
- [ ] Сектор 3 — Nebula Drift, Leviathan
- [ ] Сектор 4 — Scrapyard, Duelist
- [ ] Сектор 5 — Core, Overmind

## Этап 8 — Нативная iOS на свой iPhone (бесплатно)

См. [PLATFORMS.md](PLATFORMS.md#нативная-ios-на-свой-iphone--бесплатно-этап-8).

- [ ] Выбор облачного macOS: Codemagic (500 мин/мес) или GitHub Actions (если репозиторий публичный)
- [ ] CI: Cocos CLI (`platform=ios`) → `xcodebuild` без подписи → `.ipa` как артефакт
- [ ] Иконки, launch screen, safe area, вибрация, аудиосессия
- [ ] 👤 Установить [Sideloadly](https://sideloadly.io/) на Windows и поставить `.ipa` на iPhone со своим Apple ID
- [ ] Тест на iPhone, сравнение с PWA, проход по производительности

## Этап 9 — Релиз

- [ ] PWA на бесплатном хостинге (GitHub Pages, Cloudflare Pages или itch.io): иконки, splash, «на экран „Домой“»
- [ ] Страница игры: описание, скриншоты, гифка геймплея
- [ ] Ссылка друзьям, сбор фидбека
- [ ] (Вне рамок, только если появится бюджет: App Store через Apple Developer Program, $99/год)
