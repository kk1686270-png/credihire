from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field

from app.dependencies import (
    get_auth_service,
    get_chatbot_service,
    get_evidence_pdf_generator,
    get_osint_service,
    get_scam_service,
    get_url_credibility_service,
    rule_engine_readiness_status,
)
from app.core.config import get_settings
from app.integrations.llm_client import LLMRateLimited, LLMUnavailable
from app.schemas.auth import GoogleLoginRequest, LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, VerifyEmailRequest, VerifyEmailResponse
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse
from app.schemas.osint import (
    CompanyCinRequest,
    CompanyCinResponse,
    DocumentMetadataRequest,
    DocumentMetadataResponse,
    DomainIntelRequest,
    DomainIntelResponse,
    DossierPdfRequest,
    EmailHeaderRequest,
    EmailHeaderResponse,
    ForwardedMessageRequest,
    ForwardedMessageResponse,
    QrCodeTrapRequest,
    QrCodeTrapResponse,
    UpiIntelRequest,
    UpiIntelResponse,
)
from app.schemas.scam import ScamAnalysisRequest, ScamAnalysisResponse
from app.schemas.upload import UploadAnalysisResponse
from app.schemas.url import UrlAnalysisRequest, UrlAnalysisResponse
from app.services.auth import AuthService
from app.services.chatbot import ChatbotService
from app.services.evidence_pdf import EvidencePdfGenerator
from app.services.homoglyph import analyze_homoglyphs
from app.services.osint import OsintService
from app.services.pii_redactor import redact_pii
from app.services.scam_analysis import RuleEngineFailure, ScamAnalysisService
from app.services.upload_extraction import MAX_UPLOAD_BYTES, UploadExtractionError, UploadTextExtractor
from app.services.url_credibility import UrlCredibilityService


class HomoglyphRequest(BaseModel):
    domain_or_url: str = Field(..., min_length=1, max_length=2000)


class PiiRedactRequest(BaseModel):
    text: str = Field(..., max_length=50000)

router = APIRouter(prefix="/api/v1")


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/auth/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED, summary="Create an account and send an email verification link")
async def register(request: RegisterRequest, service: AuthService = Depends(get_auth_service)) -> dict[str, str]:
    return await service.register(request)


@router.post("/auth/verify", response_model=VerifyEmailResponse, summary="Verify an account email address")
async def verify_email(request: VerifyEmailRequest, service: AuthService = Depends(get_auth_service)) -> dict[str, object]:
    return service.verify(request.token)


@router.post("/auth/google", response_model=LoginResponse, summary="Verify a Google ID token and sign in")
async def login_with_google(request: GoogleLoginRequest, service: AuthService = Depends(get_auth_service)) -> dict[str, object]:
    return await service.login_with_google(request.credential)


@router.post("/auth/login", response_model=LoginResponse, summary="Sign in to a verified account")
async def login(request: LoginRequest, service: AuthService = Depends(get_auth_service)) -> dict[str, object]:
    return service.login(request)


@router.get("/ready")
async def ready(service: ChatbotService = Depends(get_chatbot_service)) -> dict[str, object]:
    components = {
        "rule_engine": rule_engine_readiness_status(),
        "llm": await service.readiness_status(),
    }
    return {"status": "ready" if all(value == "ready" for value in components.values()) else "degraded", "components": components}


@router.post("/scam/analyze", response_model=ScamAnalysisResponse, summary="Analyze a job or task offer", response_description="Structured risk assessment with explainable indicators.")
async def analyze(request: ScamAnalysisRequest, service: ScamAnalysisService = Depends(get_scam_service)) -> ScamAnalysisResponse:
    try:
        return await service.analyze_with_enrichment(request)
    except RuleEngineFailure as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scam analysis is unavailable") from exc


@router.post("/url/analyze", response_model=UrlAnalysisResponse, summary="Analyze recruitment website URL credibility", response_description="Structured safety, SSRF-safe redirect, and impersonation assessment for recruitment URLs.")
async def analyze_url(request: UrlAnalysisRequest, service: UrlCredibilityService = Depends(get_url_credibility_service)) -> UrlAnalysisResponse:
    try:
        return await service.analyze(request)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="URL analysis service is temporarily unavailable") from exc


@router.post("/scam/analyze/upload", response_model=UploadAnalysisResponse, summary="Analyze an uploaded PDF or screenshot", response_description="Extracted text plus deterministic scam analysis.")
async def analyze_upload(file: UploadFile = File(...), service: ScamAnalysisService = Depends(get_scam_service)) -> UploadAnalysisResponse:
    try:
        data = await file.read(MAX_UPLOAD_BYTES + 1)
        extracted = UploadTextExtractor(get_settings().tesseract_cmd).extract(file.filename, file.content_type, data)
        analysis = await service.analyze_with_enrichment(ScamAnalysisRequest(job_text=extracted.text))
        return UploadAnalysisResponse(media_type=extracted.media_type, extracted_text=extracted.text, analysis=analysis)
    except UploadExtractionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except RuleEngineFailure as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scam analysis is unavailable") from exc
    finally:
        await file.close()


