# CLAUDE.md — Space Flight

Вертикальный 2.5D shoot 'em up (low-poly 3D, камера сверху) на **Cocos Creator 3.8 LTS** + TypeScript. Кампания — 3 сектора по 3 миссии (этап 7 урезал план с пяти до трёх).
Разработка web-first: игра собирается как `web-mobile`, тестируется в браузере и на iPhone через Safari.

**Бюджет — $0** (пет-проект). Никаких платных сервисов, подписок, ассетов и аккаунтов.
- Основной релиз — **PWA** на своём VPS пользователя (уже оплачен под другие проекты): https://spaceflight.p1gog.duckdns.org/
- Нативная iOS — **только на свой iPhone**: облачный macOS (бесплатные минуты) собирает неподписанный `.ipa`, Sideloadly ставит его с обычным Apple ID.
- App Store и TestFlight ($99/год) **вне рамок**. Фичи, требующие платного Apple-аккаунта (Game Center, push, iCloud), не используем.

Разработка на Windows, **Mac нет**.

## Источники истины

| Документ | Что в нём |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Текущий этап, чек-листы, критерии приёмки. **Отмечай прогресс** |
| [docs/GDD.md](docs/GDD.md) | Механики, контент, стартовый баланс |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Устройство кода, системы, бюджеты производительности |
| [docs/ASSETS.md](docs/ASSETS.md) | Кандидаты ассетов, лицензии, пайплайн импорта, Credits |
| [docs/BALANCE.md](docs/BALANCE.md) | Таблица баланса арсенала и экономики — **генерируется** `npm run balance`, руками не править |
| [docs/PLATFORMS.md](docs/PLATFORMS.md) | Платформы, особенности iOS Safari, iOS без Mac, CLI-сборка |

Изменилось решение — обнови соответствующий документ в том же шаге.

## Работа с пользователем

- Отвечать **по-русски**. Игровой текст, идентификаторы, комментарии в коде и сообщения коммитов — **на английском**. Игра только на английском.
- Режим **максимальной автономии**: этапы делаются целиком, мелочи не спрашиваем. Объяснения короткие, в конце этапа. Пользователь даёт фидбек по результату (скриншоты, игра на iPhone).
- **Ассеты и визуальные решения** (стиль, модели, звук, музыка) предлагаем вариантами (2–4, со ссылками и лицензиями), выбирает пользователь. Без его выбора в проект попадают только плейсхолдеры из примитивов.
- Ассеты только **бесплатные** с разрешающей лицензией (см. ASSETS.md).
- Коммиты — по запросу пользователя, **прямо в `main`**, без веток. В конце этапа предлагай коммит. Push — только по просьбе.
- **Коммит в `main`, который трогает `game/`, `build-configs/` или `site/`, сразу выкатывает игру на сайт** (git-хук `post-commit`, ~40 с; PLATFORMS.md «PWA»). Перед таким коммитом — typecheck, тесты, плейтест. Разово без выкатки: `SKIP_DEPLOY=1 git commit …`.

## Окружение

- Windows 11, PowerShell (основной) и Git Bash. Node 24, npm. `gh` CLI не установлен: GitHub — через GitHub MCP.
- Cocos Creator **3.8.8**: `C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe`. Cocos Dashboard 2.2.2.
- Проект Cocos лежит в `game/`. Корень репозитория — документация, тулинг (`package.json`, `vitest.config.ts`), `tests/`, `tools/`, `build-configs/`.
- `game/tsconfig.json` — наш (strict, `skipLibCheck`: `cc.d.ts` ссылается на WebGPU-типы, которых нет). `game/temp/tsconfig.cocos.json` генерирует редактор, не трогать.
- Cocos при создании проекта делает свой `git init` в `game/`. Вложенный `.git` удалён: репозиторий один, в корне.
- Терминал VS Code (и Claude Code в нём) выставляет `ELECTRON_RUN_AS_NODE=1` — с ней `CocosCreator.exe` из командной строки стартует как Node (`bad option: --project`). Для CLI снимать переменную.
- Сцены: `Menu` (стартовая в сборке: меню и ангар — `ui/StartScreen.ts` и страницы) и `Game`. Превью играет сцену, открытую в редакторе; из Menu ссылка с `?mission=` сразу запускает игру.
- Без MCP редактор пересобирает скрипты, только когда его окно получает фокус: переключить фокус на VS Code и обратно (PowerShell, `WScript.Shell.AppActivate`), дождаться новых файлов в `game/temp/programming/packer-driver/targets/preview/chunks`.

