from django.contrib import admin

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'price', 'stock', 'category', 'is_active', 'created_at']
    list_filter = ['category', 'created_at', 'is_active']
    search_fields = ['name']
    list_editable = ['is_active']
    ordering = ['-created_at']
