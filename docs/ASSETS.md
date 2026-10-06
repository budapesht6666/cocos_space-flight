# Ассеты: источники, лицензии, пайплайн

> **Правило:** ассет попадает в проект только после выбора пользователя (Claude предлагает 2–4 варианта). Его лицензия проверена, а строка в таблице **Credits** внизу добавлена в том же шаге.
> Исключение — временные плейсхолдеры из примитивов движка (кубы, сферы).

## Выбранное направление

- **Стиль:** 3D low-poly, 2.5D, камера сверху. Критерии: **бесплатно** и **максимально эффектно**.
- **Как добиться «эффектно» бесплатно:**
  - Эффектность даёт **свет и эффекты**, а не полигоны: emissive и bloom, частицы, шлейфы, щит-шейдер, тёмный фон с туманностью, палитра своя для каждого сектора.
  - Паки разных авторов приводим к **единому виду своими материалами**: плоские цвета, общая палитра, emissive-акценты. Так Quaternius и Kenney не выглядят сборной солянкой.
  - Скайбоксы и планеты можно **генерировать** (процедурно или генератором) — бесплатно и уникально.

## Кандидаты по категориям

Статусы: 🟡 кандидат · ✅ выбран · ❌ отклонён

### Корабли (игрок, враги, боссы)

