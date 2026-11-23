from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.homoglyph import analyze_homoglyphs
from app.services.pii_redactor import redact_pii
from app.services.url_credibility import UrlCredibilityService


@pytest.fixture
def client():
    return TestClient(create_app())


def test_analyze_homoglyphs_clean_domain():
    res = analyze_homoglyphs("tcs.com")
    assert res["is_homograph"] is False
    assert res["risk_level"] == "safe"
    assert res["spoofed_target"] is None


def test_analyze_homoglyphs_punycode_cyrillic():
    # xn--ts-fmc.com decodes to tос.com (with Cyrillic o)
    res = analyze_homoglyphs("xn--ts-fmc.com")
    assert res["is_homograph"] is True
    assert res["is_punycode"] is True
    assert res["risk_score"] >= 80


def test_analyze_homoglyphs_cyrillic_spoofing():
    # 'с' is Cyrillic U+0441
    domain = "t\u0441s.com"
    res = analyze_homoglyphs(domain)
    assert res["is_homograph"] is True
    assert res["spoofed_target"] == "tcs.com"
    assert res["risk_level"] == "critical"
    assert res["risk_score"] == 100


def test_redact_pii_masks_aadhaar_and_pan():
    sample = "Candidate John Doe, Aadhaar 2345 6789 0123, PAN ABCDE1234F"
    res = redact_pii(sample)
    assert res["has_pii"] is True
    assert res["redactions_count"] == 2
    assert "2345 6789 0123" not in res["redacted_text"]
    assert "ABCDE1234F" not in res["redacted_text"]
    assert "[AADHAAR_MASKED_XXXX_0123]" in res["redacted_text"]
    assert "[PAN_MASKED_ABXX4F]" in res["redacted_text"]


def test_redact_pii_masks_bank_account():
    sample = "Please send offer deposit to A/C 987654321098"
    res = redact_pii(sample)
    assert res["has_pii"] is True
    assert "987654321098" not in res["redacted_text"]
    assert "[BANK_AC_MASKED_XXXX_1098]" in res["redacted_text"]


def test_api_homoglyph_endpoint(client):
    response = client.post("/api/v1/url/homoglyph", json={"domain_or_url": "xn--ts-fmc.com"})
    assert response.status_code == 200
    data = response.json()
    assert data["is_homograph"] is True


def test_api_pii_redact_endpoint(client):
    response = client.post("/api/v1/privacy/redact-pii", json={"text": "My PAN is ABCDE1234F"})
    assert response.status_code == 200
    data = response.json()
    assert data["has_pii"] is True
    assert "[PAN_MASKED_ABXX4F]" in data["redacted_text"]


def test_url_credibility_service_detects_homoglyphs():
    service = UrlCredibilityService()
    # Mock resolution to avoid external DNS
    service.ip_resolver = lambda host: "93.184.216.34"
    indicators = service.analyze_heuristics("https", "xn--ts-fmc.com")
    codes = [ind.code for ind in indicators]
    assert any(c.startswith("homograph_") or c == "punycode_domain" for c in codes)
