from rest_framework import viewsets
from .models import ConnectionConfig
from .serializers import ConnectionConfigSerializer


class ConnectionConfigViewSet(viewsets.ModelViewSet):
    serializer_class = ConnectionConfigSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return ConnectionConfig.objects.all()
        return ConnectionConfig.objects.filter(owner=user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