| Статус | Пак | Что внутри | Лицензия |
|---|---|---|---|
| ✅ выбран | [Quaternius — Ultimate Spaceships Pack](https://quaternius.com/packs/ultimatespaceships.html) | 10 кораблей × 5 расцветок, текстуры; FBX, OBJ, **glTF**, Blend | CC0 |
| 🟡 | [Quaternius — LowPoly Spaceships (OpenGameArt)](https://opengameart.org/content/lowpoly-spaceships-pack) | Версия на OpenGameArt: 10 кораблей × 5 расцветок, по одной текстуре на корабль; FBX, OBJ, **glTF**, Blend | CC0 |
| ✅ выбран (пикапы) | [Quaternius — Ultimate Space Kit](https://poly.pizza/bundle/Ultimate-Space-Kit-YWh743lqGX) | 87 моделей: корабли, мехи, инопланетяне, **планеты, камни**, постройки, **пикапы** (здоровье, патроны, молния, ящики); FBX, glTF | CC0 |
| ✅ выбран (станции, турели) | [Kenney — Space Kit](https://kenney.nl/assets/space-kit) | 150 моделей: корабли, камни, **станции и конструкции** (для «земли» уровня и турелей) | CC0 |
| 🟡 | [Poly Pizza](https://poly.pizza) | Каталог low-poly моделей, фильтр по лицензии | CC0 / CC-BY (смотреть у каждой модели) |
| 🟡 | [Sketchfab](https://sketchfab.com/search?features=downloadable&type=models) | Огромный выбор, фильтр «Downloadable» и лицензия CC0 / CC-BY | По модели |

**Заметки по Ultimate Spaceships:**
- **Корабли:** 10 на сайте плюс **Zenith** (есть только в зеркале OpenGameArt): Bob, Challenger, Dispatcher, Executioner, Imperial, Insurgent, Omen, Pancake, Spitfire, Striker, Zenith.
- **Геометрия:** 750–8 300 треугольников (Insurgent 8.3k, Striker 4.5k, остальные ≤ 3.5k). Единый меш, нос смотрит в **+Z**: при импорте поворачиваем на 180° по Y (у нас нос в −Z). Длина 5–18 юнитов — масштабируем.
- **Текстуры:** 2048² PNG, 5 расцветок (Blue, Green, Orange, Purple, Red); в glTF встроена одна. Уменьшаем до 1024².
- **Где скачать:**
  - Официальная ссылка ведёт в Google Drive (glTF и все расцветки). Drive режет частое скачивание («too many accesses»), после паузы снова отдаёт. Качаем выборочно только `glTF/` и `Textures/` нужных кораблей.
  - Зеркало одним zip — [OpenGameArt](https://opengameart.org/content/lowpoly-spaceships-pack), около 103 MB, сервер медленный. **glTF в нём нет** (FBX/OBJ/Blend), расцветок 1–3 на корабль.
- **Рендеры для выбора:** `.playwright-mcp/ships-all.png` (все 11) и `.playwright-mcp/player-ships-colors.png` (корабли игрока × 5 расцветок). Папка не в git, это локальные снимки.

**Роли кораблей:**

| Корабль | Роль | Статус |
|---|---|---|
| **Spitfire** | Стартовый корабль игрока, Orange | ✅ выбран пользователем |
| **Executioner** | Открываемый корабль игрока (тяжёлый) | ✅ выбран пользователем |
| **Striker** | Открываемый корабль игрока (перехватчик) | ✅ выбран пользователем |
| Bob | Scout (мясо, формации), Red | ✅ подтверждено |
| Dispatcher | Dart (камикадзе: силуэт-игла), Red | ✅ подтверждено |
| Challenger | Gunship, Purple; Red и крупнее — мини-босс Marauder (s1m1) | ✅ подтверждено |
| Omen | Splitter и его осколки (Shard), Purple; Red ×4 — мини-босс Shatterer (этап 7) | ✅ в игре |
| Zenith | Lancer (снайпер: длинный ствол), Red; Purple ×4.2 — мини-босс Arbiter; Red ×3.6 — голова Leviathan (этап 7) | ✅ в игре |
| Pancake | Spinner (тарелка с кольцами пуль), Purple; Red ×3.8 — мини-босс Cyclone (этап 7) | ✅ в игре |
| Imperial | Мини-босс Dreadnought (s1m2, этап 3, Red); Carrier и мини-босс Broodship (этап 7, Purple, серые затемнены) | ✅ в игре |
| Insurgent | Был Bulwark (сектор 4 урезан); стал боссом Hive Mother (этап 7, Purple, 8.3k треугольников, серые затемнены) | ✅ в игре |
| Dispatcher | Кроме Dart (Red) — Swarmer, рой Hive Mother (Purple, этап 7) | ✅ в игре |

Враги — только в Red и Purple, игрок — в Orange, Blue и Green (см. GDD §6).

**Дроны (этап 5)** — Kenney Space Kit (см. Credits): `craft_speederA`, `satelliteDish_detailed`, `craft_miner`. Рендер кандидатов — `.playwright-mcp/drone-candidates.png` (локальный снимок).

### Эффекты (текстуры частиц)

| Статус | Пак | Что внутри | Лицензия |
|---|---|---|---|
| 🟡 рекомендую | [Kenney — Particle Pack](https://kenney.nl/assets/particle-pack) | 80 текстур: вспышки, искры, свечения, дым, магия | CC0 |
| 🟡 | [Kenney — Smoke Particles](https://kenney.nl/assets/smoke-particles) | Дым и пыль для взрывов | CC0 |
| 🟡 | Свои шейдеры (`game/assets/effects/`) | Щит (fresnel), вспышка попадания, ударная волна, луч лазера | Наши |

### Фон: космос, туманности, планеты

| Статус | Источник | Как используем | Лицензия |
|---|---|---|---|
| 🟡 рекомендую | [space-3d (wwwtyro)](https://github.com/wwwtyro/space-3d) | Браузерный генератор космических сцен: звёзды, туманности, солнца → кубмапа для скайбокса | Код — Unlicense (public domain), картинки генерируем сами |
| 🟡 | Свой шейдер туманности | Процедурный скайбокс прямо в Cocos (анимированный, своя палитра на сектор) | Наш |
| 🟡 | Процедурные планеты | Icosphere с шумом и vertex colors — уникальные low-poly планеты | Наши |
| 🟡 | Планеты из Ultimate Space Kit | Готовые модели | CC0 |

### UI и шрифты

| Статус | Источник | Что внутри | Лицензия |
|---|---|---|---|
| 🟡 рекомендую | [Kenney — UI Pack Sci-Fi](https://kenney.nl/assets/ui-pack-sci-fi) | 130 элементов sci-fi интерфейса | CC0 |
| ✅ выбран (Orbitron) | [Google Fonts](https://fonts.google.com): Orbitron, Exo 2, Rajdhani, Audiowide | Шрифты для заголовков и HUD | SIL OFL |

### Звук

| Статус | Пак | Что внутри | Лицензия |
|---|---|---|---|
| ✅ выбран (этап 6) | [Kenney — Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | 70 звуков: лазеры, двигатели, космос | CC0 |
| ✅ выбран (этап 6) | [Kenney — Impact Sounds](https://kenney.nl/assets/impact-sounds) | 130 звуков ударов (попадания, обломки) | CC0 |
| ✅ выбран (этап 6) | [Kenney — Interface Sounds](https://kenney.nl/assets/interface-sounds) | 100 звуков интерфейса | CC0 |
| 🟡 | [rubberduck — 50 CC0 retro/synth SFX](https://opengameart.org/content/50-cc0-retro-synth-sfx) | Ретро-синт: выстрелы, взрывы, пикапы | CC0 |
| 🟡 | [63 Digital SFX (OpenGameArt)](https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc) | Лазеры, фазеры, космос | CC0 |
| 🟡 | [Juhani Junkala — 512 SFX](https://archive.org/details/TheEssentialRetroVideoGameSoundEffectsCollection512Sounds) | Ретро-звуки (подойдут для UI) | CC0 |
| 🟡 | [Mixkit — Space Shooter SFX](https://mixkit.co/free-sound-effects/space-shooter/) | Звуки для шутеров | Mixkit Free License |

### Музыка

| Статус | Источник | Комментарий | Лицензия |
|---|---|---|---|
| ✅ выбран (этап 6) | [SketchyLogic — NES Shooter Music](https://opengameart.org/content/nes-shooter-music-5-tracks-3-jingles) | Famitracker-чиптюн для NES-шмапа: 5 треков (босс с интро), 3 джингла; пользователь — фанат музыки Battletoads & Double Dragon | CC0 |
| 🟡 | [Oblidivm — Space Shooter Music](https://opengameart.org/content/space-shooter-music) | 11 петель для космошутера (хаус 90-х + синты 80-х): титул, меню, босс, победа, поражение, 6 боевых — запасной вариант | CC-BY 3.0 |
| 🟡 | [SubspaceAudio — 5 Chiptunes (Action)](https://opengameart.org/content/5-chiptunes-action) | Чиптюн в духе Amiga/Turrican | CC0 |
| 🟡 | [wyver9 — Arcade Boss tracks](https://opengameart.org/content/arcade-boss-tracks-8-bitchiptune) | Босс-треки «в стиле Battletoads» (LSDj, Game Boy) | CC-BY-SA 3.0 |
| 🟡 | [Pixabay Music](https://pixabay.com/music/search/space/) | Большой выбор (synthwave, ambient, epic); атрибуция не обязательна | [Pixabay Content License](https://pixabay.com/service/license-summary/) |
| 🟡 | [OpenGameArt — музыка](https://opengameart.org/art-search-advanced?field_art_type_tid%5B%5D=12) | Фильтровать по CC0 / CC-BY | По треку |
| 🟡 | [Soundimage (Eric Matyas)](https://soundimage.org/sci-fi/) | Много sci-fi треков | Бесплатно **с атрибуцией** |

### AI-генерация (только если не хватит бесплатного)

[Meshy](https://www.meshy.ai/features), [Tripo](https://www.tripo3d.ai/) (3D), [Retro Diffusion](https://retrodiffusion.ai/), PixelLab, Scenario (2D). Коммерческие права на результат дают **только платные тарифы**. Это противоречит критерию «бесплатно», поэтому сейчас **не используем**.

## Допустимые лицензии

| ✅ Можно | ⚠️ Можно с атрибуцией | ❌ Нельзя |
|---|---|---|
| CC0, Unlicense, Public Domain, Pixabay License, Mixkit Free License, SIL OFL (шрифты) | CC-BY 3.0/4.0 (запись в Credits и экран «Credits» в игре) | CC-BY-NC (NonCommercial), CC-BY-ND (NoDerivatives), «free for personal use», рипы из чужих игр, лицензия неясна |

## Пайплайн импорта

1. **Скачать** во временную папку (scratchpad), выбрать только нужные файлы. Целые паки в репозиторий не тащим.
2. **3D-модели:**
   - Формат **glTF/glb**.
   - Нос смотрит в **−Z**, pivot в центре.
   - Масштаб: корабль игрока около 1 юнита, враги 0.6–2, боссы 4–8.
   - Бюджет треугольников — в [ARCHITECTURE.md §13](ARCHITECTURE.md#13-бюджеты-производительности-iphone-safari-60-fps).
   - Материалы из пака заменяем своими (палитра и emissive).
3. **Текстуры:** ≤ 1024², UI собираем в атлас. Текстуры кораблей — 512² JPEG (корабль занимает ~150 px на экране телефона), это делает `npm run build:ships`.
4. **Аудио:** `npm run build:audio` (`tools/assets/build-audio.mjs`, ffmpeg) из паков в `art-source/` → `game/assets/resources/audio/{sfx,music}`. Всё моно. Частые короткие эффекты (выстрелы, попадания, тики, UI) и петля луча — WAV 32 кГц: mp3 начинается с ~25 мс задержки кодера, она размазывает скорострельность и щёлкает на шве петли; остальное — mp3 80 kbps, музыка — mp3 96 kbps. У эффекта 1–4 варианта (вырезка, сдвиг высоты, наложение, фейды, пик −1 dBFS); громкость — в `data/audio.ts`.
5. **Размещение:** `game/assets/models/<source>/…`, `game/assets/audio/<sfx|music>/…`, `game/assets/textures/<source>/…`. Импорт выполняет редактор (появляется `.meta`), `.meta` коммитим вместе с файлом.
6. **Credits:** строка в таблице ниже. Для CC-BY — ещё и в экран Credits в игре.
7. **Статус** кандидата в этом документе меняем на ✅.

## Credits (что реально используется в игре)

| Ассет | Автор | Источник | Лицензия | Где в проекте |
|---|---|---|---|---|
| Ultimate Spaceships Pack: корабли игрока Spitfire, Executioner, Striker (Orange, Blue, Green — этап 4); враги Bob (Red), Dispatcher (Red; Purple — этап 7), Challenger (Purple — Gunship; Red — мини-босс Marauder), Imperial (Orange, перекрашен в красный — мини-босс Dreadnought; Purple — этап 7); этап 7: Omen, Pancake, Zenith (Purple и Red), Insurgent (Purple) | Quaternius | [quaternius.com](https://quaternius.com/packs/ultimatespaceships.html) | CC0 | `game/assets/resources/models/ships/*.glb` (обработаны `tools/assets/build-ships.mjs`) |
| Space Kit: platform_large, hangar_smallA, corridor_detailed, machine_generatorLarge, satelliteDish_large, structure_detailed, turret_single, turret_double; этап 3: hangar_roundGlass, hangar_roundA, hangar_largeA, platform_high, machine_barrelLarge, pipe_ring, supports_high, rock_crystalsLargeA, craft_cargoA; этап 7: machine_barrelLarge и pipe_ring ещё раз — в красной палитре турелей (сегменты Leviathan) | Kenney | [kenney.nl](https://kenney.nl/assets/space-kit) | CC0 | `game/assets/resources/models/props/station_*.glb`, `turret_*.glb`, `hull_*.glb` (обработаны `tools/assets/build-props.mjs`) |
| Orbitron (Bold 700, Black 900; латиница) | The Orbitron Project Authors (Matt McInerney) | [Google Fonts](https://fonts.google.com/specimen/Orbitron), файлы с [Fontsource](https://fontsource.org/fonts/orbitron) | SIL OFL 1.1 | `game/assets/fonts/Orbitron-*.ttf`, лицензия рядом — `Orbitron-OFL.txt` |
| Ultimate Space Kit: Bullets Pickup, Pickup Health, Pickup Sphere, Pickup Thunder | Quaternius | [poly.pizza](https://poly.pizza/bundle/Ultimate-Space-Kit-YWh743lqGX) | CC0 | `game/assets/resources/models/props/pickup_*.glb` (обработаны `tools/assets/build-props.mjs`) |
| NES Shooter Music: Map (меню), Mercury, Venus, Mars (миссии 1-1…1-3), BossIntro + BossMain (босс), Intro Jingle (старт миссии), Win Jingle (победа), Warp Jingle (Time Warp) | SketchyLogic | [OpenGameArt](https://opengameart.org/content/nes-shooter-music-5-tracks-3-jingles) | CC0 | `game/assets/resources/audio/music/*.mp3`, `audio/sfx/warp_0.mp3` (`npm run build:audio`) |
| Sci-fi Sounds, Impact Sounds, Interface Sounds: выстрелы, попадания, взрывы, щит, пикапы, Special, UI; этап 7 — заряд и выстрел вражеского лазера, взвод мины, выпуск роя | Kenney | [kenney.nl](https://kenney.nl/assets/sci-fi-sounds), [Impact](https://kenney.nl/assets/impact-sounds), [Interface](https://kenney.nl/assets/interface-sounds) | CC0 | `game/assets/resources/audio/sfx/*` (`npm run build:audio`) |

Процедурные ресурсы (свои, без сторонних лицензий): текстуры свечения, кольца и вражеских пуль (`fx/RenderKit.ts`), туманность, запекаемая при старте (`core/nebula.ts`; своя палитра на сектор), сирена WARNING (двухтональная квадратная волна, `build-audio.mjs`), мина с шипами (`core/rock.ts: buildMine`), лёд и ледяная луна (те же процедурные камни в ледяном материале), облака газа (плоскости свечения).

Свои процедурные модели (пользователю понравились, остаются): астероиды — low-poly камень (`core/rock.ts`); кредиты — золотые кубики.

**Выбор этапа 2** (пользователь делегировал: «на твой вкус, главное производительность»):
- **Kenney Space Kit** — модули станций (`platform_large`, `hangar_smallA`, `corridor_detailed`, `machine_generatorLarge`, `satelliteDish_large`, `structure_detailed`), турели (`turret_single`, `turret_double`) и дроны (`craft_speederA`, `satelliteDish_detailed`, `craft_miner`). 76–876 треугольников, у турели отдельная поворотная башня.
- **Quaternius Ultimate Space Kit** — иконки пикапов: Bullets → P, Health → R, Sphere → S (красная сфера перекрашена в голубой: красный — цвет врагов), Thunder → E. Тот же автор, что и корабли.
- **Конвейер** `npm run build:props` (`tools/assets/build-props.mjs`): каждая модель → один меш с вершинными цветами, без текстур. Kenney-материалы (metal, metalDark, dark, metalRed) перекрашиваются в тёмную палитру (светлые серые под HDR-солнцем уходят в белое), у турелей акцент — красный; цвета пикапов берутся из атласа Quaternius. В игре все пропсы рисуются одним инстансируемым материалом (`RenderKit.props()`).
- Исходники: `art-source/kenney-space-kit/` (все GLB пака и `License.txt`), `art-source/quaternius-ultimate-space-kit/pickup_*.glb` (скачаны с poly.pizza: Bullets Pickup, Pickup Health, Pickup Sphere, Pickup Thunder).

**Выбор этапа 3** (пользователь выбрал из вариантов):
- **Warden** — собран из модулей Kenney Space Kit, как станции: купол `hangar_roundGlass` — ядро, трубы `pipe_ring`, площадки `platform_high` под двумя турельными модулями `turret_double`, решётки `supports_high`, баки `machine_barrelLarge`, огни. Сборка описана данными (`look: assembly` в `data/enemies.ts`).
- **Dreadnought** — Imperial из пака Quaternius. Красной расцветки у нас нет (скачаны только Blue, Green, Orange), поэтому `build-ships.mjs` перекрашивает Orange: оранжевые тона → красный с затемнением, серые темнее (как в Red-вариантах пака). Бортовые пушки — `turret_double` Kenney.
- **Шрифт Orbitron** — логотип, заголовки, баннеры, кнопки. Bold 700 и Black 900, латинский сабсет (~16 KB каждый). Цифры HUD пока системным жирным.
- Новые модули Kenney для станций Сектора 1 (refinery, depot, bastion) Claude выбрал сам — в рамках делегирования этапа 2 («станции и турели на твой вкус»).
- **Дроны (этап 5)** — Kenney Space Kit, выбрал Claude по поручению пользователя («подбери релевантные»): Gun Drone — истребитель `craft_speederA` (280 треугольников), Guardian — тарелка-излучатель `satelliteDish_detailed` (390), Collector — шахтёрский `craft_miner` с захватами (384). В `build-props` (`drone_gun`, `drone_guardian`, `drone_collector`): тёмная палитра станций, акцент — цвет дрона (синий, циан, золото), не красный; модель нормализована к 1, размер в игре — `DRONES[].size`. Под моделью — ореол цвета дрона, чтобы тёмный корпус читался на фоне космоса.
- **Иконки PWA** — свой рендер Spitfire из игры (`game/build-templates/web-mobile/icons/`).
- Escape Pod — процедурная капсула из примитивов `RenderKit`, декор астероидных полей — те же процедурные камни, что у астероидов.

**Выбор этапа 6** (пользователь выбрал из вариантов):
- **Музыка** — пользователь: «фанат Battletoads & Double Dragon (NES), если получится похожее — буду рад, если нет — вариант №1 (Oblidivm)». Claude нашёл SketchyLogic «NES Shooter Music»: CC0, Famitracker (те же каналы 2A03, что у NES), написана для NES-шмапа. Источники — `art-source/sketchylogic-nes-shooter-music/` (WAV и .ftm).
- **SFX** — Kenney (выбор пользователя). Исходники — `art-source/kenney-{sci-fi,impact,interface}-sounds/` с `License.txt`. Какие файлы куда — таблица `SFX` в `tools/assets/build-audio.mjs`.
- Экран **Credits** в игре (Settings → CREDITS) — `data/credits.ts`.

**Выбор этапа 7** (пользователь делегировал: «на твой выбор, может где-то проще подобрать текстуры и прочее» — про выбор двух секторов из четырёх):
- **Секторы 2 и 3** — у них проще всего с ассетами: роли их врагов (Omen, Pancake, Zenith) подтверждены ещё на этапе 0 и лежат в уже выбранном паке Quaternius; лёд — свои процедурные камни в другом материале; туманность — другая палитра запекания. Секторам 4–5 нужны были бы обломки кораблей, инопланетная мегаструктура и ИИ аса-дуэлянта.
- **Докачано из официальной папки пака** (Google Drive, `gdown`): glTF Omen, Pancake, Zenith, Insurgent и текстуры Purple/Red (у Imperial — Purple и Red). Исходники — `art-source/quaternius-ultimate-spaceships/<Ship>/`.
- **Боссы и мини-боссы** — те же модели крупнее и в другой расцветке (Cyclone, Shatterer, Hive Mother, Arbiter, Broodship, голова Leviathan); сегменты Leviathan — модули Kenney в палитре турелей. Никаких новых паков.
- **Музыка** — новых треков нет: миссии секторов 2–3 играют Mercury, Venus, Mars. Новая музыка для секторов — по выбору пользователя, если захочется.
