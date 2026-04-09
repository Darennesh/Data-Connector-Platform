from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('user', 'User'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.username} ({self.role})"


class AuditLog(models.Model):
    ACTION_CHOICES = (
        ('login', 'Login'),
        ('register', 'Register'),
        ('connection_created', 'Connection Created'),
        ('connection_deleted', 'Connection Deleted'),
        ('submission_created', 'Submission Created'),
        ('file_shared', 'File Shared'),
        ('role_changed', 'Role Changed'),
        ('user_deactivated', 'User Deactivated'),
        ('user_activated', 'User Activated'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs',
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    detail = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} by {self.user} at {self.created_at}"

    @classmethod
    def log(cls, user, action, detail=None, request=None):
        ip = None
        if request:
            ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
            if not ip:
                ip = request.META.get('REMOTE_ADDR')
        return cls.objects.create(
            user=user,
            action=action,
            detail=detail or {},
            ip_address=ip,
        )
