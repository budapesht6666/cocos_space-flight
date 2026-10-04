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
| 🟡 рекомендую | [Quaternius — Ultimate Space Kit](https://poly.pizza/bundle/Ultimate-Space-Kit-YWh743lqGX) | 87 моделей: корабли, мехи, инопланетяне, **планеты, камни**, постройки, **пикапы** (здоровье, патроны, молния, ящики); FBX, glTF | CC0 |
| 🟡 | [Kenney — Space Kit](https://kenney.nl/assets/space-kit) | 150 моделей: корабли, камни, **станции и конструкции** (для «земли» уровня и турелей) | CC0 |
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
| Challenger | Gunship, Purple; Red и крупнее — мини-босс Marauder (s1m1, временно) | ✅ подтверждено |
| Omen | Splitter, Purple | ✅ подтверждено |
| Zenith | Lancer (снайпер: длинный ствол), Red | ✅ подтверждено |
| Pancake | Spinner (тарелка с кольцами пуль), Purple | ✅ подтверждено |
| Imperial | Carrier и Frigate, Red | ✅ подтверждено |
| Insurgent | Bulwark (тяжёлый, 8.3k треугольников), Purple | ✅ подтверждено |

Враги — только в Red и Purple, игрок — в Orange, Blue и Green (см. GDD §6).

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
| 🟡 рекомендую | [Google Fonts](https://fonts.google.com): Orbitron, Exo 2, Rajdhani, Audiowide | Шрифты для заголовков и HUD | SIL OFL |

### Звук

| Статус | Пак | Что внутри | Лицензия |
|---|---|---|---|
| 🟡 рекомендую | [Kenney — Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | 70 звуков: лазеры, двигатели, космос | CC0 |
| 🟡 рекомендую | [Kenney — Impact Sounds](https://kenney.nl/assets/impact-sounds) | 130 звуков ударов (попадания, обломки) | CC0 |
| 🟡 | [63 Digital SFX (OpenGameArt)](https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc) | Лазеры, фазеры, космос | CC0 |
| 🟡 | [Juhani Junkala — 512 SFX](https://archive.org/details/TheEssentialRetroVideoGameSoundEffectsCollection512Sounds) | Ретро-звуки (подойдут для UI) | CC0 |
| 🟡 | [Mixkit — Space Shooter SFX](https://mixkit.co/free-sound-effects/space-shooter/) | Звуки для шутеров | Mixkit Free License |

### Музыка

| Статус | Источник | Комментарий | Лицензия |
|---|---|---|---|
| 🟡 рекомендую | [Pixabay Music](https://pixabay.com/music/search/space/) | Большой выбор (synthwave, ambient, epic); атрибуция не обязательна | [Pixabay Content License](https://pixabay.com/service/license-summary/) |
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
4. **Аудио:** `.mp3` (надёжно для Safari и iOS). SFX моно, короткие; музыка 128–160 kbps.
5. **Размещение:** `game/assets/models/<source>/…`, `game/assets/audio/<sfx|music>/…`, `game/assets/textures/<source>/…`. Импорт выполняет редактор (появляется `.meta`), `.meta` коммитим вместе с файлом.
6. **Credits:** строка в таблице ниже. Для CC-BY — ещё и в экран Credits в игре.
7. **Статус** кандидата в этом документе меняем на ✅.

## Credits (что реально используется в игре)

| Ассет | Автор | Источник | Лицензия | Где в проекте |
|---|---|---|---|---|
| Ultimate Spaceships Pack: Spitfire (Orange), Bob (Red), Dispatcher (Red), Challenger (Purple — Gunship; Red — мини-босс Marauder) | Quaternius | [quaternius.com](https://quaternius.com/packs/ultimatespaceships.html) | CC0 | `game/assets/resources/models/ships/*.glb` (обработаны `tools/assets/build-ships.mjs`) |

Процедурные ресурсы (свои, без сторонних лицензий): текстуры свечения, кольца и вражеских пуль (`fx/RenderKit.ts`), туманность, запекаемая при старте (`core/nebula.ts`).

**Плейсхолдеры этапа 2** (ждут выбора пользователя): астероиды — процедурный low-poly камень (`core/rock.ts`); станции и турели — кубы и цилиндры (`data/setPieces.ts`, `entities/EnemyView.ts`); значки пикапов P/R/S/E — буквы 5×7 на круге (`core/glyphs.ts`), кредиты — золотые кубики. Кандидаты на замену: Kenney Space Kit (станции, камни), Quaternius Ultimate Space Kit (камни, пикапы).
