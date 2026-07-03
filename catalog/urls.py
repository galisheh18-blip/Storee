from django.urls import path

from . import views

app_name = 'catalog'

urlpatterns = [
    path('', views.ProductListView.as_view(), name='product_list'),
    path('catalog/', views.ProductListView.as_view(), name='product_list_alt'),
    path('catalog/create/', views.ProductCreateView.as_view(), name='product_create'),
    path('catalog/<int:pk>/update/', views.ProductUpdateView.as_view(), name='product_update'),
    path('catalog/<int:pk>/delete/', views.ProductDeleteView.as_view(), name='product_delete'),
]
