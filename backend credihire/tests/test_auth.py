import hashlib
import json
import sqlite3
import time
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.dependencies import get_auth_service
from app.main import create_app
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.auth import AuthService


@pytest.mark.asyncio
async def test_register_verify_and_login_with_resend(tmp_path):
    sent_requests = []

    def send_email(request):
        sent_requests.append(request)
        return httpx.Response(200, json={"id": "email_123"})

    settings = Settings(
        _env_file=None,
        auth_database_path=str(tmp_path / "users.sqlite3"),
        resend_api_key="test-key",
        resend_from_email="CrediHire <verify@example.com>",
        frontend_base_url="https://credihire.example",
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(send_email)) as email_client:
        service = AuthService(settings, email_client)
        registration = await service.register(RegisterRequest(name="Ravi Sharma", email="Ravi@example.org", password="secret123"))

        assert registration["user_id"]
        assert registration["email"] == "ravi@example.org"
        request = sent_requests[0]
        assert request.url == "https://api.resend.com/emails"
        assert request.headers["authorization"] == "Bearer test-key"
        email = json.loads(request.read())
        link = email["html"].split('href="', 1)[1].split('"', 1)[0]
        assert link.startswith("https://credihire.example/?verify_email=")
        token = parse_qs(urlparse(link).query)["verify_email"][0]

        with pytest.raises(HTTPException) as unverified:
            service.login(LoginRequest(email="Ravi@example.org", password="secret123"))
        assert unverified.value.status_code == 403

        verified = service.verify(token)
        assert verified["user"].user_id == registration["user_id"]
        with pytest.raises(HTTPException) as incorrect_password:
            service.login(LoginRequest(email="ravi@example.org", password="wrong-password"))
        assert incorrect_password.value.status_code == 401
        assert service.login(LoginRequest(email="ravi@example.org", password="secret123"))["user"].email == "ravi@example.org"

        with sqlite3.connect(settings.auth_database_path) as connection:
            stored_hash = connection.execute("SELECT password_hash FROM users").fetchone()[0]
        assert "secret123" not in stored_hash
        assert hashlib.sha256(token.encode()).hexdigest() not in stored_hash


@pytest.mark.asyncio
async def test_expired_verification_link_is_rejected(tmp_path):
    def send_email(request):
        body = json.loads(request.read())
        link = body["html"].split('href="', 1)[1].split('"', 1)[0]
        send_email.token = parse_qs(urlparse(link).query)["verify_email"][0]
        return httpx.Response(200, json={"id": "email_123"})

    settings = Settings(
        _env_file=None,
        auth_database_path=str(tmp_path / "users.sqlite3"),
        resend_api_key="test-key",
        resend_from_email="verify@example.org",
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(send_email)) as email_client:
        service = AuthService(settings, email_client)
        await service.register(RegisterRequest(name="Ravi Sharma", email="ravi@example.org", password="secret123"))

    with sqlite3.connect(settings.auth_database_path) as connection:
        connection.execute("UPDATE users SET verification_expires_at = 0")

    with pytest.raises(HTTPException) as error:
        service.verify(send_email.token)
    assert error.value.status_code == 400


@pytest.mark.asyncio
async def test_registration_requires_resend_configuration(tmp_path):
    service = AuthService(Settings(_env_file=None, auth_database_path=str(tmp_path / "users.sqlite3")))
    with pytest.raises(HTTPException) as error:
        await service.register(RegisterRequest(name="Ravi Sharma", email="ravi@example.org", password="secret123"))
    assert error.value.status_code == 503
    assert error.value.detail == "Email verification is not configured. Please try again later."


@pytest.mark.asyncio
async def test_failed_resend_delivery_is_not_reported_as_success(tmp_path):
    def reject_email(_):
        return httpx.Response(401, json={"message": "provider details"})

    settings = Settings(
        _env_file=None,
        auth_database_path=str(tmp_path / "users.sqlite3"),
        resend_api_key="test-key",
        resend_from_email="verify@example.org",
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(reject_email)) as email_client:
        service = AuthService(settings, email_client)
        with pytest.raises(HTTPException) as error:
            await service.register(RegisterRequest(name="Ravi Sharma", email="ravi@example.org", password="secret123"))
    assert error.value.status_code == 503
    assert error.value.detail == "Could not send the verification email. Please try again."
    assert "provider details" not in error.value.detail


