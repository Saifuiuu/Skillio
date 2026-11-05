import logging
import secrets
import uuid
from urllib.parse import urlencode

import httpx
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    Response,
    status,
)
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.email import (
    build_email_verification_email,
    build_google_only_reset_email,
    build_password_reset_email,
    send_email,
)
from app.core.rate_limit import (
    forgot_password_limit,
    limiter,
    login_limit,
    register_limit,
    resend_verification_limit,
    reset_password_limit,
)
from app.core.security import (
    TokenError,
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    token_version_ok,
    verify_password,
)
from app.Dtos.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.Dtos.user import UserOut
from app.models.user import Role, User, UserStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_SECURE = settings.COOKIE_SECURE
ACCESS_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
OAUTH_STATE_COOKIE = "oauth_state"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def _set_auth_cookies(response: Response, *, access_token: str, refresh_token: str) -> None:
    common = {
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": "lax",
        "path": "/",
    }
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ACCESS_MAX_AGE,
        **common,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=REFRESH_MAX_AGE,
        **common,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def _issue_session(response: Response, user: User) -> None:
    _set_auth_cookies(
        response,
        access_token=create_access_token(
            user.id, user.role.value, token_version=user.token_version
        ),
        refresh_token=create_refresh_token(user.id, token_version=user.token_version),
    )


def _safe_send_email(
    *, to: str, subject: str, body: str, html: str | None = None
) -> None:
    try:
        send_email(to=to, subject=subject, body=body, html=html)
    except Exception:
        logger.exception("Failed to send email to %s", to)


def _queue_verification_email(background_tasks: BackgroundTasks, user: User) -> None:
    token = create_email_verification_token(user.id, user.email)
    verify_url = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={token}"
    subject, text, html = build_email_verification_email(
        verify_url=verify_url,
        expire_hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS,
    )
    background_tasks.add_task(
        _safe_send_email,
        to=user.email,
        subject=subject,
        body=text,
        html=html,
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(register_limit)
def register(
    request: Request,
    data: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    existing = db.scalar(select(User).where(User.email == data.email))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    role = Role(data.role)
    user_status = (
        UserStatus.active if role == Role.candidate else UserStatus.pending_verification
    )

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role=role,
        status=user_status,
        auth_provider="local",
        email_verified=False,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    db.refresh(user)
    _queue_verification_email(background_tasks, user)
    return user


@router.post("/verify-email", status_code=status.HTTP_204_NO_CONTENT)
def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(data.token, expected_type="verify_email")
    except TokenError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Invalid or expired verification link"
        )

    user = db.get(User, user_id)
    token_email = payload.get("email")
    if (
        user is None
        or user.status == UserStatus.suspended
        or not isinstance(token_email, str)
        or token_email != user.email
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Invalid or expired verification link"
        )

    if not user.email_verified:
        user.email_verified = True
        db.commit()


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(resend_verification_limit)
def resend_verification(
    request: Request,
    data: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Always 204 — do not reveal whether the email exists.
    user = db.scalar(select(User).where(User.email == data.email))
    if user is None or user.status == UserStatus.suspended or user.email_verified:
        return
    _queue_verification_email(background_tasks, user)


@router.post("/login", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(login_limit)
def login(
    request: Request,
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.email == data.email))

    if user is not None and user.password_hash is None and user.auth_provider == "google":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This account uses Google Sign-In. Continue with Google instead.",
        )

    if (
        user is None
        or user.password_hash is None
        or not verify_password(data.password, user.password_hash)
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    if user.status == UserStatus.suspended:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")

    _issue_session(response, user)


@router.post("/refresh", status_code=status.HTTP_204_NO_CONTENT)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except TokenError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e))

    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None or user.status == UserStatus.suspended:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not available")
    if not token_version_ok(payload, user.token_version):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    _issue_session(response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    _clear_auth_cookies(response)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(forgot_password_limit)
def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Always 204 — do not reveal whether the email exists (timing via BackgroundTasks).
    user = db.scalar(select(User).where(User.email == data.email))
    if user is None or user.status == UserStatus.suspended:
        return

    if user.password_hash is None and user.auth_provider == "google":
        subject, text, html = build_google_only_reset_email()
        background_tasks.add_task(
            _safe_send_email,
            to=user.email,
            subject=subject,
            body=text,
            html=html,
        )
        return

    token = create_password_reset_token(user.id, token_version=user.token_version)
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    subject, text, html = build_password_reset_email(
        reset_url=reset_url,
        expire_minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES,
    )
    background_tasks.add_task(
        _safe_send_email,
        to=user.email,
        subject=subject,
        body=text,
        html=html,
    )


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(reset_password_limit)
def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    try:
        payload = decode_token(data.token, expected_type="password_reset")
    except TokenError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None or user.status == UserStatus.suspended:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset link")
    if not token_version_ok(payload, user.token_version):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset link")

    user.password_hash = hash_password(data.password)
    user.token_version = user.token_version + 1
    if user.auth_provider == "google":
        user.auth_provider = "local"
    db.commit()


@router.get("/google")
def google_login():
    if not settings.google_oauth_configured:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Google Sign-In is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )

    state = secrets.token_urlsafe(32)
    params = urlencode(
        {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "online",
            "include_granted_scopes": "true",
            "prompt": "select_account",
            "state": state,
        }
    )
    response = RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{params}", status_code=302)
    response.set_cookie(
        key=OAUTH_STATE_COOKIE,
        value=state,
        max_age=600,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    return response


@router.get("/google/callback")
def google_callback(
    request: Request,
    db: Session = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    frontend = settings.FRONTEND_URL.rstrip("/")

    if error:
        return RedirectResponse(url=f"{frontend}/login?error=google_denied", status_code=302)

    cookie_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if (
        not code
        or not state
        or not cookie_state
        or len(state) != len(cookie_state)
        or not secrets.compare_digest(state, cookie_state)
    ):
        return RedirectResponse(url=f"{frontend}/login?error=google_state", status_code=302)

    try:
        with httpx.Client(timeout=20.0) as client:
            token_res = client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            token_res.raise_for_status()
            tokens = token_res.json()
            access = tokens.get("access_token")
            if not access:
                raise ValueError("No access_token from Google")

            info_res = client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access}"},
            )
            info_res.raise_for_status()
            info = info_res.json()
    
    except (httpx.HTTPError, ValueError):
        return RedirectResponse(url=f"{frontend}/login?error=google_exchange", status_code=302)

    email = (info.get("email") or "").strip().lower()
    if not email or not info.get("email_verified", False):
        return RedirectResponse(url=f"{frontend}/login?error=google_email", status_code=302)

    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            password_hash=None,
            role=Role.candidate,
            status=UserStatus.active,
            auth_provider="google",
            email_verified=True,
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                return RedirectResponse(
                    url=f"{frontend}/login?error=google_create", status_code=302
                )
        else:
            db.refresh(user)
    else:
        if user.status == UserStatus.suspended:
            return RedirectResponse(
                url=f"{frontend}/login?error=account_suspended", status_code=302
            )
        # Unverified password account + Google link: invalidate password & sessions
        # so an attacker who registered first cannot keep the old password.
        if not user.email_verified and user.password_hash is not None:
            user.password_hash = None
            user.token_version = user.token_version + 1
            user.auth_provider = "google"
            user.email_verified = True
        else:
            user.email_verified = True
            if user.auth_provider == "local" and user.password_hash is None:
                user.auth_provider = "google"
        db.commit()
        db.refresh(user)

    response = RedirectResponse(url=f"{frontend}/dashboard", status_code=302)
    _issue_session(response, user)
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/")
    return response
