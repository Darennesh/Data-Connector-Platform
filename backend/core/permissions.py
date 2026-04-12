from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdmin(BasePermission):
    """Allow access only to admin users."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'


class IsAdminOrReadOnly(BasePermission):
    """Admin can do anything; regular users get read-only access."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role == 'admin'


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level: owner of the object or admin can access.
    List-level: requires authentication (queryset filtering handles scoping).
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        owner = getattr(obj, 'owner', None)
        if owner is None:
            owner = getattr(obj, 'shared_by', None)
        return owner == request.user


class IsOwnerOrAdminOrShared(BasePermission):
    """
    For files: owner, admin, or user the file was shared with.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        if getattr(obj, 'owner', None) == request.user:
            return True
        # Check if shared with the requesting user
        if hasattr(obj, 'shares'):
            return obj.shares.filter(shared_with=request.user).exists()
        return False