## Команды

| Задача | Команда |
|---|---|
| Unit-тесты | `npm test` (Vitest, ищет только `tests/**/*.test.ts`) |
| Typecheck | `npm run typecheck` (= `tsc --noEmit -p game/tsconfig.json`; нужен `game/temp/`, который создаёт редактор) |
| Превью | Редактор открыт → `http://localhost:7456` (сервер превью живёт, пока открыт редактор) |
| На iPhone | QR у IP-адреса в тулбаре редактора, та же Wi‑Fi |
| Релизная сборка (редактор открыт) | cocos MCP, контекст `editor`: `Editor.Message.request('builder', 'add-task', args.options)`, где `options` — содержимое `build-configs/web-mobile.json`, переданное через `args` (safety checks MCP не пускают читать файлы вне `game/`); прогресс — `'query-tasks-info'`. ~20 с, результат в `game/build/web-mobile` (≈13 MB, из них звук 3 MB; с PWA-шаблоном из `game/build-templates/web-mobile`) |
| Релизная сборка (CLI) | без `ELECTRON_RUN_AS_NODE`: `"C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe" --project game --build "configPath=<абсолютный путь>\build-configs\web-mobile.json"`. Код выхода **36 = успех**. Не на проекте, открытом в редакторе (проверено на копии) |
| Выкатить на сервер | само при коммите в `main` (хук `tools/hooks/post-commit`, на новом клоне — `npm run hooks:install`). Вручную: `npm run release:web` (CLI-сборка на зеркале `.cache/cli-game` + выкатка) или `npm run deploy:web` (выкатить сборку из редактора). → https://spaceflight.p1gog.duckdns.org/, `ssh vps`; устройство — PLATFORMS.md «PWA», скилл `vps-ops` |
| Демо одним HTML-файлом (BingePlay) | `npm run build:playable` → `.cache/playable/space-flight-demo.html` (~5.4 MB; редактор может быть открыт), на телефон — `npm run serve:playable`. Что в демке — `data/demo.ts`; устройство — PLATFORMS.md «Демо одним файлом» |
| Заходы на сайт | `npm run stats:web` (`-- --days 7`): журнал Caddy с 2026-10-17, по дням — игра, `/about/`, уникальные IP, устройства, откуда пришли (PLATFORMS.md «PWA») |
| CLI-сборка без выкатки | `npm run build:web` → `.cache/cli-game/build/web-mobile` (редактор может быть открыт) |
| Нативная iOS (`.ipa` без подписи) | само на GitHub Actions (`.github/workflows/ios.yml`, macOS) при push в `main` с изменениями в `game/`, `build-configs/ios.json`, `tools/ci/`; вручную — Actions → iOS build → Run workflow. Результат — пре-релиз `ios-latest`, ставится Sideloadly со своим Apple ID. Шаблон приложения — `game/native/engine/` (иконки — `build:web-art`). Подробно — PLATFORMS.md «Нативная iOS» |
| Android-приложение (APK) | само на GitHub Actions (`.github/workflows/android.yml`, macOS) при push в `main` с изменениями в `game/`, `build-configs/android.json`, `tools/ci/`; вручную — Actions → Android build. Подпись — ключ из секретов репозитория (локально `.secrets/android/`, вне git, **не терять**). Результат — пре-релиз `android-latest`, ссылка на странице игры. Шаблон — `game/native/engine/android`. Подробно — PLATFORMS.md «Android» |
| Раздать сборку на iPhone по Wi‑Fi | `npm run serve:web` (CLI-сборка из `.cache/cli-game`; другую папку — `python tools/serve_web.py <папка>`). Отдаёт с `Cache-Control: no-store`: голый `python -m http.server` позволяет браузеру закэшировать `index.html`, и после пересборки грузится старый бандл. Python 3.12 разрешён брандмауэром; на телефоне `http://192.168.1.43:8080/?debug=1` |
| Модели кораблей | `npm run build:ships` (`tools/assets/build-ships.mjs`; исходники пака — в `art-source/`, вне git) |
| Пропсы: станции, турели, иконки пикапов | `npm run build:props` (`tools/assets/build-props.mjs`: вершинные цвета, один меш на модель; исходники — в `art-source/`) |
| Звук: эффекты и музыка | `npm run build:audio` (`tools/assets/build-audio.mjs`, нужен `ffmpeg`; исходники паков — в `art-source/`, вне git; что из чего — таблицы `SFX`/`MUSIC` в скрипте, громкость — `data/audio.ts`) |
| Картинки веб-страницы: заставка, стартовые экраны iPhone, фавикон | `npm run build:web-art` (`tools/assets/build-web-art.mjs` из `tools/web-art/logo.png` — рендер `logo.html`, см. его шапку) |
| Страница игры | `site/about/` → `/about/`; в сборку и выкатку кладётся сама (`tools/lib/site.mjs`); медиа — скилл `playtest`, «Медиа для страницы игры» |
| Ролик для YouTube Shorts | `npm run youtube:capture` → `youtube:mix` → `youtube:cut` (`youtube/`, нужна `npm run build:web`): покадровая съёмка 1080×1920 60 к/с из игры, звук игры кадр в кадр, простой Short ≤ 30 с; вирусный монтаж — в проекте `remotion-skill` (`C:/projects/claude/remotion-skill`) по `youtube/REMOTION_PROMPT.md`. Подробно — `youtube/README.md` |
| Таблица баланса | `npm run balance` → `docs/BALANCE.md` (DPS по ситуациям, время убийства, доход, цены). Перегенерировать после правки оружия, врагов, миссий, цен; инварианты — `tests/core/balance.test.ts` |

## MCP-серверы и скиллы

- **context7** — документация. Cocos 3.8: `/websites/cocos_creator_3_8_manual_en`; исходники и API движка: `/cocos/cocos-engine`. Сверяйся перед незнакомым API: в интернете много примеров для Cocos 2.x (`cc.Class`, глобальный `cc.`, `cc.find`), в 3.x они не работают.
- **cocos** (Funplay MCP 0.6.4) — сцены, узлы, компоненты, префабы, ассеты, запуск превью, скриншоты Game View, `execute_javascript` в контексте сцены и редактора.
  - Расширение лежит в `game/extensions/funplay-cocos-mcp` и **в git не входит** (это сторонний JS-код, не код игры). Установка на новой машине: `git clone --depth 1 https://github.com/FunplayAI/funplay-cocos-mcp.git game/extensions/funplay-cocos-mcp`, затем перезапустить редактор. Проверено с версией 0.6.4 (commit `35b99d0`).
  - Если сессия Claude Code стартовала раньше редактора, сервер `cocos` будет `ECONNREFUSED`. Тогда открыть редактор и переподключить сервер через `/mcp`.
  - Конфиг: `game/funplay-cocos-mcp.config.json` — порт **28456**, профиль `full`. В `.mcp.json` это HTTP `http://127.0.0.1:28456/`.
  - Работает, только пока открыт редактор. Если редактор закрыт — попроси пользователя открыть.
- **playwright** (`.mcp.json`) — браузерные плейтесты: окно 390×844, `--caps vision` (клики и драги по координатам на canvas), консоль. Скриншоты пишутся в `.playwright-mcp/`.
- **github** — операции с репозиторием.
- Скиллы проекта: `playtest` (запустить и проверить игру, полный прогон миссии автопилотом), `add-asset` (найти, проверить лицензию, импортировать, записать Credits), `add-enemy`, `add-mission`, `add-weapon` (оружие, дроны, Special — правкой данных, с таблицей баланса).

