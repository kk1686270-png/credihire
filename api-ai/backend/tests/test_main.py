from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.schemas.ai_schema import ScamAnalysis
from backend.services import ai_service

VALID_ANALYSIS = {
    "risk_level": "high",
    "scam_stage": "task_deposit",
    "summary": "The message requests payment to unlock tasks.",
    "evidence": [
        {
            "indicator": "task_deposit",
            "explanation": 'It says "unlock premium tasks".',
        }
    ],
    "verification_status": "not_checked",
    "recommendations": ["Do not pay money to unlock tasks."],
}


def test_health_endpoint_returns_service_status():
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "fake-job-scam-detector",
    }


def test_analyze_endpoint_returns_structured_analysis(monkeypatch):
    analysis = ScamAnalysis.model_validate(VALID_ANALYSIS)
    analyze_mock = Mock(return_value=analysis)
    monkeypatch.setattr(ai_service, "analyze_message", analyze_mock)
    client = TestClient(app)

    response = client.post(
        "/api/analyze",
        json={"message": "Deposit Rs. 500 to unlock premium tasks."},
    )

    assert response.status_code == 200
    assert response.json() == VALID_ANALYSIS
    analyze_mock.assert_called_once_with("Deposit Rs. 500 to unlock premium tasks.")


@pytest.mark.parametrize("message", ["", "   ", "\t\n"])
def test_analyze_endpoint_rejects_empty_or_whitespace_message(message):
    client = TestClient(app)

    response = client.post("/api/analyze", json={"message": message})

    assert response.status_code == 400
    assert response.json() == {
        "detail": (
            "Invalid request. Check that message is a non-empty string "
            "of at most 10000 characters."
        )
    }


def test_analyze_endpoint_rejects_message_over_maximum_length():
    client = TestClient(app)

    response = client.post(
        "/api/analyze",
        json={"message": "x" * 10_001},
    )

    assert response.status_code == 400


def test_analyze_endpoint_rejects_missing_message_without_calling_service(
    monkeypatch,
):
    analyze_mock = Mock()
    monkeypatch.setattr(ai_service, "analyze_message", analyze_mock)
    client = TestClient(app)

    response = client.post("/api/analyze", json={})

    assert response.status_code == 400
    assert response.json() == {
        "detail": (
            "Invalid request. Check that message is a non-empty string "
            "of at most 10000 characters."
        )
    }
    analyze_mock.assert_not_called()


@pytest.mark.parametrize("message", [123, None, ["a message"]])
def test_analyze_endpoint_rejects_non_string_message_without_calling_service(
    monkeypatch, message
):
    analyze_mock = Mock()
    monkeypatch.setattr(ai_service, "analyze_message", analyze_mock)
    client = TestClient(app)

    response = client.post("/api/analyze", json={"message": message})

    assert response.status_code == 400
    assert response.json() == {
        "detail": (
            "Invalid request. Check that message is a non-empty string "
            "of at most 10000 characters."
        )
    }
    analyze_mock.assert_not_called()


def test_analyze_endpoint_maps_ai_input_error_to_bad_request(monkeypatch):
    def reject_input(message: str) -> ScamAnalysis:
        raise ai_service.AIInputError("sensitive internal details")

    monkeypatch.setattr(ai_service, "analyze_message", reject_input)
    client = TestClient(app)

    response = client.post("/api/analyze", json={"message": "valid message"})

    assert response.status_code == 400
    assert response.json() == {"detail": "The submitted message is invalid."}
    assert "sensitive internal details" not in response.text


def test_analyze_endpoint_maps_rate_limit_to_429(monkeypatch):
    def rate_limited(message: str) -> ScamAnalysis:
        raise ai_service.AIRateLimitError("provider credentials and details")

    monkeypatch.setattr(ai_service, "analyze_message", rate_limited)
    client = TestClient(app)

    response = client.post("/api/analyze", json={"message": "valid message"})

    assert response.status_code == 429
    assert response.json() == {
        "detail": "Analysis is temporarily rate-limited. Try again later."
    }
    assert "provider credentials" not in response.text


def test_analyze_endpoint_maps_ai_service_failure_safely(monkeypatch):
    def service_failure(message: str) -> ScamAnalysis:
        raise ai_service.AIServiceError(
            "GROQ_API_KEY=secret-value; internal stack trace"
        )

    monkeypatch.setattr(ai_service, "analyze_message", service_failure)
    client = TestClient(app)

    response = client.post("/api/analyze", json={"message": "valid message"})

    assert response.status_code == 503
    assert response.json() == {
        "detail": "The analysis service is temporarily unavailable."
    }
    assert "secret-value" not in response.text
    assert "stack trace" not in response.text


def test_analyze_endpoint_maps_invalid_upstream_response_safely(monkeypatch):
    def invalid_response(message: str) -> ScamAnalysis:
        raise ai_service.AIResponseError("raw provider response content")

    monkeypatch.setattr(ai_service, "analyze_message", invalid_response)
    client = TestClient(app)

    response = client.post("/api/analyze", json={"message": "valid message"})

    assert response.status_code == 502
    assert response.json() == {
        "detail": "The analysis provider returned an invalid response."
    }
    assert "raw provider response" not in response.text
