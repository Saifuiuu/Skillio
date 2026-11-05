import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import TokenError, decode_token, token_version_ok
from app.models.user import User, UserStatus


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(token, expected_type="access")
    except TokenError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e))

    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None or user.status == UserStatus.suspended:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not available")
    if not token_version_ok(payload, user.token_version):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


def get_current_user_optional(
    request: Request, db: Session = Depends(get_db)
) -> User | None:
    token = request.cookies.get("access_token")
    if not token:
        return None
    try:
        return get_current_user(request, db)
    except HTTPException:
        return None


def require_role(*roles: str) -> Callable[..., User]:
    """Reusable RBAC dependency. Example: Depends(require_role("admin"))."""

    allowed = frozenset(roles)

    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
        return current_user

    return _dependency


require_employer = require_role("employer")


def require_active_verified_employer(
    current_user: User = Depends(require_employer),
) -> User:
    if not current_user.email_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Email must be verified before posting jobs",
        )
    if current_user.status != UserStatus.active:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Employer account must be approved before posting jobs",
        )
    return current_user
