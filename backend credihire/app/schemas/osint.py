from typing import Any
from pydantic import BaseModel, Field


class DomainIntelRequest(BaseModel):
    domain_or_url: str = Field(..., min_length=1, max_length=2000, description="Domain name or recruitment URL to investigate")


class DomainIntelResponse(BaseModel):
    domain: str
    clean_url: str
    domain_age_days: int | None = None
    registration_date: str | None = None
    expiration_date: str | None = None
    registrar: str | None = None
    risk_level: str  # safe, low, medium, high, critical
    risk_score: int = Field(..., ge=0, le=100)
    dns_resolvable: bool
    is_free_mail_provider: bool
    impersonation_target: str | None = None
    indicators: list[dict[str, str]] = []
    recommendations: list[str] = []
    summary: str


class UpiIntelRequest(BaseModel):
    upi_id_or_uri: str = Field(..., min_length=3, max_length=1000, description="UPI ID (VPA) or upi:// payment string")
    context_text: str | None = Field(default=None, max_length=4000, description="Accompanying job offer or request text")


class UpiIntelResponse(BaseModel):
    upi_id: str
    payee_name: str | None = None
    psp_bank: str
    is_personal_psp: bool
    demanded_amount: str | None = None
    risk_level: str
    risk_score: int = Field(..., ge=0, le=100)
    flags: list[dict[str, str]] = []
    recommendations: list[str] = []
    summary: str


class ForwardedMessageRequest(BaseModel):
    raw_message: str = Field(..., min_length=1, max_length=10000, description="Raw forwarded WhatsApp/Telegram message text")


class ForwardedMessageResponse(BaseModel):
    is_forwarded: bool
    detected_platform: str
    suspicious_phone_numbers: list[str] = []
    telegram_links: list[str] = []
    external_links: list[str] = []
    promised_earnings: str | None = None
    demanded_fees: str | None = None
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: str
    indicators: list[dict[str, str]] = []
    clean_message: str
    summary: str


class DossierPdfRequest(BaseModel):
    dossier_id: str | None = None
    scan_title: str = "CrediHire Scam Investigation Dossier"
    risk_score: int = Field(default=85, ge=0, le=100)
    risk_level: str = "high"
    job_text: str = Field(..., min_length=1, max_length=12000)
    demanded_amount: str | None = None
    payment_handle: str | None = None
    scammer_contact: str | None = None
    indicators: list[str] = []
    evidence: list[dict[str, Any]] = []
    recommendations: list[str] = []
