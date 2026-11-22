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


class EmailHeaderRequest(BaseModel):
    raw_header: str = Field(..., min_length=5, max_length=50000, description="Raw RFC 5322 email headers")


class EmailHeaderResponse(BaseModel):
    sender: str
    return_path: str | None = None
    spf_status: str  # pass, fail, softfail, neutral, none
    dkim_status: str  # pass, fail, none
    dmarc_status: str  # pass, fail, none
    originating_ip: str | None = None
    is_spoofed: bool
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: str
    flags: list[dict[str, str]] = []
    recommendations: list[str] = []
    summary: str


class DocumentMetadataRequest(BaseModel):
    file_name: str
    file_bytes_base64: str | None = None
    text_content: str | None = None


class DocumentMetadataResponse(BaseModel):
    file_name: str
    file_type: str
    software_tool: str | None = None
    is_tampered_or_canva: bool
    creator: str | None = None
    producer: str | None = None
    creation_date: str | None = None
    mod_date: str | None = None
    has_digital_signature: bool
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: str
    forensic_findings: list[dict[str, str]] = []
    recommendations: list[str] = []
    summary: str


class QrCodeTrapRequest(BaseModel):
    qr_payload_or_uri: str = Field(..., min_length=3, max_length=2000, description="Decoded QR payload or UPI URI string")
    context_text: str | None = None


class QrCodeTrapResponse(BaseModel):
    raw_payload: str
    is_upi_scheme: bool
    is_debit_trap: bool
    vpa_payee: str | None = None
    payee_name: str | None = None
    demanded_amount: str | None = None
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: str
    deception_indicators: list[dict[str, str]] = []
    recommendations: list[str] = []
    summary: str


class CompanyCinRequest(BaseModel):
    cin_or_gstin: str = Field(..., min_length=3, max_length=50, description="21-character CIN or 15-character GSTIN")
    company_name_claimed: str | None = None


class CompanyCinResponse(BaseModel):
    query_id: str
    id_type: str  # CIN, GSTIN, INVALID
    is_valid_format: bool
    state_code: str | None = None
    state_name: str | None = None
    industry_category: str | None = None
    incorporation_year: int | None = None
    entity_class: str | None = None
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: str
    verification_details: list[dict[str, str]] = []
    recommendations: list[str] = []
    summary: str
