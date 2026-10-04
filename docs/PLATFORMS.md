# Платформы и сборка

## Итог

- **Бюджет — $0.** Пет-проект: никаких платных подписок, сервисов и аккаунтов.
- **Код один** (TypeScript и Cocos Creator 3.8). Из него собираются Web, iOS, Android, Windows и macOS.
- **Наша стратегия — сначала Web, потом iOS.** Весь цикл разработки идёт на Windows, игру проверяем в браузере и на iPhone через Safari.
- **Основной «релиз» — PWA** на своём сервере пользователя (VPS, уже оплачен под другие проекты, для игры ничего докупать не нужно): https://spaceflight.p1gog.duckdns.org/. Друзья открывают ссылку на iPhone и добавляют игру на экран «Домой»: она запускается на весь экран, как приложение.
- **Нативная iOS — только на свой iPhone, бесплатно.** Облачный macOS собирает неподписанный `.ipa`, а [Sideloadly](https://sideloadly.io/) на Windows ставит его на телефон с обычным Apple ID.
- **App Store и TestFlight — вне рамок.** Apple требует платный Developer Program ($99/год), и облачная сборка это не обходит: платить надо за право подписи и публикации, а не за сборку.
- **Без Mac напрямую собрать iOS нельзя.** Пункт «iOS» в панели сборки Cocos появляется только на macOS с Xcode ([iOS Publishing](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/ios/build-example-ios.html)). Поэтому собираем в облаке (см. ниже).
- **Android** — бонус: собирается на Windows. Не планируем, но архитектура не мешает.

## Матрица платформ

| Платформа | Где собирается | Что нужно | В плане |
|---|---|---|---|
| Web (`web-mobile`) | Windows | Ничего | С этапа 1, основной цикл |
| iPhone через Safari | Windows по Wi‑Fi | iPhone в той же сети | С этапа 1 |
| **PWA на своём сервере** — основной релиз | Web-сборка на Windows → `npm run deploy:web` на VPS | Сервер уже есть; «Добавить на экран „Домой“» | С этапа 3 |
| **iOS нативно на свой iPhone** (sideload) | Облачный macOS → неподписанный `.ipa` → Sideloadly на Windows | Бесплатно: обычный Apple ID | Этап 8 |
| iOS в App Store / TestFlight | macOS + Xcode | $99/год за Apple Developer | **Вне рамок** (бюджет $0) |
| Android (APK на свои устройства) | Windows (Android Studio, NDK) | Бесплатно; Google Play стоит $25 — не нужен | Опционально |
| Windows / macOS desktop | Соответствующая ОС | — | Не планируем |

## Тест на iPhone без Mac (с первого дня)

1. Cocos Creator открыт, превью запущено.
2. Наведи курсор на IP-адрес в тулбаре редактора — появится QR-код ([Preview](https://docs.cocos.com/creator/3.8/manual/en/editor/preview)).
3. iPhone в той же Wi‑Fi-сети: сканируешь QR, игра открывается в Safari.
4. Если адрес неверный (несколько сетевых интерфейсов): **Preferences → General → Preview IP**.
5. Брандмауэр Windows должен пропускать входящие соединения на порт превью (по умолчанию 7456).

## Особенности iOS Safari (учитываем в коде)

| Особенность | Что делаем |
|---|---|
| Аудио блокируется до первого касания | `AudioService` разблокирует контекст на первом тапе (экран Title: «Tap to start») |
| Нет Fullscreen API для не-видео на iPhone | Полный экран — через «На экран „Домой“» (standalone PWA). В браузере остаются панели Safari |
| Нет Vibration API | Вибрация только в нативной сборке |
| Режим энергосбережения ограничивает `requestAnimationFrame` до 30 FPS | Симуляция с фиксированным шагом не ломается; в настройках подсказка |
| Вкладку перезагружает при нехватке памяти | Бюджеты текстур, без утечек, скромный размер сборки |
| Safe area (чёлка, Dynamic Island, home indicator) | Компонент `SafeArea` для HUD |
| Жесты Safari (pinch-zoom, свайп назад, bounce) | Шаблон `web-mobile` блокирует; проверяем на устройстве |

## PWA: основной релиз (с этапа 3)

**Адрес:** https://spaceflight.p1gog.duckdns.org/

1. **Шаблон** `game/build-templates/web-mobile/` Cocos берёт при каждой сборке `web-mobile`: свой `index.ejs` (название, `viewport-fit=cover`, `theme-color`, мета-теги Apple для «на экран „Домой“», регистрация service worker), `manifest.webmanifest` (`display: fullscreen`, portrait, иконки), `sw.js`, `icons/` (рендер Spitfire: 180 для Apple, 192, 512, maskable 512), `style.css` с тёмным фоном.
   - md5Cache переименовывает и шаблонные файлы (`sw.<hash>.js`, `manifest.<hash>.webmanifest`) и сам правит ссылки на них в `index.html`. Без хэша остаются только `index.html`, `icons/` и `src/effect.bin`.
   - **Service worker** (`sw.js`): страницы — сначала сеть (новая сборка подхватывается сразу), при офлайне — кэш; остальное — сначала кэш. Имя кэша штампует скрипт выкатки (коммит + время), и каждая выкатка начинает с чистого кэша.
2. **Сервер** — VPS пользователя по схеме скилла `vps-ops`: `ssh vps` (настройки в `~/.ssh/config`), приложение `spaceflight` типа `static` без git-репозитория. Caddy отдаёт `/srv/apps/spaceflight/repo/dist` и сам выпускает и продлевает HTTPS-сертификат. В блоке Caddyfile настроены заголовки: `no-cache` для файлов без хэша, `immutable` на год для остальных, `application/manifest+json` для манифеста.
   - Заведено один раз: `vps add spaceflight --type static --domain spaceflight.p1gog.duckdns.org`, затем правка блока в `/srv/proxy/Caddyfile` и `vps proxy reload`.
3. **Выкатка — автоматически при коммите в `main`.** У остальных приложений на сервере деплой идёт из GitHub: push → `vps deploy` → сервер сам собирает проект в контейнере с Node. Игру так не собрать: Cocos Creator — редактор под Windows/macOS (~2 GB, под Linux его нет), на сервере его не будет, а в GitHub Actions это Windows-раннер с неофициальной установкой редактора и полным импортом ассетов на каждый запуск. Поэтому релиз делается на этой машине:
   - git-хук `tools/hooks/post-commit` (включается один раз на клон: `npm run hooks:install`) после коммита в `main`, который трогает `game/` или `build-configs/`, запускает `npm run release:web`;
   - `tools/build-web.mjs` собирает CLI-сборкой на зеркале `game/` в `.cache/cli-game` (robocopy /MIR, свой `library/` сохраняется между запусками), так что редактор может оставаться открытым: первый раз ~70 с, дальше ~35 с;
   - `tools/deploy-web.mjs` штампует кэш service worker → tar.gz → по ssh в `dist.new` → подмена `dist` (посетители не видят половинчатой сборки). Сборка ≈ 8 MB, архив ≈ 3 MB;
   - коммит при этом не блокируется: если сборка или заливка упали, коммит остаётся, на сайте — прошлая сборка, лог — `.cache/release-web.log`. Пропустить разово: `SKIP_DEPLOY=1 git commit …`.
   - Вручную: `npm run release:web` (CLI-сборка + выкатка) или `npm run deploy:web` (выкатить сборку из редактора, `game/build/web-mobile`).
4. Друзья открывают ссылку в Safari → «Поделиться» → «На экран „Домой“». Игра запускается на весь экран, без панелей браузера, и работает офлайн после первой загрузки.
5. **Переезд сервера:** в бэкап `vps` статика без репозитория не попадает — после `vps restore` повторить шаг 2 и `npm run deploy:web`.

## Нативная iOS на свой iPhone — бесплатно (этап 8)

### Схема

```
GitHub push ─▶ облачный macOS (бесплатные минуты)
                 1. скачать Cocos Creator 3.8.x (mac)
                 2. CocosCreator --project game --build "platform=ios;configPath=build-configs/ios.json"
                 3. xcodebuild … CODE_SIGNING_ALLOWED=NO   (без подписи)
                 4. упаковать .app в Payload/ → SpaceFlight.ipa → артефакт сборки
                         │
                         ▼
Windows: скачать .ipa ─▶ Sideloadly + обычный Apple ID ─▶ iPhone по кабелю или Wi‑Fi
```

- Неподписанный `.ipa` на облачном macOS — распространённая схема ([пример: ipa-builder](https://github.com/kamenovsw/ipa-builder)). Подпись не нужна, поэтому не нужен и Apple Developer Program.
- Для шага 1–2 есть готовый action [Cocos Creator Build](https://github.com/marketplace/actions/cocos-creator-build) (работает только на Mac).

### Где взять бесплатный macOS

| Вариант | Бесплатно | Комментарий |
|---|---|---|
| **GitHub Actions**, macOS runner | Для **публичного** репозитория. Для приватного бесплатные минуты ограничены, macOS расходует их с повышенным множителем | Всё в одном месте с кодом |
| **Codemagic**, personal account | **500 минут/месяц** на macOS M2, обнуляются 1-го числа ([тарифы](https://docs.codemagic.io/billing/pricing/)) | Хватает на десятки сборок; репозиторий может быть приватным |

**Рекомендация:** Codemagic, если репозиторий приватный; GitHub Actions, если публичный. Решаем на этапе 8.

### Установка на телефон: Sideloadly и бесплатный Apple ID

[Sideloadly](https://sideloadly.io/) работает на Windows ([FAQ](https://sideloadly.io/faq.html)). Ограничения бесплатного Apple ID:
- **Подпись живёт 7 дней.** Потом приложение не запускается, пока его не переподпишешь. У Sideloadly есть автообновление, когда ПК и iPhone в одной сети.
- **Не больше 3 приложений**, установленных так одновременно.
- **Не больше 3 устройств.** Поставить друзьям этим способом практически нельзя, для них есть PWA.
- **Недоступны сервисы, требующие платного аккаунта:** Game Center, push-уведомления, iCloud. В игре их не используем.

### Что даёт нативная сборка по сравнению с PWA

- Вибрация (haptics).
- Полный экран без панелей Safari.
- Производительность обычно лучше: нативный рендер вместо WebGL.

Если PWA устраивает по ощущениям, этап 8 можно делать в любой момент или пропустить.

### Если когда-нибудь захочется App Store

Нужен Apple Developer Program ($99/год), это единственный путь в App Store и TestFlight. Сборочный пайплайн останется тем же, добавятся только подпись и выгрузка. Сейчас **вне рамок проекта**.

## Сборка из командной строки

[Publish from the Command Line](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html):

```bash
# с экспортированным конфигом панели Build (для повторяемости и CI); путь к конфигу — абсолютный (так проверено)
"C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe" --project game --build "configPath=C:\projects\claude\cocos_space-flight\build-configs\web-mobile.json"
```

Конфиги сборки экспортируются из панели **Build** в `build-configs/` и коммитятся. Локальные настройки панели лежат в `game/profiles/` (не в git).

**Проверено на этапе 3** (копия проекта, редактор с основным проектом при этом открыт): сборка за ~70 с с нуля, включая импорт ассетов, повторная ~35 с, результат совпадает со сборкой из редактора. Так работает `npm run build:web` (`tools/build-web.mjs`).
- **Код выхода 36 — это успех** (у Cocos свои коды), а не ошибка.
- В терминале VS Code (и в Claude Code внутри него) выставлена `ELECTRON_RUN_AS_NODE=1`: с ней `CocosCreator.exe` стартует как голый Node и падает с `bad option: --project`. Перед запуском снять: PowerShell `Remove-Item Env:ELECTRON_RUN_AS_NODE`, bash `env -u ELECTRON_RUN_AS_NODE …`.
- На одном проекте одновременно редактор и CLI не запускаем; при открытом редакторе собираем через builder из редактора или из копии проекта.

## Android (если понадобится)

- Android Studio, SDK и NDK на Windows, сборка прямо из Cocos.
- Главный риск — производительность на слабых устройствах. Пресет качества Low это закрывает.