@pytest.mark.asyncio
async def test_auth_routes_expose_server_generated_user_id(tmp_path):
    def send_email(request):
        return httpx.Response(200, json={"id": "email_123"})

    settings = Settings(
        _env_file=None,
        auth_database_path=str(tmp_path / "users.sqlite3"),
        resend_api_key="test-key",
        resend_from_email="verify@example.org",
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(send_email)) as email_client:
        service = AuthService(settings, email_client)
        app = create_app()
        app.dependency_overrides[get_auth_service] = lambda: service
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.post(
                "/api/v1/auth/register",
                json={"name": "Ravi Sharma", "email": "ravi@example.org", "password": "secret123"},
            )
        assert response.status_code == 201
        assert response.json()["user_id"]
        assert response.json()["email"] == "ravi@example.org"


@pytest.mark.asyncio
async def test_google_sign_in_verifies_identity_with_google_and_creates_persistent_user(tmp_path):
    claims = {
        "aud": "client-id",
        "iss": "https://accounts.google.com",
        "sub": "google-user-123",
        "email": "ravi@company.example",
        "email_verified": "true",
        "exp": str(int(time.time()) + 3600),
        "name": "Ravi Sharma",
    }

    def token_info(request):
        assert request.url.params["id_token"] == "signed-google-token"
        return httpx.Response(200, json=claims)

    settings = Settings(_env_file=None, auth_database_path=str(tmp_path / "users.sqlite3"), google_client_id="client-id")
    async with httpx.AsyncClient(transport=httpx.MockTransport(token_info)) as google_client:
        service = AuthService(settings, google_client=google_client)
        first = await service.login_with_google("signed-google-token")
        second = await service.login_with_google("signed-google-token")

    assert first["user"].user_id == second["user"].user_id
    assert first["user"].email == "ravi@company.example"
    assert first["user"].provider == "google"
    with sqlite3.connect(settings.auth_database_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1
        assert connection.execute("SELECT email_verified, provider, google_sub FROM users").fetchone() == (
            1,
            "google",
            "google-user-123",
        )


@pytest.mark.asyncio
async def test_google_sign_in_route_returns_backend_user_id(tmp_path):
    claims = {
        "aud": "client-id",
        "iss": "https://accounts.google.com",
        "sub": "google-user-456",
        "email": "ravi@example.org",
        "email_verified": "true",
        "exp": str(int(time.time()) + 3600),
        "name": "Ravi Sharma",
    }
    settings = Settings(_env_file=None, auth_database_path=str(tmp_path / "users.sqlite3"), google_client_id="client-id")
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=claims))) as google_client:
        service = AuthService(settings, google_client=google_client)
        app = create_app()
        app.dependency_overrides[get_auth_service] = lambda: service
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.post("/api/v1/auth/google", json={"credential": "signed-google-id-token"})
    assert response.status_code == 200
    assert response.json()["user"]["user_id"]
    assert response.json()["user"]["provider"] == "google"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "claim_overrides",
    [
        {"aud": "wrong-client"},
        {"iss": "https://attacker.example"},
        {"email_verified": "false"},
        {"exp": "1"},
        {"sub": ""},
    ],
)
async def test_google_sign_in_rejects_invalid_google_claims(tmp_path, claim_overrides):
    claims = {
        "aud": "client-id",
        "iss": "https://accounts.google.com",
        "sub": "google-user-123",
        "email": "ravi@example.org",
        "email_verified": "true",
        "exp": str(int(time.time()) + 3600),
    }
    claims.update(claim_overrides)
    settings = Settings(_env_file=None, auth_database_path=str(tmp_path / "users.sqlite3"), google_client_id="client-id")
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=claims))) as google_client:
        service = AuthService(settings, google_client=google_client)
        with pytest.raises(HTTPException) as error:
            await service.login_with_google("untrusted-token")
    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_google_sign_in_requires_client_id(tmp_path):
    service = AuthService(Settings(_env_file=None, auth_database_path=str(tmp_path / "users.sqlite3")))
    with pytest.raises(HTTPException) as error:
        await service.login_with_google("google-token")
    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_google_sign_in_cannot_take_over_existing_password_account(tmp_path):
    claims = {
        "aud": "client-id",
        "iss": "accounts.google.com",
        "sub": "google-user-123",
        "email": "ravi@example.org",
        "email_verified": True,
        "exp": str(int(time.time()) + 3600),
    }
    settings = Settings(_env_file=None, auth_database_path=str(tmp_path / "users.sqlite3"), google_client_id="client-id")
    with sqlite3.connect(settings.auth_database_path) as connection:
        connection.execute(
            """CREATE TABLE users (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL, email_verified INTEGER NOT NULL DEFAULT 0,
                verification_token_hash TEXT NOT NULL, verification_expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )"""
        )
        connection.execute(
            "INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("existing-id", "Ravi Sharma", "ravi@example.org", "hash", 1, "token-hash", 0, 0),
        )
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=claims))) as google_client:
        service = AuthService(settings, google_client=google_client)
        with pytest.raises(HTTPException) as error:
            await service.login_with_google("signed-google-token")
    assert error.value.status_code == 409
