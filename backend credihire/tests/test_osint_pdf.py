import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas.osint import (
    DomainIntelRequest,
    DossierPdfRequest,
    ForwardedMessageRequest,
    UpiIntelRequest,
)
from app.services.evidence_pdf import EvidencePdfGenerator
from app.services.osint import OsintService


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


def test_upi_analysis_detects_personal_retail_vpa():
    service = OsintService()
    result = service.analyze_upi(UpiIntelRequest(
        upi_id_or_uri="tcs.recruitment@okhdfcbank",
        context_text="Pay ₹2,000 security deposit for employee ID card",
    ))
    assert result.is_personal_psp is True
    assert result.psp_bank == "Google Pay (HDFC Bank)"
    assert result.risk_score >= 80
    assert result.risk_level in ["high", "critical"]
    assert any("PERSONAL_RETAIL_PSP" in f["code"] for f in result.flags)
    assert any("CORPORATE_KEYWORD_IN_PERSONAL_VPA" in f["code"] for f in result.flags)


def test_upi_analysis_parses_upi_intent_uri():
    service = OsintService()
    result = service.analyze_upi(UpiIntelRequest(
        upi_id_or_uri="upi://pay?pa=indigo.careers@ybl&pn=Indigo%20HR&am=1500&cu=INR",
    ))
    assert result.upi_id == "indigo.careers@ybl"
    assert result.payee_name == "Indigo HR"
    assert result.demanded_amount == "1500"
    assert result.risk_score >= 70


def test_forwarded_message_detection():
    service = OsintService()
    raw = """Forwarded
[10:15 AM, 11/20/2026] +234 803 123 4567:
Dear Candidate, Work 15 mins daily rating YouTube channels. Earn ₹2500 per day!
Deposit ₹1,000 to activate VIP task pool.
Contact manager on Telegram: https://t.me/vip_task_manager"""

    result = service.analyze_forwarded_message(ForwardedMessageRequest(raw_message=raw))
    assert result.is_forwarded is True
    assert result.detected_platform == "Telegram"
    assert any("+234" in p for p in result.suspicious_phone_numbers)
    assert any("t.me" in l for l in result.telegram_links)
    assert result.demanded_fees == "₹1,000"
    assert result.risk_score >= 70
    assert result.risk_level in ["high", "critical"]


@pytest.mark.asyncio
async def test_domain_analysis_flags_brand_impersonation():
    service = OsintService()
    result = await service.analyze_domain(DomainIntelRequest(domain_or_url="tcs-careers-recruitment-portal.com"))
    assert result.impersonation_target == "TCS"
    assert result.risk_score >= 50
    assert any(i["code"] == "BRAND_IMPERSONATION_DOMAIN" for i in result.indicators)


@pytest.mark.asyncio
async def test_domain_analysis_flags_free_mail_provider():
    service = OsintService()
    result = await service.analyze_domain(DomainIntelRequest(domain_or_url="gmail.com"))
    assert result.is_free_mail_provider is True
    assert result.risk_score >= 45
    assert any(i["code"] == "FREE_MAIL_PROVIDER" for i in result.indicators)


def test_evidence_pdf_generation_produces_valid_pdf():
    generator = EvidencePdfGenerator()
    data = DossierPdfRequest(
        scan_title="TCS Advance Fee Security Deposit Scam",
        risk_score=95,
        risk_level="critical",
        job_text="Congratulations! You are selected for Remote Data Entry. Pay ₹2000 deposit to tcs-hr@okhdfcbank.",
        demanded_amount="₹2,000",
        payment_handle="tcs-hr@okhdfcbank",
        scammer_contact="+91 98765 43210",
        indicators=["Advance fee demanded", "Brand impersonation"],
    )
    pdf_bytes = generator.generate_dossier_pdf(data)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF")


def test_osint_api_endpoints_work(client):
    # 1. UPI Endpoint
    upi_resp = client.post("/api/v1/osint/upi", json={
        "upi_id_or_uri": "amazon.task@paytm",
        "context_text": "Pay 3500 fee",
    })
    assert upi_resp.status_code == 200
    assert upi_resp.json()["is_personal_psp"] is True

    # 2. Forwarded message endpoint
    fwd_resp = client.post("/api/v1/osint/forwarded-message", json={
        "raw_message": "Forwarded: Daily earn 5000 rs, deposit 2000 rs to https://t.me/work_hr",
    })
    assert fwd_resp.status_code == 200
    assert fwd_resp.json()["is_forwarded"] is True

    # 3. PDF Endpoint
    pdf_resp = client.post("/api/v1/scam/evidence-dossier/pdf", json={
        "job_text": "Deposit ₹2,000 to start data entry job at TCS.",
        "risk_score": 90,
        "risk_level": "critical",
        "demanded_amount": "₹2,000",
        "payment_handle": "hr@ybl",
    })
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content.startswith(b"%PDF")
