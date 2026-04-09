from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import AuditLog

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'role')
        read_only_fields = ('id', 'role')

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'is_active', 'date_joined', 'last_login')
        read_only_fields = ('id', 'username', 'date_joined', 'last_login')


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Admin-only serializer for changing role and active status."""

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'is_active')
        read_only_fields = ('id', 'username')


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = ('id', 'user', 'username', 'action', 'detail', 'ip_address', 'created_at')
        read_only_fields = fields
