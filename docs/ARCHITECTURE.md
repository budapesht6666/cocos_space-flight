# Архитектура

> Живой документ. Описывает целевую структуру. Расхождения с кодом исправляются в том же шаге, где меняется код.

## 1. Стек

| Слой | Технология |
|---|---|
| Движок | Cocos Creator 3.8 LTS (3D-рендер, UI, частицы, аудио) |
| Язык | TypeScript (strict) |
| Сборка | Cocos Build: `web-mobile` сейчас, `ios` на этапе 8 |
| Тесты | Vitest для чистой логики (`core/`, `data/`) вне движка |
| Рендер | Встроенный пайплайн 3.8, `BuiltinPipelineSettings` на камере (bloom, FXAA) |

## 2. Раскладка репозитория

```
/                         корень: документация, тулинг, CI
├─ CLAUDE.md, README.md
├─ package.json, vitest.config.ts   тулинг: TypeScript (typecheck), Vitest
├─ .mcp.json              MCP проекта: playwright, cocos
├─ docs/                  GDD, PLAN, ARCHITECTURE, ASSETS, PLATFORMS
├─ tests/                 Vitest-тесты для game/assets/scripts/{core,data}
├─ tools/                 вспомогательные скрипты (балансные таблицы, конвертеры)
├─ build-configs/         экспортированные конфиги сборки Cocos для CLI/CI
├─ .claude/               настройки и скиллы Claude Code
└─ game/                  ПРОЕКТ COCOS CREATOR (открывать в Dashboard)
   ├─ assets/
   │  ├─ scenes/          Boot.scene, Menu.scene, Game.scene
   │  ├─ scripts/
   │  │  ├─ core/         чистый TS без импорта 'cc': EventBus, Pool, Rng, FSM, math, таймеры
   │  │  ├─ data/         типизированные конфиги: weapons, enemies, patterns, levels, economy
   │  │  ├─ game/         GameWorld и системы (Player, Enemy, Bullet, Collision, Pickup, Score, Director)
   │  │  ├─ entities/     компоненты-представления (EnemyView, ShipView, BossPart…)
   │  │  ├─ fx/           CameraShake, HitFlash, Explosions, Trails
   │  │  ├─ ui/           экраны, HUD, виджеты
   │  │  ├─ services/     Save, Settings, Audio, Input, SceneRouter
   │  │  └─ debug/        оверлей, читы, URL-параметры
   │  ├─ prefabs/         ships/, enemies/, bullets/, fx/, ui/
   │  ├─ models/<source>/ импортированные glTF/glb, по источникам
   │  ├─ materials/       toon/unlit/emissive, щит, пули
   │  ├─ effects/         свои шейдеры (.effect)
   │  ├─ textures/  audio/  fonts/
   │  └─ resources/       только то, что грузится динамически
   ├─ extensions/         funplay-cocos-mcp (MCP для редактора; не в git, ставится git clone)
   ├─ funplay-cocos-mcp.config.json   порт 28456, профиль инструментов
   ├─ settings/  package.json  tsconfig.json (strict)
   └─ library/ temp/ local/ build/ profiles/   ← генерируются, не в git
```

## 3. Сцены и поток

```
Boot ──(загрузка сохранения, настроек, прелоад общих ассетов)──▶ Menu ⇄ Game
```

- **Boot.** Создаёт постоянный корневой узел (`director.addPersistRootNode`) с сервисами Save, Settings, Audio и SceneRouter.
- **Menu.** Title, Main Menu, Sector Map, Hangar и Settings. Это UI-панели внутри одной сцены, не отдельные сцены.
- **Game.** Геймплей, HUD, пауза и результаты. Параметры (миссия, сложность, снаряжение) приходят через `SceneRouter`.

## 4. Симуляция: GameWorld и системы

Геймплей не живёт в `update()` отдельных компонентов. Единственный компонент `GameWorld` в сцене Game гоняет **фиксированный шаг 1/60 с** через аккумулятор и вызывает системы в строгом порядке:

```
CameraRig.tick → (hitstop? стоп) → Starfield → WaveDirector (спавны) → PlayerSystem (ввод, движение, стрельба)
→ BulletSystem → EnemySystem → CollisionSystem → FxSystem
затем раз в кадр: render() всех систем (перенос состояния в узлы) и HUD
```

Пикапы, очки-комбо и HUD-презентер появятся на этапе 2. Сейчас очки считает `GameWorld` по событию `enemyKilled`.

