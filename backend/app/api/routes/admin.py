import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.Dtos.admin import PaginatedUsersOut, UserStatusUpdateRequest
from app.Dtos.user import UserOut
from app.models.user import Role, User, UserStatus

router = APIRouter(prefix="/admin", tags=["admin"])

require_admin = require_role("admin")

_MAX_PAGE_SIZE = 100


@router.get("/ping")
def ping(current_user: User = Depends(require_admin)):
    return {"ok": True, "role": current_user.role.value}


@router.get("/users", response_model=PaginatedUsersOut)
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=_MAX_PAGE_SIZE),
    role: Role | None = Query(None),
    status_filter: UserStatus | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    filters = []
    if role is not None:
        filters.append(User.role == role)
    if status_filter is not None:
        filters.append(User.status == status_filter)

    count_stmt = select(func.count()).select_from(User)
    list_stmt = select(User).order_by(User.created_at.desc())
    if filters:
        count_stmt = count_stmt.where(*filters)
        list_stmt = list_stmt.where(*filters)

    total = db.scalar(count_stmt) or 0
    offset = (page - 1) * page_size
    items = db.scalars(list_stmt.offset(offset).limit(page_size)).all()

    return PaginatedUsersOut(
        items=list(items),
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.patch("/users/{user_id}/status", response_model=UserOut)
def update_user_status(
    user_id: uuid.UUID,
    data: UserStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    new_status = UserStatus(data.status)
    if user.id == current_user.id and new_status == UserStatus.suspended:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Admins cannot suspend their own account",
        )

    becoming_suspended = (
        new_status == UserStatus.suspended and user.status != UserStatus.suspended
    )
    user.status = new_status
    if becoming_suspended:
        user.token_version = user.token_version + 1
    db.commit()
    db.refresh(user)
    return user
