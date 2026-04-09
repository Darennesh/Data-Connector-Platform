from django.contrib import admin
from .models import Submission, SubmissionFile, FileShare

@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'table_name', 'row_count', 'owner', 'created_at')

@admin.register(SubmissionFile)
class SubmissionFileAdmin(admin.ModelAdmin):
    list_display = ('id', 'submission', 'format', 'owner', 'created_at')

@admin.register(FileShare)
class FileShareAdmin(admin.ModelAdmin):
    list_display = ('file', 'shared_with', 'shared_by', 'created_at')
