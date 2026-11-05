from typing import Literal

from pydantic import BaseModel

from app.Dtos.user import UserOut


class UserStatusUpdateRequest(BaseModel):
    """Approve (active) or suspend/disable a user."""

    status: Literal["active", "suspended"]


class PaginatedUsersOut(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int