Зачем так:
- **Детерминизм.** Паттерны пуль одинаковы на 30, 60 и 120 Гц.
- **Производительность.** Сотни пуль — это записи в массивах, у которых нет своих `Component.update`.
- **Отладка.** Порядок систем явный, `?t=90` перематывает таймлайн.

Сущности (враг, пуля, пикап) — пул-объекты: данные плюс ссылка на узел-представление. Создаются только через пулы (`core/Pool`), в геймплее нет `instantiate` и `destroy`. Свободные пули и частицы паркуются за кадром (`y = -1000`), а не выключаются через `active`: на iPhone это заметно дешевле при всплесках вроде взрывов.

## 5. Координаты и камера

- Игровая плоскость **XZ, y = 0**. «Вверх по экрану» соответствует **−Z**.
- Ширина поля — **10 юнитов**. Высота зависит от соотношения сторон: камера подбирает дистанцию и FOV так, чтобы ширина всегда помещалась.
- Масштаб: корабль игрока около 1 юнита в длину, пули 0.15–0.3.
- Модели при импорте нормализуются: нос смотрит в −Z, pivot в центре масс.

## 6. Коллизии

Физический движок Cocos не используем: он избыточен и дорог для сотен пуль. Вместо этого:
- Круг против круга в плоскости XZ.
- Равномерная сетка (spatial hash, ячейка 2 юнита).
- Маски слоёв: `PlayerBullet × Enemy`, `EnemyBullet × Player` (хитбокс и отдельно graze), `Player × Enemy` (таран), `Player × Pickup`.
- Крупные враги и боссы имеют несколько кругов (составной коллайдер), привязанных к частям.

## 7. Данные (data-driven)

Весь контент и баланс описывается **типизированными TS-модулями** в `scripts/data/`, без JSON. Так компилятор ловит опечатки в ссылках.

```ts
// scripts/data/types.ts (эскиз)
interface WeaponDef { id: WeaponId; slot: 'primary' | 'secondary'; levels: WeaponLevel[]; powerForms: PowerForm[] }
interface EnemyDef  { id: EnemyId; hp: number; radius: number; prefab: string; move: MoveSpec; attack?: AttackSpec; score: number; drops: DropTable }
interface AttackSpec { pattern: 'aimed' | 'spread' | 'ring' | 'spiral' | 'burst' | 'beam'; params: PatternParams; cooldown: number }
interface LevelDef  { id: MissionId; scrollSpeed: number; events: LevelEvent[] }   // события по времени
type LevelEvent =
  | { t: number; type: 'spawn'; enemy: EnemyId; formation: FormationSpec; path: PathSpec; minDifficulty?: Difficulty }
  | { t: number; type: 'setPiece'; prefab: string; x: number }
  | { t: number; type: 'boss'; boss: BossId }
  | { t: number; type: 'waitClear' }
```

- **Сложность** применяется при спавне: множители HP, скорости и скорострельности, варианты паттернов (`minDifficulty`), шанс элиты.
- **Валидация данных** — отдельный Vitest-тест. Все ссылки должны существовать, таймлайны отсортированы, у каждой миссии нужное количество Escape Pod.

## 8. Паттерны движения и стрельбы

- **Движение:** сплайны и Безье, синусоиды, «нырок к игроку», зависание, следование за «землёй». Задаются параметрами, вычисляются в `core/` (покрыто тестами).
- **Стрельба:** эмиттеры с параметрами (BulletML-lite). Типы: aimed, spread, ring, spiral, burst, beam. Поддерживаются задержки, вращение и вложенные залпы.

## 9. События

Типизированный `EventBus` из `core/`. Системы общаются событиями (`enemyKilled`, `playerHit`, `shieldBroken`, `pickupCollected`, `graze`, `bossPhase`, `missionComplete`…). Score, Audio, FX и HUD подписываются на них и не держат прямых ссылок друг на друга.

## 10. Сервисы

| Сервис | Ответственность |
|---|---|
| `SaveService` | Прогресс, медали, кредиты, апгрейды. JSON в `sys.localStorage`, поле `version` и миграции (миграции покрыты тестами) |
| `SettingsService` | Громкость, чувствительность, качество графики, handedness |
| `AudioService` | Музыка (кроссфейд) и пулы SFX. Разблокировка аудио первым касанием (требование iOS Safari) |
| `InputService` | Касания, мышь, клавиатура → `moveDelta` и `specialPressed`; учёт чувствительности |
| `SceneRouter` | Переходы между сценами с параметрами и фейдом |

## 11. Рендер и визуал

