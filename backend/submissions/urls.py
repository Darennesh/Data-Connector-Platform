from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SubmissionViewSet, SubmissionFileViewSet, FileShareViewSet

router = DefaultRouter()
router.register(r'files', SubmissionFileViewSet, basename='submission-file')
router.register(r'shares', FileShareViewSet, basename='file-share')
router.register(r'', SubmissionViewSet, basename='submission')

urlpatterns = [
    path('', include(router.urls)),
]
