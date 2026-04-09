from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConnectionConfigViewSet

router = DefaultRouter()
router.register(r'', ConnectionConfigViewSet, basename='connection')

urlpatterns = [
    path('', include(router.urls)),
]
