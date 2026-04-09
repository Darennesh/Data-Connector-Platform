from django.contrib import admin
from .models import ConnectionConfig

@admin.register(ConnectionConfig)
class ConnectionConfigAdmin(admin.ModelAdmin):
    list_display = ('name', 'db_type', 'host', 'port', 'owner', 'created_at')
    list_filter = ('db_type',)
