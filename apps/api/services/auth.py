"""Authentication service for JWT and password handling."""

from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from apps.api.config import get_settings

settings = get_settings()

# Use truncate_error=False to handle the bcrypt 72-byte limit gracefully
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__truncate_error=False,
)


class AuthService:
    """Service for authentication operations."""

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt."""
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def create_access_token(user_id: str) -> str:
        """Create a JWT access token."""
        expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
        to_encode = {
            "sub": user_id,
            "exp": expire,
            "type": "access",
        }
        return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    @staticmethod
    def create_refresh_token(user_id: str) -> str:
        """Create a JWT refresh token."""
        expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
        to_encode = {
            "sub": user_id,
            "exp": expire,
            "type": "refresh",
        }
        return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    @staticmethod
    def decode_token(token: str) -> dict | None:
        """Decode and validate a JWT token."""
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
            )
            return payload
        except JWTError:
            return None

    @staticmethod
    def verify_access_token(token: str) -> str | None:
        """Verify an access token and return the user ID."""
        payload = AuthService.decode_token(token)
        if payload is None:
            return None
        if payload.get("type") != "access":
            return None
        return payload.get("sub")

    @staticmethod
    def verify_refresh_token(token: str) -> str | None:
        """Verify a refresh token and return the user ID."""
        payload = AuthService.decode_token(token)
        if payload is None:
            return None
        if payload.get("type") != "refresh":
            return None
        return payload.get("sub")
