from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/connectors/', include('connectors.urls')),
    path('api/submissions/', include('submissions.urls')),
]