@router.post("/chat/messages", response_model=ChatMessageResponse, summary="Send a chatbot message", response_description="Safe scam-awareness guidance for the submitted message.")
async def chat(request: ChatMessageRequest, service: ChatbotService = Depends(get_chatbot_service)) -> ChatMessageResponse:
    try:
        return await service.respond(request)
    except LLMRateLimited as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Chat service is temporarily rate-limited") from exc
    except (LLMUnavailable, RuleEngineFailure) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Chat service is unavailable") from exc


@router.post("/osint/domain", response_model=DomainIntelResponse, summary="Analyze recruiter domain age, DNS, and impersonation")
async def analyze_domain(request: DomainIntelRequest, service: OsintService = Depends(get_osint_service)) -> DomainIntelResponse:
    try:
        return await service.analyze_domain(request)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Domain analysis failed: {str(exc)}") from exc


@router.post("/osint/upi", response_model=UpiIntelResponse, summary="Analyze UPI ID / VPA for personal account recruitment fraud")
async def analyze_upi(request: UpiIntelRequest, service: OsintService = Depends(get_osint_service)) -> UpiIntelResponse:
    try:
        return service.analyze_upi(request)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"UPI analysis failed: {str(exc)}") from exc


@router.post("/osint/forwarded-message", response_model=ForwardedMessageResponse, summary="Analyze forwarded WhatsApp/Telegram recruitment message")
async def analyze_forwarded_message(request: ForwardedMessageRequest, service: OsintService = Depends(get_osint_service)) -> ForwardedMessageResponse:
    try:
        return service.analyze_forwarded_message(request)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Forward analysis failed: {str(exc)}") from exc


@router.post("/osint/email-header", response_model=EmailHeaderResponse, summary="Analyze raw email headers for SPF/DKIM/DMARC spoofing")
async def analyze_email_header(request: EmailHeaderRequest, service: OsintService = Depends(get_osint_service)) -> EmailHeaderResponse:
    try:
        return service.analyze_email_header(request)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Email header analysis failed: {str(exc)}") from exc


@router.post("/osint/document-metadata", response_model=DocumentMetadataResponse, summary="Analyze offer letter metadata for Photoshop/Canva tampering")
async def analyze_document_metadata(request: DocumentMetadataRequest, service: OsintService = Depends(get_osint_service)) -> DocumentMetadataResponse:
    try:
        return service.analyze_document_metadata(request)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Document metadata analysis failed: {str(exc)}") from exc


@router.post("/osint/qr-trap", response_model=QrCodeTrapResponse, summary="Scan QR payload or UPI string for reverse payment collect traps")
async def analyze_qr_trap(request: QrCodeTrapRequest, service: OsintService = Depends(get_osint_service)) -> QrCodeTrapResponse:
    try:
        return service.analyze_qr_trap(request)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"QR trap analysis failed: {str(exc)}") from exc


@router.post("/osint/company-cin", response_model=CompanyCinResponse, summary="Verify Indian Corporate CIN and GSTIN government registration structure")
async def analyze_company_cin(request: CompanyCinRequest, service: OsintService = Depends(get_osint_service)) -> CompanyCinResponse:
    try:
        return service.analyze_company_cin(request)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Company CIN/GSTIN analysis failed: {str(exc)}") from exc


@router.post("/scam/evidence-dossier/pdf", summary="Generate official Cybercrime Evidence Dossier PDF")
async def generate_dossier_pdf(request: DossierPdfRequest, generator: EvidencePdfGenerator = Depends(get_evidence_pdf_generator)) -> Response:
    try:
        pdf_bytes = generator.generate_dossier_pdf(request)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="credihire-cybercrime-evidence-dossier.pdf"'},
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not generate PDF dossier: {str(exc)}") from exc


@router.post("/url/homoglyph", summary="Detect Unicode homoglyphs, lookalikes, and Punycode spoofing")
async def detect_homoglyph_spoofing(request: HomoglyphRequest) -> dict:
    try:
        return analyze_homoglyphs(request.domain_or_url)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Homoglyph analysis failed: {str(exc)}") from exc


@router.post("/privacy/redact-pii", summary="Zero-Knowledge PII Redaction for Indian Aadhaar, PAN, and Bank details")
async def redact_sensitive_pii(request: PiiRedactRequest) -> dict:
    try:
        return redact_pii(request.text)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"PII redaction failed: {str(exc)}") from exc
