import csv
import io
import json
import os
import uuid
from datetime import date, datetime
from decimal import Decimal

from django.conf import settings
from django.core.files.base import ContentFile
from django.contrib.auth import get_user_model
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import AuditLog
from connectors.models import ConnectionConfig
from connectors.engine import ConnectorFactory
from core.permissions import IsOwnerOrAdmin, IsOwnerOrAdminOrShared
from .models import Submission, SubmissionFile, FileShare
from .serializers import (
    SubmissionSerializer,
    SubmissionCreateSerializer,
    SubmissionFileSerializer,
    FileShareSerializer,
    FileShareCreateSerializer,
)

User = get_user_model()


def _sanitize_value(v):
    """Convert non-JSON-serializable types to strings."""
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, bytes):
        return v.hex()
    return v


def _sanitize_rows(rows: list[dict]) -> list[dict]:
    return [{k: _sanitize_value(v) for k, v in row.items()} for row in rows]


def _export_json(rows: list[dict], table_name: str) -> ContentFile:
    content = json.dumps(rows, indent=2, default=str)
    return ContentFile(content.encode('utf-8'), name=f"{table_name}_{uuid.uuid4().hex[:8]}.json")


def _export_csv(rows: list[dict], table_name: str) -> ContentFile:
    if not rows:
        return ContentFile(b'', name=f"{table_name}_{uuid.uuid4().hex[:8]}.csv")
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
    writer.writeheader()
    for row in rows:
        writer.writerow({k: str(v) if v is not None else '' for k, v in row.items()})
    return ContentFile(buf.getvalue().encode('utf-8'), name=f"{table_name}_{uuid.uuid4().hex[:8]}.csv")


EXPORTERS = {
    'json': _export_json,
    'csv': _export_csv,
}


class SubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = (IsOwnerOrAdmin,)

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Submission.objects.select_related('connection').prefetch_related('files').all()
        return Submission.objects.select_related('connection').prefetch_related('files').filter(owner=user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=['post'], url_path='extract')
    def extract_and_submit(self, request):
        """
        Batch extract: pull data from a connection/table, store in DB + files.
        Body: { connection_id, table_name, data (edited rows), export_formats }
        """
        ser = SubmissionCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        # Verify connection belongs to user
        try:
            config = ConnectionConfig.objects.get(pk=d['connection_id'])
        except ConnectionConfig.DoesNotExist:
            return Response({"error": "Connection not found"}, status=status.HTTP_404_NOT_FOUND)
        if config.owner != request.user and request.user.role != 'admin':
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        rows = _sanitize_rows(d['data'])

        # Create submission (store in DB)
        submission = Submission.objects.create(
            connection=config,
            table_name=d['table_name'],
            row_count=len(rows),
            data=rows,
            owner=request.user,
        )

        # Export to files
        formats = d.get('export_formats', ['json', 'csv'])
        for fmt in formats:
            exporter = EXPORTERS.get(fmt)
            if exporter:
                file_content = exporter(rows, d['table_name'])
                SubmissionFile.objects.create(
                    submission=submission,
                    file=file_content,
                    format=fmt,
                    source_metadata={
                        'connection_id': config.id,
                        'connection_name': config.name,
                        'db_type': config.db_type,
                        'table_name': d['table_name'],
                        'row_count': len(rows),
                    },
                    owner=request.user,
                )

        AuditLog.log(
            request.user, 'submission_created',
            {'submission_id': submission.id, 'table_name': d['table_name'], 'row_count': len(rows)},
            request,
        )

        return Response(
            SubmissionSerializer(submission, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='fetch-and-submit')
    def fetch_and_submit(self, request):
        """
        Fetch data directly from a connection and submit it.
        Body: { connection_id, table_name, limit, offset, export_formats }
        """
        connection_id = request.data.get('connection_id')
        table_name = request.data.get('table_name')
        limit = min(int(request.data.get('limit', 100)), 5000)
        offset = int(request.data.get('offset', 0))
        export_formats = request.data.get('export_formats', ['json', 'csv'])

        try:
            config = ConnectionConfig.objects.get(pk=connection_id)
        except ConnectionConfig.DoesNotExist:
            return Response({"error": "Connection not found"}, status=status.HTTP_404_NOT_FOUND)
        if config.owner != request.user and request.user.role != 'admin':
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        connector = ConnectorFactory(
            db_type=config.db_type,
            host=config.host,
            port=config.port,
            database=config.database,
            username=config.username,
            password=config.password,
        )

        try:
            with connector:
                rows = connector.fetch_data(table_name, limit=limit, offset=offset)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        rows = _sanitize_rows(rows)

        # Create submission
        submission = Submission.objects.create(
            connection=config,
            table_name=table_name,
            row_count=len(rows),
            data=rows,
            owner=request.user,
        )

        for fmt in export_formats:
            exporter = EXPORTERS.get(fmt)
            if exporter:
                file_content = exporter(rows, table_name)
                SubmissionFile.objects.create(
                    submission=submission,
                    file=file_content,
                    format=fmt,
                    source_metadata={
                        'connection_id': config.id,
                        'connection_name': config.name,
                        'db_type': config.db_type,
                        'table_name': table_name,
                        'row_count': len(rows),
                    },
                    owner=request.user,
                )

        AuditLog.log(
            request.user, 'submission_created',
            {'submission_id': submission.id, 'table_name': table_name, 'row_count': len(rows)},
            request,
        )

        return Response(
            SubmissionSerializer(submission, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class SubmissionFileViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SubmissionFileSerializer
    permission_classes = (IsOwnerOrAdminOrShared,)

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return SubmissionFile.objects.all()
        # Own files + shared files
        from django.db.models import Q
        return SubmissionFile.objects.filter(
            Q(owner=user) | Q(shares__shared_with=user)
        ).distinct()


class FileShareViewSet(viewsets.ModelViewSet):
    serializer_class = FileShareSerializer
    permission_classes = (IsOwnerOrAdmin,)

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return FileShare.objects.all()
        from django.db.models import Q
        return FileShare.objects.filter(Q(shared_by=user) | Q(shared_with=user))

    @action(detail=False, methods=['post'], url_path='share')
    def share_file(self, request):
        ser = FileShareCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            sf = SubmissionFile.objects.get(pk=ser.validated_data['file_id'])
        except SubmissionFile.DoesNotExist:
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

        if sf.owner != request.user and request.user.role != 'admin':
            return Response({"error": "You can only share your own files"}, status=status.HTTP_403_FORBIDDEN)

        try:
            target_user = User.objects.get(username=ser.validated_data['shared_with_username'])
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        share, created = FileShare.objects.get_or_create(
            file=sf,
            shared_with=target_user,
            defaults={'shared_by': request.user},
        )
        if not created:
            return Response({"message": "Already shared"}, status=status.HTTP_200_OK)

        AuditLog.log(
            request.user, 'file_shared',
            {'file_id': sf.id, 'shared_with': target_user.username},
            request,
        )

        return Response(
            FileShareSerializer(share).data,
            status=status.HTTP_201_CREATED,
        )
