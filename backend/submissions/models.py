from django.db import models
from django.conf import settings


class Submission(models.Model):
    connection = models.ForeignKey(
        'connectors.ConnectionConfig',
        on_delete=models.SET_NULL,
        null=True,
        related_name='submissions',
    )
    table_name = models.CharField(max_length=255)
    row_count = models.IntegerField(default=0)
    data = models.JSONField(default=list)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submissions',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'submissions'
        ordering = ['-created_at']

    def __str__(self):
        return f"Submission {self.id} - {self.table_name}"


class SubmissionFile(models.Model):
    FORMAT_CHOICES = (
        ('json', 'JSON'),
        ('csv', 'CSV'),
    )

    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name='files',
    )
    file = models.FileField(upload_to='submissions/')
    format = models.CharField(max_length=4, choices=FORMAT_CHOICES)
    source_metadata = models.JSONField(default=dict)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submission_files',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'submission_files'
        ordering = ['-created_at']

    def __str__(self):
        return f"File {self.id} ({self.format}) for Submission {self.submission_id}"


class FileShare(models.Model):
    file = models.ForeignKey(
        SubmissionFile,
        on_delete=models.CASCADE,
        related_name='shares',
    )
    shared_with = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='shared_files',
    )
    shared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='files_shared',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'file_shares'
        unique_together = ('file', 'shared_with')
