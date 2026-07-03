from django.db import models


class Product(models.Model):
    CATEGORY_CHOICES = [
        ('equipment', 'Снаряжение'),
        ('clothes', 'Одежда'),
        ('shoes', 'Обувь'),
    ]

    name = models.CharField(max_length=200, verbose_name='Название')
    description = models.TextField(blank=True, verbose_name='Описание')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Цена')
    image = models.ImageField(upload_to='products/', blank=True, null=True, verbose_name='Изображение')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    stock = models.IntegerField(default=0, verbose_name='Количество на складе')
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        default='equipment',
        verbose_name='Категория'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активен')

    class Meta:
        verbose_name = 'Товар'
        verbose_name_plural = 'Товары'
        ordering = ['-created_at']

    def __str__(self):
        return self.name
