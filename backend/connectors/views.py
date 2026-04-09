from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ConnectionConfig
from .serializers import ConnectionConfigSerializer
from .engine import ConnectorFactory


class ConnectionConfigViewSet(viewsets.ModelViewSet):
    serializer_class = ConnectionConfigSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return ConnectionConfig.objects.all()
        return ConnectionConfig.objects.filter(owner=user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _get_connector(self, config: ConnectionConfig):
        return ConnectorFactory(
            db_type=config.db_type,
            host=config.host,
            port=config.port,
            database=config.database,
            username=config.username,
            password=config.password,
        )

    @action(detail=True, methods=['post'], url_path='test')
    def test_connection(self, request, pk=None):
        config = self.get_object()
        connector = self._get_connector(config)
        ok = connector.test_connection()
        return Response(
            {"ok": ok, "message": "Connection successful" if ok else "Connection failed"},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['get'], url_path='tables')
    def list_tables(self, request, pk=None):
        config = self.get_object()
        connector = self._get_connector(config)
        try:
            with connector:
                tables = connector.get_tables()
            return Response({"tables": tables})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='tables/(?P<table>[^/.]+)/columns')
    def table_columns(self, request, pk=None, table=None):
        config = self.get_object()
        connector = self._get_connector(config)
        try:
            with connector:
                columns = connector.get_columns(table)
            return Response({"table": table, "columns": columns})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='tables/(?P<table>[^/.]+)/data')
    def table_data(self, request, pk=None, table=None):
        config = self.get_object()
        limit = min(int(request.query_params.get('limit', 100)), 1000)
        offset = int(request.query_params.get('offset', 0))
        connector = self._get_connector(config)
        try:
            with connector:
                rows = connector.fetch_data(table, limit=limit, offset=offset)
                total = connector.get_row_count(table)
                columns = connector.get_columns(table)
            return Response({
                "table": table,
                "columns": columns,
                "rows": rows,
                "total": total,
                "limit": limit,
                "offset": offset,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='tables/(?P<table>[^/.]+)/count')
    def table_row_count(self, request, pk=None, table=None):
        config = self.get_object()
        connector = self._get_connector(config)
        try:
            with connector:
                count = connector.get_row_count(table)
            return Response({"table": table, "count": count})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
