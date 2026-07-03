# ROADMAP.md

## Фаза 1: Создание Django-проекта и модели
**Цель:** Подготовить рабочий Django-проект, приложение catalog и модель Product с миграциями.
- Создать виртуальное окружение.
- Установить Django, Pillow.
- Создать проект `sportshop` и приложение `catalog`.
- Описать модель `Product`.
- Создать и применить миграции.
- Настроить `settings.py` (INSTALLED_APPS, MEDIA, STATIC, ALLOWED_HOSTS, DEBUG).
- Подключить `urls.py` приложения.

## Фаза 2: Список товаров, пагинация и сортировка
**Цель:** Главная страница с карточками, пагинацией и сортировкой.
- View для списка товаров.
- Шаблон base.html и product_list.html.
- Пагинация по 5 товаров.
- Сортировка через GET-параметр.

## Фаза 3: CRUD
**Цель:** Создание, редактирование, удаление товаров.
- ProductForm в forms.py.
- Views CreateView, UpdateView, DeleteView.
- Шаблоны: product_form.html, product_confirm_delete.html.
- Кнопки в списке товаров.

## Фаза 4: Поиск, админка, страницы ошибок, Bootstrap Navbar
**Цель:** Доработать UX и администрирование.
- Админка catalog/admin.py.
- Поиск через Q-объекты.
- 404.html и 500.html.
- Navbar с Bootstrap 5.

## Фаза 5: Финальная настройка и README
**Цель:** Подготовить проект к отчёту.
- README.md.
- requirements.txt.
- Проверка запуска.
- Создание суперпользователя (команда в README).
