from pydantic import BaseModel, ConfigDict, Field, field_validator


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.lower()
        local, separator, domain = normalized.rpartition("@")
        if not separator or not local or "." not in domain or any(char.isspace() for char in normalized):
            raise ValueError("Enter a valid email address")
        return normalized


class VerifyEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=20, max_length=200)


class GoogleLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    credential: str = Field(min_length=20, max_length=10_000)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class AccountResponse(BaseModel):
    user_id: str
    name: str
    email: str
    provider: str = "email"


class RegisterResponse(BaseModel):
    user_id: str
    email: str
    message: str


class VerifyEmailResponse(BaseModel):
    user: AccountResponse
    message: str


class LoginResponse(BaseModel):
    user: AccountResponse
