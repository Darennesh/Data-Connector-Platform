from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, MeView, AdminUserViewSet, AuditLogViewSet

router = DefaultRouter()
router.register(r'users', AdminUserViewSet, basename='admin-user')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('', include(router.urls)),
]
