from rest_framework import serializers
from .models import Submission, SubmissionFile, FileShare


class SubmissionFileSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionFile
        fields = (
            'id', 'submission', 'file', 'format',
            'source_metadata', 'owner', 'created_at', 'download_url',
        )
        read_only_fields = ('id', 'owner', 'created_at', 'download_url')

    def get_download_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class SubmissionSerializer(serializers.ModelSerializer):
    files = SubmissionFileSerializer(many=True, read_only=True)
    connection_name = serializers.CharField(
        source='connection.name', read_only=True, default=None,
    )

    class Meta:
        model = Submission
        fields = (
            'id', 'connection', 'connection_name', 'table_name',
            'row_count', 'data', 'owner', 'created_at', 'files',
        )
        read_only_fields = ('id', 'owner', 'row_count', 'created_at', 'files')


class SubmissionCreateSerializer(serializers.Serializer):
    """Used for the batch-extract-and-submit workflow."""
    connection_id = serializers.IntegerField()
    table_name = serializers.CharField(max_length=255)
    data = serializers.ListField(child=serializers.DictField())
    export_formats = serializers.ListField(
        child=serializers.ChoiceField(choices=['json', 'csv']),
        required=False,
        default=['json', 'csv'],
    )


class FileShareSerializer(serializers.ModelSerializer):
    shared_with_username = serializers.CharField(
        source='shared_with.username', read_only=True,
    )
    shared_by_username = serializers.CharField(
        source='shared_by.username', read_only=True,
    )

    class Meta:
        model = FileShare
        fields = (
            'id', 'file', 'shared_with', 'shared_with_username',
            'shared_by', 'shared_by_username', 'created_at',
        )
        read_only_fields = ('id', 'shared_by', 'created_at')


class FileShareCreateSerializer(serializers.Serializer):
    file_id = serializers.IntegerField()
    shared_with_username = serializers.CharField()
