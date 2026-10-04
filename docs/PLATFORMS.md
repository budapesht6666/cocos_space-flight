# Платформы и сборка

## Итог

- **Бюджет — $0.** Пет-проект: никаких платных подписок, сервисов и аккаунтов.
- **Код один** (TypeScript и Cocos Creator 3.8). Из него собираются Web, iOS, Android, Windows и macOS.
- **Наша стратегия — сначала Web, потом iOS.** Весь цикл разработки идёт на Windows, игру проверяем в браузере и на iPhone через Safari.
- **Основной «релиз» — PWA** на GitHub Pages (бесплатно). Друзья открывают ссылку на iPhone и добавляют игру на экран «Домой»: она запускается на весь экран, как приложение.
- **Нативная iOS — только на свой iPhone, бесплатно.** Облачный macOS собирает неподписанный `.ipa`, а [Sideloadly](https://sideloadly.io/) на Windows ставит его на телефон с обычным Apple ID.
- **App Store и TestFlight — вне рамок.** Apple требует платный Developer Program ($99/год), и облачная сборка это не обходит: платить надо за право подписи и публикации, а не за сборку.
- **Без Mac напрямую собрать iOS нельзя.** Пункт «iOS» в панели сборки Cocos появляется только на macOS с Xcode ([iOS Publishing](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/ios/build-example-ios.html)). Поэтому собираем в облаке (см. ниже).
- **Android** — бонус: собирается на Windows. Не планируем, но архитектура не мешает.

## Матрица платформ

| Платформа | Где собирается | Что нужно | В плане |
|---|---|---|---|
| Web (`web-mobile`) | Windows | Ничего | С этапа 1, основной цикл |
| iPhone через Safari | Windows по Wi‑Fi | iPhone в той же сети | С этапа 1 |
| **PWA на GitHub Pages** — основной релиз | Web-сборка, хостинг GitHub Pages | Бесплатно; «Добавить на экран „Домой“» | Этап 3+ |
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

## PWA: основной релиз (этап 3+)

1. Собираем `web-mobile`, добавляем `manifest.webmanifest` (иконки, `display: standalone`, портретная ориентация) и meta-теги Apple для режима «на экран „Домой“».
2. Публикуем бесплатно:
   - **GitHub Pages** — для публичного репозитория.
   - Для приватного (на бесплатном аккаунте GitHub Pages из приватных репозиториев недоступен) — **Cloudflare Pages** или **itch.io** (HTML5-игры).
3. Друзья открывают ссылку в Safari → «Поделиться» → «На экран „Домой“». Игра запускается на весь экран, без панелей браузера.

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
# Windows (путь к редактору — после установки записать в CLAUDE.md)
"<путь>/CocosCreator.exe" --project game --build "platform=web-mobile;debug=false"

# с экспортированным конфигом панели Build (для повторяемости и CI)
"<путь>/CocosCreator.exe" --project game --build "configPath=build-configs/web-mobile.json"
```

Конфиги сборки экспортируются из панели **Build** в `build-configs/` и коммитятся. Локальные настройки панели лежат в `game/profiles/` (не в git).

## Android (если понадобится)

- Android Studio, SDK и NDK на Windows, сборка прямо из Cocos.
- Главный риск — производительность на слабых устройствах. Пресет качества Low это закрывает.
