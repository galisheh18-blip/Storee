# Мои траты — Android-приложение (APK)

Нативная Android-обёртка вокруг офлайн-приложения учёта трат из `../expense-app`.
Внутри — тот же интерфейс (категории, лимиты, остаток, плановые платежи), упакованный
в `WebView`. Приложение полностью офлайн, данные хранятся на устройстве.

## ⚠️ Почему APK не собран автоматически

Сборка `.apk` требует **Android SDK** и **Android Gradle Plugin**, которые скачиваются
с серверов Google (`dl.google.com`, `maven.google.com`). В облачном окружении, где
готовился этот проект, сетевая политика **блокирует эти домены**, поэтому бинарник
собрать там нельзя. Исходники полностью готовы — соберите APK у себя одним из способов ниже.

## Способ 1 — Android Studio (проще всего, рекомендуется)

1. Установите [Android Studio](https://developer.android.com/studio) (сам скачает SDK).
2. **File → Open** → выберите папку `android-app`.
3. Дождитесь синхронизации Gradle.
4. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
5. Готовый файл: `app/build/outputs/apk/debug/app-debug.apk`. Нажмите «locate», перекиньте на телефон и установите.

## Способ 2 — командная строка

Нужны JDK 17+ и Android SDK (переменная `ANDROID_HOME` или `local.properties`).

```bash
cd android-app
cp local.properties.sample local.properties   # и впишите путь к SDK
# либо: export ANDROID_HOME=/path/to/Android/Sdk

./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

Если SDK-компоненты не установлены, скачать их можно так:

```bash
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

## Установка на телефон

1. Скопируйте `app-debug.apk` на телефон (кабель, облако, мессенджер).
2. Откройте файл, разрешите установку из этого источника.
3. Появится приложение «Мои траты».

> Это debug-сборка — её достаточно для личного использования.
> Для публикации в Google Play нужна подписанная release-сборка (`assembleRelease` + свой keystore).

## Что где лежит

```
android-app/
├── app/
│   ├── build.gradle                     # конфигурация модуля (compileSdk 34, minSdk 24)
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/mytraty/app/MainActivity.java   # WebView, загружает приложение из assets
│       ├── assets/                      # копия приложения (index.html, app.js, styles.css, иконки)
│       └── res/mipmap-*/                # иконки приложения
├── build.gradle                         # версия Android Gradle Plugin
├── settings.gradle
└── gradlew / gradlew.bat                # обёртка Gradle — SDK-часть подтянется при сборке
```

## Обновить содержимое приложения

Логика и вёрстка живут в `../expense-app`. После изменений синхронизируйте ассеты:

```bash
cp ../expense-app/index.html ../expense-app/styles.css ../expense-app/app.js \
   ../expense-app/manifest.webmanifest ../expense-app/sw.js app/src/main/assets/
cp -r ../expense-app/icons app/src/main/assets/
```
