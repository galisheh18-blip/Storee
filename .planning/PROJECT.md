# Проект: СпортМагазин (sportshop)

## Цель
Создать полностью рабочий Django-сайт каталога спортивных товаров согласно промту из `C:\Users\user\Documents\требования.txt`.

## Контекст
- **Рабочая директория:** `C:\Project Python\`
- **Название Django-проекта:** `sportshop`
- **Название приложения:** `catalog`
- **Python:** `python`
- **База данных:** SQLite
- **UI-фреймворк:** Bootstrap 5 (CDN)
- **DEBUG:** False для отчёта (с пояснением в README про True для разработки)
- **ALLOWED_HOSTS:** `['*']`

## Технологии
- Django 5.x LTS
- SQLite
- Bootstrap 5 (CDN)
- Pillow (для ImageField)

## Критерии успеха
- Модель `Product` с нужными полями и миграции созданы.
- Главная страница с карточками товаров, пагинация по 5 товаров, сортировка.
- Полный CRUD: create, update, delete с подтверждением.
- Админка, поиск по name/description (Q-объекты), страницы 404/500.
- Bootstrap Navbar, forms.py, urls.py в приложении.
- Подробный README.md с инструкциями.
- Запуск без ошибок, все URL работают.
