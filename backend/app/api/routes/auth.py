import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import Role, User, UserStatus
from app.Dtos.auth import (
    AccessTokenResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.Dtos.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    # check if email already registerd return first matching result
    existing = db.scalar(select(User).where(User.email == data.email))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    # check role status
    role = Role(data.role)
    user_status = (
        UserStatus.active if role == Role.candidate else UserStatus.pending_verification
    )

    # creating user while hashing password
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role=role,
        status=user_status,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # if two user with same mail try to register at same time so database through
        # integrity eror to handle this error we use rollback which rollback all transectio we made in this 
        # sesion and clear session 
       
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    db.refresh(user)
    return user


@router.post("/login",response_model=TokenResponse)
def login(data:LoginRequest,db:Session=Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email))

    if (
        user is None
        or user.password_hash is None 
        or not verify_password(data.password, user.password_hash)
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    if user.status == UserStatus.suspended:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(data.refresh_token, expected_type="refresh")
    except TokenError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,str(e))

    user = db.get(User,uuid.UUID(payload["sub"]))
    if user is None or user.status == UserStatus.suspended:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not available")

    return AccessTokenResponse(access_token=create_access_token(user.id, user.role.value))