- **Освещение — HDR** (физические единицы: свет 110 000 lux, ambient 32 000, скайбокс выключен): один directional light и ambient, **без realtime-теней**.
- **Unlit-свечение в HDR** выходит на порядок ярче и уходит в белое. Поэтому `RenderKit` умножает интенсивность на `HDR_UNLIT_SCALE` (0.4). В данных интенсивность относительная: 1 — обычное свечение, 2+ — «белое-горячее».
- Bloom (Kawase, 2 прохода) и FXAA через `BuiltinPipelineSettings` на игровой камере. **3D рендерится в 70% разрешения** (`shadingScale` 0.7) с апскейлом; UI — в полном. Позже — пресеты качества (Low/Medium/High).
- **Fill rate — главный ограничитель на iPhone** (Retina ×3 ≈ 3 млн пикселей). Никаких полноэкранных процедурных шейдеров на каждый кадр: тяжёлое считаем один раз в текстуру.
- **`RenderKit`** создаёт в рантайме процедурные текстуры (мягкое свечение, кольцо), меши-примитивы (плоскость XZ, куб) и кэширует материалы. Всё, что делит меш и материал, рисуется **GPU-инстансингом** (`USE_INSTANCING`): пули, звёзды, искры, обломки.
- Встроенные эффекты (`builtin-unlit`, `builtin-standard`) подключены как `@property` у `GameWorld`, чтобы гарантированно попасть в сборку.
- **Эффекты взрыва** (`FxSystem`) — свои частицы из пулов: вспышка, огненные шары, искры, лит-обломки, кольцо ударной волны (у кольца свой экземпляр материала, чтобы гасить прозрачность). `ParticleSystem` движка пока не используем.
- **Фон:** плоскость глубоко под полем (y = −70) с туманностью и 3 слоя инстансных звёзд с параллаксом. Туманность (domain-warped fBm, палитра сектора в `data/visuals.ts`) **запекается на CPU при старте** в бесшовную текстуру 192×384 (`core/nebula.ts`, ~60–150 мс) и скроллится смещением UV. Полноэкранный шейдер с тем же шумом давал 49 FPS на iPhone.
- **Модели кораблей** готовит `tools/assets/build-ships.mjs` (glTF → glb): расцветка из пака, текстура 512² JPEG, нос в −Z, наибольший габарит = 1. Размер в игре задаётся в данных (`size`).
- UI — отдельная UI-камера и Canvas с Widget на весь экран; HUD строится кодом (`ui/Hud.ts`). Safe area — на этапе 6.

## 12. Отладка

Работает в debug-сборках и превью:

| URL-параметр | Действие |
|---|---|
| `?debug=1` | Оверлей: FPS, draw calls, число сущностей по типам |
| `?mission=s1m2` | Сразу открыть миссию |
| `?difficulty=hard` | Сложность |
| `?t=90` | Перемотка таймлайна миссии на 90 с |
| `?god=1` | Бессмертие |
| `?power=4` | Стартовый Power |
| `?seed=7` | Фиксированный seed случайности (повторяемые прогоны) |
| `?slowmo=0.25` | Замедление времени, чтобы разглядеть эффекты |

Через эти параметры Playwright-плейтесты сразу попадают в нужное состояние (см. скилл `playtest`).
Сейчас работают `debug`, `god`, `power`, `t`, `seed`, `slowmo`. `mission` и `difficulty` появятся на этапе 2.

## 13. Бюджеты производительности (iPhone, Safari, 60 FPS)

| Метрика | Бюджет |
|---|---|
| Draw calls | ≤ 100 |
| Треугольники в кадре | ≤ 150k (корабль игрока ≤ 5k, враг ≤ 3.5k, тяжёлый враг ≤ 9k и не больше 2 на экране, босс ≤ 10k) |
| Пули одновременно | ≤ 500 |
| Текстуры | ≤ 1024², UI в атласах |
| Аллокации в кадре | ~0 (временные `Vec3` переиспользуются, никаких замыканий и массивов в горячем коде) |
| Память | Держим скромно: iOS Safari перезагружает вкладку при нехватке |

## 14. Тестирование

- **Unit (Vitest):** `core/` (паттерны, пулы, EventBus, RNG, FSM), `data/` (валидация), экономика, миграции сохранений.
- **Typecheck:** `tsc --noEmit` по проекту Cocos.
- **Визуальные плейтесты:** превью или web-сборка в Playwright (390×844), скриншоты, драг мышью, проверка консоли. Скриншоты сцены — через Cocos MCP.
- **На устройстве:** iPhone через Safari по Wi‑Fi (QR из тулбара редактора).