## Правила кода

- **Cocos 3.x API:** импорты только из `'cc'`; `@ccclass('Name')` — уникальное имя, совпадает с именем класса и файла.
- **Слои:**
  - `scripts/core/` и `scripts/data/` **не импортируют `'cc'`** (чистый TS, покрыт Vitest).
  - `scripts/game/` — системы.
  - `scripts/entities/` — представления.
  - `scripts/ui/`, `scripts/services/`, `scripts/fx/`, `scripts/debug/`.
- **Симуляция** — только через `GameWorld` с фиксированным шагом 1/60. Сущности имеют `tick(dt)`; собственные `update()` у игровых компонентов не используем (кроме чисто визуальных эффектов).
- **Горячий код без аллокаций:** переиспользуй временные `Vec3`/`Quat`, никаких замыканий, массивов, `new` в per-frame коде. Сборщик мусора даёт фризы в iOS Safari.
- **Пулы:** в геймплее нет `instantiate`/`destroy`, только `core/Pool`.
- **Кэш:** никаких `find()`/`getComponent()` в цикле. Кэшировать в `onLoad`/`start`.
- **Данные:** все тюнинги — в типизированных модулях `scripts/data/*.ts`, магических чисел в компонентах нет. Новый контент — правка данных, а не нового кода.
- **Координаты:** игровая плоскость XZ (y = 0), «вверх по экрану» = −Z, ширина поля 10 юнитов.
- **Связи** между системами — через типизированный `EventBus`, а не прямые ссылки.
- TypeScript strict; без `any` без явной причины.

## Файлы Cocos — осторожно

- У каждого ассета есть `.meta` с UUID. Коммитить вместе с ассетом, UUID руками не править.
- Переименование и перемещение ассетов — только через редактор или MCP, иначе ломаются ссылки.
- Ссылки на ассеты в свойствах компонентов (шрифт, эффект) ставить через `Editor.Message.request('scene', 'set-property', { uuid, path: '__comps__.N.prop', dump: { type: 'cc.TTFFont', value: { uuid } } })`, затем `save-scene`. `set_component_property` из MCP пишет `{ "uuid" }` вместо `__uuid__` — такая ссылка не работает.
- `.scene`, `.prefab`, `.anim`, `.mtl` — сериализованный JSON со ссылками по UUID. Правим **через MCP или редактор**. Ручная правка — крайняя мера, с проверкой открытием в редакторе.
- Не трогать сгенерированное: `game/library/`, `game/temp/`, `game/local/`, `game/build/`, `game/profiles/`.
- `refresh_assets` из MCP вызывать **с путём** (`assets/scripts`): без пути он создаёт мусорный `game/assets/.meta` — удалить, не коммитить.
- Новый сторонний ассет — сразу строка в Credits ([docs/ASSETS.md](docs/ASSETS.md)). Порядок — скилл `add-asset`.

## Проверка перед словом «готово»

1. `npm run typecheck` — без ошибок.
2. `npm test` — зелёный.
3. Превью запускается, в консоли нет ошибок. Скриншот через cocos MCP или playwright (скилл `playtest`).
4. Для геймплейных изменений — короткий плейтест (движение, стрельба, получение урона) и FPS из `?debug=1`.
5. Обновлён [docs/PLAN.md](docs/PLAN.md).

Что проверить не удалось (например, редактор закрыт) — прямо так и скажи.

## Производительность (iPhone, Safari, 60 FPS)

- Draw calls ≤ 100, пули через GPU-инстансинг.
- ≤ 150k треугольников в кадре: корабль игрока ≤ 5k, враг ≤ 3.5k, тяжёлый враг ≤ 9k (не больше 2 на экране), босс ≤ 10k.
- ≤ 500 пуль одновременно; текстуры ≤ 1024².
- Один directional light, без realtime-теней. Bloom только на качестве Medium/High.

## Отладка (URL-параметры превью и debug-сборок)

