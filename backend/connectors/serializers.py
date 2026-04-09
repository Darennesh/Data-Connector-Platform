from rest_framework import serializers
from .models import ConnectionConfig


class ConnectionConfigSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = ConnectionConfig
        fields = (
            'id', 'name', 'db_type', 'host', 'port',
            'database', 'username', 'password',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')
