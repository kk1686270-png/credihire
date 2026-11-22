import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas.osint import (
    CompanyCinRequest,
    DocumentMetadataRequest,
    DomainIntelRequest,
    DossierPdfRequest,
    EmailHeaderRequest,
    ForwardedMessageRequest,
    QrCodeTrapRequest,
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


def test_email_header_spoofing_detection():
    service = OsintService()
    raw_header = """From: "TCS Global HR" <careers@tcs.com>
Return-Path: <scammer123@free-mailer-host.ru>
Received: from mail.free-mailer-host.ru [185.220.101.5]
Received-SPF: fail (google.com: domain of tcs.com does not designate 185.220.101.5 as permitted sender)
Authentication-Results: mx.google.com;
       dkim=fail header.i=@tcs.com;
       spf=fail (google.com: domain of tcs.com does not designate 185.220.101.5) smtp.mailfrom=tcs.com;
       dmarc=fail (p=REJECT sp=REJECT dis=REJECT) header.from=tcs.com"""

    result = service.analyze_email_header(EmailHeaderRequest(raw_header=raw_header))
    assert result.is_spoofed is True
    assert result.spf_status == "fail"
    assert result.dkim_status == "fail"
    assert result.dmarc_status == "fail"
    assert result.risk_score >= 80
    assert result.risk_level in ["high", "critical"]
    assert any("SPF_VALIDATION_FAILED" in f["code"] for f in result.flags)


def test_document_metadata_canva_photoshop_detection():
    service = OsintService()
    result = service.analyze_document_metadata(DocumentMetadataRequest(
        file_name="Tata_Motors_Appointment_Letter.pdf",
        text_content="Creator: Canva Web Design. Selected candidate must pay ₹5000 registration fee for laptop dispatch.",
    ))
    assert result.is_tampered_or_canva is True
    assert result.software_tool == "Canva Design Platform"
    assert result.risk_score >= 85
    assert result.risk_level in ["high", "critical"]
    assert any("CANVA_DESIGN_TEMPLATE" in f["code"] for f in result.forensic_findings)


def test_qr_trap_reverse_payment_detection():
    service = OsintService()
    result = service.analyze_qr_trap(QrCodeTrapRequest(
        qr_payload_or_uri="upi://pay?pa=hr.recruit78@paytm&pn=Amazon%20HR&am=2500&cu=INR",
        context_text="Scan this QR code to receive your registration bonus of 2500 rs",
    ))
    assert result.is_upi_scheme is True
    assert result.is_debit_trap is True
    assert result.vpa_payee == "hr.recruit78@paytm"
    assert result.demanded_amount == "₹2500"
    assert result.risk_score >= 85
    assert any("REVERSE_PAYMENT_QR_TRAP" in d["code"] for d in result.deception_indicators)


def test_company_cin_and_gstin_validation():
    service = OsintService()
    # 1. Valid Infosys-like CIN (IT Services, Karnataka, 1981, Public Ltd)
    cin_res = service.analyze_company_cin(CompanyCinRequest(cin_or_gstin="L72200KA1981PLC013115"))
    assert cin_res.is_valid_format is True
    assert cin_res.id_type == "CIN"
    assert cin_res.state_code == "KA"
    assert cin_res.incorporation_year == 1981
    assert cin_res.risk_score <= 25

    # 2. Invalid fake registration number
    fake_res = service.analyze_company_cin(CompanyCinRequest(cin_or_gstin="FAKE-REG-123456"))
    assert fake_res.is_valid_format is False
    assert fake_res.id_type == "INVALID"
    assert fake_res.risk_score >= 70

    # 3. Valid GSTIN (Delhi, Company)
    gst_res = service.analyze_company_cin(CompanyCinRequest(cin_or_gstin="07AAAAA0000A1Z5"))
    assert gst_res.is_valid_format is True
    assert gst_res.id_type == "GSTIN"
    assert gst_res.state_code == "07"


def test_advanced_osint_api_endpoints_work(client):
    # 1. Email Header
    email_resp = client.post("/api/v1/osint/email-header", json={
        "raw_header": "From: test@tcs.com\nReceived-SPF: fail\ndkim=fail\ndmarc=fail"
    })
    assert email_resp.status_code == 200
    assert email_resp.json()["is_spoofed"] is True

    # 2. Document Metadata
    doc_resp = client.post("/api/v1/osint/document-metadata", json={
        "file_name": "TCS_Offer.pdf",
        "text_content": "Created with Canva graphic tool. Pay fee."
    })
    assert doc_resp.status_code == 200
    assert doc_resp.json()["is_tampered_or_canva"] is True

    # 3. QR Trap
    qr_resp = client.post("/api/v1/osint/qr-trap", json={
        "qr_payload_or_uri": "upi://pay?pa=recruiter@okhdfcbank&pn=HR&am=1000",
        "context_text": "Scan to receive refund"
    })
    assert qr_resp.status_code == 200
    assert qr_resp.json()["is_debit_trap"] is True

    # 4. Company CIN
    cin_resp = client.post("/api/v1/osint/company-cin", json={
        "cin_or_gstin": "L72200KA1981PLC013115"
    })
    assert cin_resp.status_code == 200
    assert cin_resp.json()["is_valid_format"] is True
