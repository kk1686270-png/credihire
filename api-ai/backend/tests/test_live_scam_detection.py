"""Opt-in live evaluation of the configured Groq model."""

import os
import re
import sys

import pytest

from backend.services import ai_service
from backend.schemas.ai_schema import ScamAnalysis
from backend.tests.scam_test_cases import SCAM_TEST_CASES


LIVE_TESTS_ENABLED = os.getenv("RUN_LIVE_GROQ_TESTS") == "1"
pytestmark = pytest.mark.skipif(
    not LIVE_TESTS_ENABLED,
    reason="Set RUN_LIVE_GROQ_TESTS=1 to make live Groq API calls.",
)

def _safe_output(value: str) -> str:
    """Redact the configured credential if it occurs in output or an error."""
    api_key = ai_service.API_KEY
    if api_key:
        return value.replace(api_key, "[REDACTED]")
    return value


def _print_safe(value: str = "") -> None:
    """Print text even when the Windows console cannot encode all characters."""
    encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
    printable = value.encode(encoding, errors="replace").decode(encoding)
    print(printable)


def _evidence_is_grounded(
    analysis: ScamAnalysis, message: str, evidence_terms: tuple[str, ...]
) -> bool:
    """Require evidence text to include a quote that exists in the message."""
    message_lower = message.casefold()
    evidence_text = " ".join(
        item.explanation for item in analysis.evidence
    )
    for quote in re.findall(r'"([^"\r\n]+)"', evidence_text):
        if quote.casefold() not in message_lower:
            continue
        quote_tokens = set(re.findall(r"[a-z0-9]+", quote.casefold()))
        for evidence_term in evidence_terms:
            term_tokens = set(
                re.findall(r"[a-z0-9]+", evidence_term.casefold())
            )
            anchors = {
                token for token in term_tokens
                if token.isdigit() or len(token) > 3
            }
            if anchors.intersection(quote_tokens):
                return True
    return False


def test_live_scam_detection_scenarios():
    total = len(SCAM_TEST_CASES)
    passed = 0
    failed = 0
    api_errors = 0
    incorrect_stages = 0
    incorrect_risks = 0
    evidence_failures = 0
    recommendation_failures = 0
    unsupported_verification_claims = 0
    failed_scenarios = []

    for scenario in SCAM_TEST_CASES:
        expected_stages = scenario["expected_stages"]
        expected_risks = scenario["expected_risk_levels"]
        _print_safe(f"\n{scenario['name']} ({scenario['category']})")
        _print_safe(f"Expected stage: {' / '.join(sorted(expected_stages))}")
        _print_safe(f"Expected risk: {' / '.join(sorted(expected_risks))}")

        try:
            analysis = ai_service.analyze_message(scenario["message"])
        except Exception as error:
            api_errors += 1
            failed += 1
            safe_message = _safe_output(str(error))
            failed_scenarios.append(
                f"{scenario['name']}: API error ({type(error).__name__})"
            )
            _print_safe(
                f"API error: {type(error).__name__}: {safe_message}"
            )
            _print_safe("Actual stage: unavailable")
            _print_safe("Actual risk: unavailable")
            _print_safe("FAIL")
            continue

        safe_response = _safe_output(analysis.model_dump_json(indent=2))
        _print_safe("AI response:")
        _print_safe(safe_response)

        actual_stage = analysis.scam_stage.value
        actual_risk = analysis.risk_level.value
        _print_safe(f"Actual stage: {actual_stage}")
        _print_safe(f"Actual risk: {actual_risk}")

        stage_ok = actual_stage in expected_stages
        risk_ok = actual_risk in expected_risks
        evidence_ok = _evidence_is_grounded(
            analysis,
            scenario["message"],
            scenario["evidence_terms"],
        )
        response_lower = safe_response.casefold()
        recommendation_ok = any(
            term.casefold() in response_lower
            for term in scenario["recommendation_terms"]
        )
        verification_claim_found = (
            analysis.verification_status.value == "verified"
        )

        if not stage_ok:
            incorrect_stages += 1
        if not risk_ok:
            incorrect_risks += 1
        if not evidence_ok:
            evidence_failures += 1
        if not recommendation_ok:
            recommendation_failures += 1
        if verification_claim_found:
            unsupported_verification_claims += 1

        scenario_passed = (
            stage_ok
            and risk_ok
            and evidence_ok
            and recommendation_ok
            and not verification_claim_found
        )
        if scenario_passed:
            passed += 1
            print("PASS")
        else:
            failed += 1
            failure_reasons = []
            if not stage_ok:
                failure_reasons.append("incorrect stage")
            if not risk_ok:
                failure_reasons.append("incorrect risk")
            if not evidence_ok:
                failure_reasons.append("evidence was not grounded by a source quote")
            if not recommendation_ok:
                failure_reasons.append("recommendation check failed")
            if verification_claim_found:
                failure_reasons.append("unsupported verification claim")
            failed_scenarios.append(
                f"{scenario['name']}: {', '.join(failure_reasons)}"
            )
            _print_safe("FAIL")
            for reason in failure_reasons:
                _print_safe(f"  {reason}")

    _print_safe("\n========== LIVE SCENARIO SUMMARY ==========")
    _print_safe(f"Total scenarios: {total}")
    _print_safe(f"Passed scenarios: {passed}")
    _print_safe(f"Failed scenarios: {failed}")
    _print_safe(f"API errors: {api_errors}")
    _print_safe(f"Incorrect scam-stage classifications: {incorrect_stages}")
    _print_safe(f"Incorrect risk-level classifications: {incorrect_risks}")
    _print_safe(f"Evidence-grounding failures: {evidence_failures}")
    _print_safe(f"Recommendation failures: {recommendation_failures}")
    _print_safe(
        f"Unsupported verification claims: {unsupported_verification_claims}"
    )
    if failed_scenarios:
        _print_safe("Failed scenario details:")
        for failure in failed_scenarios:
            _print_safe(f"- {failure}")
    _print_safe("===========================================")

    assert failed == 0, f"{failed} live scenario(s) failed; see report above."
