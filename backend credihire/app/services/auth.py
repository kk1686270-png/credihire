import hashlib
import html
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from uuid import uuid4

import httpx
from fastapi import HTTPException, status

from app.core.config import Settings
from app.schemas.auth import AccountResponse, LoginRequest, RegisterRequest

PASSWORD_HASH_ITERATIONS = 310_000
VERIFICATION_TOKEN_TTL_SECONDS = 24 * 60 * 60
RESEND_API_URL = "https://api.resend.com/emails"
GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"


def _hash_password(password: str, salt: bytes | None = None) -> str:
    actual_salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), actual_salt, PASSWORD_HASH_ITERATIONS)
    return f"{actual_salt.hex()}:{digest.hex()}"


def _password_matches(password: str, stored_hash: str) -> bool:
    salt_hex, _, expected_digest = stored_hash.partition(":")
    if not expected_digest:
        return False
    actual_hash = _hash_password(password, bytes.fromhex(salt_hex)).partition(":")[2]
    return secrets.compare_digest(actual_hash, expected_digest)


class AuthService:
    def __init__(
        self,
        settings: Settings,
        email_client: httpx.AsyncClient | None = None,
        google_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings
        self.email_client = email_client
        self.google_client = google_client

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        database_path = Path(self.settings.auth_database_path)
        database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(database_path, timeout=10)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    password_hash TEXT NOT NULL,
                    email_verified INTEGER NOT NULL DEFAULT 0,
                    verification_token_hash TEXT NOT NULL,
                    verification_expires_at INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    provider TEXT NOT NULL DEFAULT 'email',
                    google_sub TEXT
                )
                """
            )
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(users)")}
            if "provider" not in columns:
                connection.execute("ALTER TABLE users ADD COLUMN provider TEXT NOT NULL DEFAULT 'email'")
            if "google_sub" not in columns:
                connection.execute("ALTER TABLE users ADD COLUMN google_sub TEXT")
            connection.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL"
            )
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    async def register(self, request: RegisterRequest) -> dict[str, str]:
        email = request.email.lower()
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        now = int(time.time())
        with self._connect() as connection:
            existing = connection.execute("SELECT id, email_verified FROM users WHERE email = ?", (email,)).fetchone()
            if existing and existing["email_verified"]:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists. Please sign in.")

            if existing:
                user_id = existing["id"]
                connection.execute(
                    """UPDATE users SET name = ?, password_hash = ?, verification_token_hash = ?,
                       verification_expires_at = ? WHERE id = ?""",
                    (request.name, _hash_password(request.password), token_hash, now + VERIFICATION_TOKEN_TTL_SECONDS, user_id),
                )
            else:
                user_id = str(uuid4())
                connection.execute(
                    """INSERT INTO users
                       (id, name, email, password_hash, verification_token_hash, verification_expires_at, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (user_id, request.name, email, _hash_password(request.password), token_hash, now + VERIFICATION_TOKEN_TTL_SECONDS, now),
                )

        await self._send_verification_email(email, request.name, user_id, token)
        return {
            "user_id": user_id,
            "email": email,
            "message": "Account created. Check your email for a verification link.",
        }

    async def _send_verification_email(self, email: str, name: str, user_id: str, token: str) -> None:
        if not self.settings.resend_api_key or not self.settings.resend_from_email:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email verification is not configured. Please try again later.")

        verification_url = f"{str(self.settings.frontend_base_url).rstrip('/')}/?verify_email={token}"
        safe_name = html.escape(name)
        safe_user_id = html.escape(user_id)
        payload = {
            "from": self.settings.resend_from_email,
            "to": [email],
            "subject": "Verify your CrediHire account",
            "html": (
                f"<p>Hello {safe_name},</p>"
                "<p>Use the link below to verify your CrediHire email address. "
                "This link expires in 24 hours.</p>"
                f'<p><a href="{html.escape(verification_url, quote=True)}">Verify my email</a></p>'
                f"<p>Your CrediHire user ID: <code>{safe_user_id}</code></p>"
                "<p>If you did not create this account, you can ignore this email.</p>"
            ),
        }
        try:
            if self.email_client:
                response = await self.email_client.post(
                    RESEND_API_URL,
                    headers={"Authorization": f"Bearer {self.settings.resend_api_key}"},
                    json=payload,
                )
            else:
                async with httpx.AsyncClient(timeout=10) as client:
                    response = await client.post(
                        RESEND_API_URL,
                        headers={"Authorization": f"Bearer {self.settings.resend_api_key}"},
                        json=payload,
                    )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not send the verification email. Please try again.") from exc

    async def login_with_google(self, credential: str) -> dict[str, object]:
        if not self.settings.google_client_id:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not configured.")

        try:
            if self.google_client:
                response = await self.google_client.get(GOOGLE_TOKEN_INFO_URL, params={"id_token": credential})
            else:
                async with httpx.AsyncClient(timeout=10) as client:
                    response = await client.get(GOOGLE_TOKEN_INFO_URL, params={"id_token": credential})
            response.raise_for_status()
            claims = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google sign-in could not be verified. Please try again.") from exc

        if not isinstance(claims, dict):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google sign-in could not be verified. Please try again.")
        now = int(time.time())
        try:
            expires_at = int(claims.get("exp", 0))
        except (TypeError, ValueError):
            expires_at = 0
        if (
            claims.get("aud") != self.settings.google_client_id
            or claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com")
            or not isinstance(claims.get("sub"), str)
            or not claims["sub"]
            or claims.get("email_verified") not in (True, "true")
            or not isinstance(claims.get("email"), str)
            or not claims["email"].strip()
            or expires_at <= now
        ):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google sign-in could not be verified. Please try again.")

        email = claims["email"].strip().lower()
        name = claims.get("name") or claims.get("given_name") or "Google User"
        if not isinstance(name, str) or not name.strip():
            name = "Google User"
        name = name.strip()[:100]
        picture = claims.get("picture")
        with self._connect() as connection:
            user = connection.execute(
                "SELECT id, name, email, provider FROM users WHERE google_sub = ?",
                (claims["sub"],),
            ).fetchone()
            email_user = connection.execute("SELECT id, provider FROM users WHERE email = ?", (email,)).fetchone()
            if user and email_user and user["id"] != email_user["id"]:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email is already registered with another account.")
            if user and user["provider"] != "google":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email is already registered with a password. Sign in with email instead.")
            if not user and email_user and email_user["provider"] != "google":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email is already registered with a password. Sign in with email instead.")
            if user:
                user_id = user["id"]
                connection.execute("UPDATE users SET name = ?, email = ? WHERE id = ?", (name, email, user_id))
            elif email_user:
                user_id = email_user["id"]
                connection.execute(
                    "UPDATE users SET name = ?, provider = 'google', google_sub = ?, email_verified = 1 WHERE id = ?",
                    (name, claims["sub"], user_id),
                )
            else:
                user_id = str(uuid4())
                placeholder_hash = _hash_password(secrets.token_urlsafe(32))
                placeholder_token_hash = hashlib.sha256(secrets.token_bytes(32)).hexdigest()
                connection.execute(
                    """INSERT INTO users
                       (id, name, email, password_hash, email_verified, verification_token_hash,
                        verification_expires_at, created_at, provider, google_sub)
                       VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'google', ?)""",
                    (user_id, name, email, placeholder_hash, placeholder_token_hash, now, now, claims["sub"]),
                )

        return {
            "user": AccountResponse(user_id=user_id, name=name, email=email, provider="google"),
            "picture": picture,
        }

    def verify(self, token: str) -> dict[str, object]:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        with self._connect() as connection:
            user = connection.execute(
                "SELECT id, name, email, email_verified, verification_expires_at FROM users WHERE verification_token_hash = ?",
                (token_hash,),
            ).fetchone()
            if not user:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This verification link is invalid or has expired.")
            if not user["email_verified"] and user["verification_expires_at"] < int(time.time()):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This verification link is invalid or has expired.")
            connection.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user["id"],))
        account = AccountResponse(user_id=user["id"], name=user["name"], email=user["email"])
        return {"user": account, "message": "Email verified. You can now sign in."}

    def login(self, request: LoginRequest) -> dict[str, object]:
        with self._connect() as connection:
            user = connection.execute(
                "SELECT id, name, email, password_hash, email_verified FROM users WHERE email = ?",
                (request.email,),
            ).fetchone()
        if not user or not _password_matches(request.password, user["password_hash"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect.")
        if not user["email_verified"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before signing in.")
        return {"user": AccountResponse(user_id=user["id"], name=user["name"], email=user["email"])}
