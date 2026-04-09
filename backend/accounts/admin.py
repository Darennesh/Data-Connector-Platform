from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import AuditLog

User = get_user_model()

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'is_active')
    list_filter = ('role',)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'ip_address', 'created_at')
    list_filter = ('action',)
    readonly_fields = ('user', 'action', 'detail', 'ip_address', 'created_at')