`?debug=1` (оверлей), `?god=1`, `?power=4`, `?t=90` (перемотка часов миссии, без интро), `?seed=7`, `?slowmo=0.25` (0.05…4), `?mission=s1m1` (s1m1–s3m3; из Menu — сразу в игру), `?difficulty=hard` (normal, hard, insane, nightmare), `?elite=1` / `?elite=volatile` (каждый враг волны — элита), `?unlock=1` (открыты все секторы, миссии, сложности и корабли), `?credits=50000` (кошелёк = 50 000, раз за загрузку страницы; **только на dev-хостах** — localhost, 127.x, домашняя сеть, file://; на публичном сайте игнорируется, этап 10), `?reset=1` (стереть прогресс, раз за загрузку страницы, тоже только dev-хосты; с `credits` — сначала стирает), `?quality=high` (фиксированный уровень качества: ultra, high, medium, low, lowest), `?scale=0.5` (фиксированное разрешение 3D), `?msaa=0`, `?bloom=0`, `?fxaa=1` (A/B на телефоне; по умолчанию bloom вкл., FXAA выкл., MSAA — по уровню), `?primary=ion&secondary=rail&drones=gunDrone,guardian&special=warp&level=5` (любое снаряжение без покупки; `secondary=none`; ids — ARCHITECTURE §12), `?ship=executioner` (любой корабль).
Прогоны с `god`, `t`, `power`, `elite`, `slowmo`, `unlock`, `ship` и флагами снаряжения — practice: рекорды, медали и кредиты не пишутся. Сохранение — localStorage `spaceflight.save` (сброс: `localStorage.clear()`), настройки — `spaceflight.settings`.
Чит-коды (меню → CHEATS, пишутся в сохранение, не practice): `p1gog.weapon` — весь арсенал открыт и куплен на LV1, `p1gog.credits` — +50 000.
Клавиши в превью: стрелки/WASD, Space — Special (Nova Bomb и др.), Esc/P — пауза, Enter — тап и RETRY на результатах. Меню: Enter — старт с титула и CONTINUE, Esc/Backspace — назад, 1–3 — страница миссии Сектора 1; в кампании ←/→ — сектор, на странице миссии ←/→ — сложность и Enter — LAUNCH; в ангаре Tab — вкладка, ←/→ — корабль (SHIP) или слот (WEAPONS), Enter — LAUNCH; в настройках ↑/↓ — строка, ←/→ — значение; в читах Enter — APPLY. Держать список актуальным здесь и в ARCHITECTURE §12.

## Рендер — грабли, на которые уже наступили

- Сцена в **HDR-освещении**: unlit-цвета пересвечиваются, поэтому интенсивности свечения идут через `HDR_UNLIT_SCALE` в `fx/RenderKit.ts`. В LDR (`skybox.useHDR = false`) аддитивные unlit-спрайты в этом пайплайне вообще пропадают — не переключать.
- Свободные объекты пулов **парковать** далеко за кадром (`y = -1000`, их отсекает камера), а не переключать `active`. Включение и выключение узла дорогое: модель добавляется в сцену рендера и удаляется из неё, а при взрыве это десятки узлов за кадр. Новые узлы пула парковать сразу, иначе они висят видимыми в начале координат.
- `Label.CacheMode.CHAR` портит жирный шрифт и интервалы — для HUD не использовать.
- Canvas, созданный скриптом, нуждается в `Widget` на все края — иначе остаётся со старым размером.
- На iPhone узкое место — **fill rate** (Retina ×3). Полноэкранный процедурный шейдер туманности уронил FPS до 49: тяжёлое запекаем в текстуру, 3D рендерим в 70% (`shadingScale`). На ПК этого не видно — проверять на телефоне.
- **Ресурсы, созданные в рантайме (`new Material`, `Texture2D`, меши), сцена не освобождает.** Всё общее — в `RenderKit.shared` (один на загрузку страницы), инстансы материалов узлов — через `kit.track` (движок не уничтожает их вместе с рендерером). Иначе каждый переход меню ⇄ игра течёт видеопамятью.
- **Пулы прогревать по замеренному пику**, эффекты в бою не растят пулы (`tryAcquire`): `instantiate` сотни узлов при взрыве босса давал на iPhone провал до 18 FPS.
- **Hitstop — в реальном времени** и не во время slow-mo: в симуляционном времени при ×0.3 стоп-кадр растягивался втрое и ощущался фризом. В slow-mo — укороченный шаг каждый кадр, не фиксированный раз в несколько кадров.
- `shadingScale` на лету меняется только вместе с `rendering.forceResizeAllWindows()` (таргеты пересоздаются при «ресайзе окна»).
- **Баг render graph Cocos 3.8.8 в релизной сборке:** список `pipeline.resourceUses` пуст, и исполнитель в начале каждого кадра удаляет все MANAGED-таргеты (сцена, глубина, bloom), а потом создаёт их заново с framebuffer'ами — 6 штук за кадр, у каждого `gl.checkFramebufferStatus` с остановкой GPU. На iPhone это 13–19 мс Renderer при любом разрешении. В превью редактора бага нет — **сравнивать только на релизе**. Обход — `fx/PipelineFix.ts` (`keepRenderTargets()` в `update` компонентов сцен). Проверка: счётчик `device.createFramebuffer` за кадр должен быть 0 (скилл `playtest`).
- Пост-эффекты: bloom включён, FXAA выключен (`POST_FX` в `data/visuals.ts`: полноэкранный проход, на iPhone разницы не видно). A/B: `?fxaa=1`, `?bloom=0`.
- **Качество — уровнями** (`QUALITY` в `data/visuals.ts`, ARCHITECTURE §11): уровень выбирает игрок (Settings → GRAPHICS), сам он не меняется. По умолчанию десктоп — `ultra` (3D×1 + MSAA), телефон — `medium` (×0.7, как настроен iPhone), WebGL без GPU — `lowest`. Автоподбор по FPS убран на этапе 6: на iPhone он сползал до `lowest` без пользы (упор в CPU движка) и дёргал уровни, а с этим совпадали вспышки увеличенной сцены. Модель GPU браузер не выдаёт (iOS — всегда «Apple GPU»). MSAA и `shadingScale` на лету — только с `forceResizeAllWindows()`.
- **Десктоп — колонка 9:16** (`services/ScreenFit.ts`): в широком окне без неё UI и камера растягивались на ширину — огромные кнопки и полоса поля. Поля вокруг — CSS в `build-templates/web-mobile/style.css` (класс `column` на `<body>`). Превью редактора не меняет рамку при ресайзе окна — ресайз проверять на сборке.
- **Клавиатуру Cocos 3.8 слушает только на канвасе `#GameCanvas`**: пока фокус на странице (ссылка с `?mission=` без единого тапа, клик по полям колонки), стрелки не доходят до игры. `ScreenFit` при первом запуске фокусирует канвас и передаёт ему клавиши, нажатые мимо него. В превью редактора бага не видно — проверять на сборке.
- **Мерить производительность — только на релизной сборке.** Превью редактора — отладочный движок: CPU-время там в разы выше, и в консоли висит ошибка `[Physics] … builtinMaterial`, которой в сборке нет.
- **`for…of` в покадровом коде не использовать:** Babel сборки превращает его в итератор, который создаёт объект `{done, value}` на каждый элемент (`Starfield` так давал 0.25 МБ/с мусора). В tick/render — индексные циклы. Остальные ≈19 МБ/с выделений на релизе — сам движок (render graph каждый кадр), звук на них не влияет.
- **EditBox из кода:** свои `textLabel`/`placeholderLabel` нужны с якорем (0, 1) — EditBox прижимает их верхним левым углом; Sprite он добавляет сам, поэтому рисованный фон — на родителе. Пока идёт ввод, фокус у `<input>` поверх канваса — `ScreenFit` не перехватывает клавиши у полей ввода. `<input>` позиционируется от ближайшего позиционированного предка: в колонке десктопа это был `#GameDiv` во всю ширину, и набранный текст уезжал к левому краю окна — `ScreenFit` делает `#Cocos3dGameContainer` `position: relative`.
- `game/tsconfig.json` переопределяет `moduleResolution` на `bundler`: базовый конфиг редактора задаёт `node` (node10), который TypeScript 6 в VS Code помечает устаревшим; `ignoreDeprecations: "6.0"` не годится — `tsc` 5.9 его отвергает.
- **Звук:** частые эффекты — WAV (у mp3 ~25 мс задержки кодера в начале), петли — тоже WAV. Звук в браузере стартует только после первого касания или клика (Playwright: кликнуть по канвасу). Узел `Audio` переживает сцены (`addPersistRootNode`), состояние дек — `cc.director.getScene().getChildByName('Audio')`, компонент — `getComponent('cc.AudioSource')` (в превью нет глобального `cc.AudioSource`).
- `const enum` не использовать (Babel в Cocos), только обычный `enum`. Целевой стандарт ES2015: без `trimEnd`, `Object.entries` и т.п. Оператор `satisfies` тоже не использовать.
- Один `MaterialInstance` нельзя ставить в shared-слот нескольких рендереров («Can't set a material instance to a sharedMaterial slot»): общий материал + `getMaterialInstance(0)` у каждого.
- Текстуры, запечённые сверху вниз, на нашей плоскости выходят перевёрнутыми: строки переворачивать при загрузке (`flipRows` в `RenderKit`).
- Светлые альбедо (серый 0.4) под HDR-солнцем уходят в белое — для своих lit-материалов и палитр пропсов брать тёмные тона (0.1–0.2).
- Вершинные цвета `builtin-standard` трактует как sRGB (`SRGBToLinear` в шейдере) — палитры в `build-props.mjs` задаются в sRGB.
- Вспышка попадания на сборке из многих модулей (Warden) красит весь босс: у боссов и их частей она приглушённая (`FLASH_BOSS`).
- md5Cache переименовывает и файлы из `build-templates` (`sw.<hash>.js`) и сам правит ссылки в `index.html`, включая строку в inline-скрипте. Руками не переименовывать. Он же переписывает относительные пути внутри шаблонных JS (`'./'` в `sw.js` стал `'index.<hash>.js/'`) — в `sw.js` только абсолютные URL от `self.registration.scope`.
- **Заставка Cocos выключена** (`useSplashScreen: false`): страницу с первой отрисовки закрывает HTML-заставка из `index.ejs`, и снимает её только `WebPage.hideSplash()` — его зовёт первая открывшаяся сцена (`StartScreen`, `GameWorld`). Новая стартовая сцена или путь в обход меню тоже должны его вызвать, иначе игра останется под заставкой.
- **Caddyfile на сервере примонтирован в контейнер одиночным файлом:** править только с сохранением inode (`cat новый > Caddyfile`, затем `vps proxy reload`). `sed -i` и редакторы подменяют файл — контейнер продолжает видеть старый (так не применилось правило кэша этапа 3), тогда помогает только `docker restart caddy`. После правки сверять `docker exec caddy cat /etc/caddy/Caddyfile` с файлом на хосте и заголовки через `curl -I`.
- Новый service worker активируется, когда закрыты все вкладки игры (пока игра открыта, работает прежний; он и так берёт свежий `index.html` из сети).
- **Статус-бар PWA — `black`, не `black-translucent`:** с ним установленная на iPhone игра рисуется под часами (закрывали BACK и кошелёк), а высота вьюпорта занижена на высоту статус-бара — внизу пустая полоса. UI — в `UiKit.safeRoot` (отступы safe area); вырез в Chromium эмулирует CDP `Emulation.setSafeAreaInsetsOverride`.
- Эффекты нормализуются по пику: протяжный тон (сирена) при той же громкости в данных на 10+ дБ громче удара. Баланс сверять по LUFS (`ffmpeg -af ebur128`) с учётом громкости в `data/audio.ts`.
- Глубина в данных (`zAt`) линейна по миру, а экран в перспективе: верх сжат, поэтому «0.25 высоты» на экране выглядит выше. Высокие экраны (iPhone 19.5:9) показывают ~24 юнита по высоте, 16:9 — ~18.
