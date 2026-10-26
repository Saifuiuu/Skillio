import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# here we define the possible roles in our app for data integrity 
class Role(str, enum.Enum):
    candidate = "candidate"
    employer = "employer"
    admin = "admin"
    interviewer = "interviewer"


class UserStatus(str, enum.Enum):
    active = "active"
    pending_verification = "pending_verification"
    suspended = "suspended"


class User(Base):
    #the table name will be users
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    # Nullable: Google OAuth wale users ka platform password nahi hota
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"))

    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"), default=UserStatus.active
    )

    auth_provider: Mapped[str] = mapped_column(String(20), default="local")

    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )