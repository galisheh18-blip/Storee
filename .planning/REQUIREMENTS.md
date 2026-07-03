# REQUIREMENTS.md

## Функциональные требования

### Шаг 1. Модель товара
- Создать приложение `catalog`.
- Модель `Product` в `models.py`:
  - `name` CharField(max_length=200)
  - `description` TextField
  - `price` DecimalField(max_digits=10, decimal_places=2)
  - `image` ImageField(upload_to='products/')
  - `created_at` DateTimeField(auto_now_add=True)
  - `stock` IntegerField(default=0)
  - `category` CharField(max_length=50, choices=[('equipment','Снаряжение'),('clothes','Одежда'),('shoes','Обувь')], default='equipment')
  - `is_active` BooleanField(default=True)
- Создать и применить миграции.
- Настроить MEDIA_URL, MEDIA_ROOT, STATIC_URL.

### Шаг 2. Список товаров + пагинация
- URL `/` или `/catalog/` с карточками товаров.
- Пагинация по 5 товаров на страницу.
- Форма сортировки: "Сначала новые", "Дешевле", "Дороже".
- Шаблон: картинка, название, цена, кнопка "Подробнее", пагинатор.

### Шаг 3. CRUD
- Создание: `/catalog/create/` на ModelForm.
- Изменение: `/catalog/<int:pk>/update/`.
- Удаление: `/catalog/<int:pk>/delete/` через DeleteView с подтверждением.
- Кнопки "Редактировать" и "Удалить" рядом с товаром в списке.

### Шаг 4. Доработка
- Админка: список полей, фильтры по категории и дате, поиск по названию.
- Поиск по `name` и `description` через Q-объекты.
- Кастомные 404.html и 500.html.
- Bootstrap 5 Navbar с логотипом "СпортМагазин" и ссылками.
- `forms.py` в приложении.
- `urls.py` в приложении.

### Шаг 5. Финальная настройка
- README.md с инструкциями.
- Суперпользователь (команда в README).
- DEBUG = False, ALLOWED_HOSTS = ['*'].
- Работающий запуск без ошибок.

## Нефункциональные требования
- Код стилистически согласован.
- Минимум сторонних зависимостей.
- Проект запускается по README.
