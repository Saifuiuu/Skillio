from fastapi import APIRouter, Depends

from app.api.deps import require_role
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])

require_admin = require_role("admin")


@router.get("/ping")
def ping(current_user: User = Depends(require_admin)):
    return {"ok": True, "role": current_user.role.value}