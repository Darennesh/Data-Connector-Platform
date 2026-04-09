from rest_framework import generics, permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import AuditLog
from .serializers import (
    RegisterSerializer, UserSerializer, AdminUserUpdateSerializer, AuditLogSerializer,
)
from core.permissions import IsAdmin

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)

    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.log(user, 'register', {'username': user.username}, self.request)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class AdminUserViewSet(viewsets.ModelViewSet):
    """Admin-only: list, retrieve, update roles, deactivate users."""
    queryset = User.objects.all().order_by('-date_joined')
    permission_classes = (IsAdmin,)
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_serializer_class(self):
        if self.action in ('partial_update', 'update'):
            return AdminUserUpdateSerializer
        return UserSerializer

    @action(detail=True, methods=['patch'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response(
                {"error": "Cannot deactivate yourself"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        action_name = 'user_activated' if user.is_active else 'user_deactivated'
        AuditLog.log(request.user, action_name, {'target_user': user.username}, request)
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['patch'], url_path='set-role')
    def set_role(self, request, pk=None):
        user = self.get_object()
        role = request.data.get('role')
        if role not in ('admin', 'user'):
            return Response(
                {"error": "Role must be 'admin' or 'user'"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user == request.user and role != 'admin':
            return Response(
                {"error": "Cannot remove your own admin role"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        old_role = user.role
        user.role = role
        user.save(update_fields=['role'])
        AuditLog.log(
            request.user, 'role_changed',
            {'target_user': user.username, 'old_role': old_role, 'new_role': role},
            request,
        )
        return Response(UserSerializer(user).data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-only: view audit logs with optional action filter."""
    serializer_class = AuditLogSerializer
    permission_classes = (IsAdmin,)

    def get_queryset(self):
        qs = AuditLog.objects.select_related('user').all()
        action_filter = self.request.query_params.get('action')
        if action_filter:
            qs = qs.filter(action=action_filter)
        user_filter = self.request.query_params.get('user_id')
        if user_filter:
            qs = qs.filter(user_id=user_filter)
        return qs
