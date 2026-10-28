import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import TokenError, decode_token
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
    return user