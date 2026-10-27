import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.user import Role, UserStatus


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    status: UserStatus
    is_email_verified: bool
    created_at: datetime

#it tells pydantic if data is in the form alchemy object you can extract data 
# from attribute dont throw error normally pydantic only except data in dict form
    model_config = ConfigDict(from_attributes=True)