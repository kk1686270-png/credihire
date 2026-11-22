from datetime import datetime, timezone
import re
import socket
from urllib.parse import parse_qs, urlparse

import httpx

from app.schemas.osint import (
    DomainIntelRequest,
    DomainIntelResponse,
    ForwardedMessageRequest,
    ForwardedMessageResponse,
    UpiIntelRequest,
    UpiIntelResponse,
)

AUTHENTIC_DOMAINS = {
    "tcs": ["tcs.com", "tataconsultancy.com"],
    "infosys": ["infosys.com"],
    "wipro": ["wipro.com"],
    "indigo": ["goindigo.in", "airindigo.in"],
    "amazon": ["amazon.jobs", "amazon.in", "amazon.com"],
    "flipkart": ["flipkartcareers.com", "flipkart.com"],
    "reliance": ["ril.com", "jio.com"],
    "tata": ["tata.com", "tatamotors.com", "tatasteel.com"],
    "hcl": ["hcltech.com", "hcl.com"],
    "cognizant": ["cognizant.com"],
    "techmahindra": ["techmahindra.com"],
}

FREE_MAIL_PROVIDERS = {
    "gmail.com",
    "yahoo.com",
    "yahoo.in",
    "outlook.com",
    "hotmail.com",
    "rediffmail.com",
    "protonmail.com",
    "proton.me",
    "zoho.com",
    "icloud.com",
}

PERSONAL_UPI_PSPS = {
    "okhdfcbank": "Google Pay (HDFC Bank)",
    "okaxis": "Google Pay (Axis Bank)",
    "oksbi": "Google Pay (SBI)",
    "okicici": "Google Pay (ICICI Bank)",
    "ybl": "PhonePe (Yes Bank)",
    "ibl": "PhonePe (ICICI Bank)",
    "axl": "PhonePe (Axis Bank)",
    "paytm": "Paytm Payments Bank",
    "pthdfc": "Paytm (HDFC Bank)",
    "ptaxis": "Paytm (Axis Bank)",
    "ptsbi": "Paytm (SBI)",
    "apl": "Amazon Pay",
    "upi": "NPCI / BHIM Generic",
}


class OsintService:
    def __init__(self, http_client: httpx.AsyncClient | None = None) -> None:
        self.http_client = http_client

    async def analyze_domain(self, request: DomainIntelRequest) -> DomainIntelResponse:
        raw_input = request.domain_or_url.strip()
        parsed = urlparse(raw_input if "://" in raw_input else f"http://{raw_input}")
        hostname = (parsed.hostname or raw_input).lower().strip()
        if hostname.startswith("www."):
            hostname = hostname[4:]

        clean_url = f"https://{hostname}"
        indicators: list[dict[str, str]] = []
        recommendations: list[str] = []
        risk_score = 0
        impersonation_target = None

        is_free_mail = hostname in FREE_MAIL_PROVIDERS
        if is_free_mail:
            risk_score += 45
            indicators.append({
                "code": "FREE_MAIL_PROVIDER",
                "severity": "high",
                "message": f"'{hostname}' is a public free consumer email domain, not an official corporate business domain.",
            })
            recommendations.append("Never treat emails or websites hosted on personal consumer mail domains as authorized enterprise recruitment.")

        for brand, valid_domains in AUTHENTIC_DOMAINS.items():
            if brand in hostname:
                matched_valid = any(hostname == vd or hostname.endswith(f".{vd}") for vd in valid_domains)
                if not matched_valid:
                    impersonation_target = brand.upper()
                    risk_score += 50
                    indicators.append({
                        "code": "BRAND_IMPERSONATION_DOMAIN",
                        "severity": "critical",
                        "message": f"Domain '{hostname}' contains corporate brand '{brand.upper()}' but is NOT in legitimate domain whitelist: {', '.join(valid_domains)}.",
                    })
                    recommendations.append(f"Verify openings directly on the official {brand.upper()} career portal ({valid_domains[0]}).")
                    break

        dns_resolvable = False
        try:
            addr_info = socket.getaddrinfo(hostname, 80)
            dns_resolvable = bool(addr_info)
        except Exception:
            dns_resolvable = False

        if not dns_resolvable and not is_free_mail:
            risk_score += 35
            indicators.append({
                "code": "DNS_RESOLUTION_FAILURE",
                "severity": "high",
                "message": f"Domain '{hostname}' could not be resolved by public DNS. It may be defunct, non-existent, or recently taken down.",
            })
            recommendations.append("Do not submit credentials or applications to unresolvable domains.")

        domain_age_days = None
        registration_date = None
        expiration_date = None
        registrar = None

        if dns_resolvable and not is_free_mail:
            try:
                owns_client = self.http_client is None
                client = self.http_client or httpx.AsyncClient(timeout=httpx.Timeout(4.0), follow_redirects=True)
                try:
                    resp = await client.get(f"https://rdap.org/domain/{hostname}")
                    if resp.status_code == 200:
                        rdap_data = resp.json()
                        events = {e.get("eventAction"): e.get("eventDate") for e in rdap_data.get("events", []) if isinstance(e, dict)}
                        registration_date = events.get("registration")
                        expiration_date = events.get("expiration")
                        for entity in rdap_data.get("entities", []):
                            roles = entity.get("roles", [])
                            if "registrar" in roles:
                                vcard = entity.get("vcardArray", [])
                                if len(vcard) > 1 and isinstance(vcard[1], list):
                                    for item in vcard[1]:
                                        if isinstance(item, list) and len(item) > 3 and item[0] == "fn":
                                            registrar = item[3]
                                            break
                        if registration_date:
                            dt = datetime.fromisoformat(registration_date.replace("Z", "+00:00"))
                            domain_age_days = max(0, (datetime.now(timezone.utc) - dt).days)
                finally:
                    if owns_client:
                        await client.aclose()
            except Exception:
                pass

        if domain_age_days is not None:
            if domain_age_days < 30:
                risk_score += 40
                indicators.append({
                    "code": "DISPOSABLE_FRESH_DOMAIN",
                    "severity": "high",
                    "message": f"Domain was registered only {domain_age_days} day(s) ago ({registration_date[:10] if registration_date else ''}). Fresh domains are overwhelmingly used in temporary recruitment scams.",
                })
                recommendations.append("High caution: newly registered recruitment domains have an elevated probability of disposable fraud.")
            elif domain_age_days < 90:
                risk_score += 20
                indicators.append({
                    "code": "RECENT_DOMAIN",
                    "severity": "medium",
                    "message": f"Domain was registered {domain_age_days} days ago. Verify corporate history independently.",
                })
            elif domain_age_days > 730 and not impersonation_target:
                risk_score = max(0, risk_score - 25)

        risk_score = max(0, min(100, risk_score))
        if risk_score >= 70:
            risk_level = "critical" if risk_score >= 85 else "high"
        elif risk_score >= 40:
            risk_level = "medium"
        elif risk_score >= 20:
            risk_level = "low"
        else:
            risk_level = "safe"

        if not recommendations:
            recommendations = [
                "Verify recruiter identities through official corporate LinkedIn directories.",
                "Ensure job offers originate from verified enterprise domains with matching MX records.",
            ]

        summary = f"Domain '{hostname}' evaluated with risk score {risk_score}/100 ({risk_level.upper()}). "
        if impersonation_target:
            summary += f"CRITICAL: Unofficial domain impersonating {impersonation_target}. "
        if domain_age_days is not None:
            summary += f"Domain age: {domain_age_days} days. "

        return DomainIntelResponse(
            domain=hostname,
            clean_url=clean_url,
            domain_age_days=domain_age_days,
            registration_date=registration_date,
            expiration_date=expiration_date,
            registrar=registrar,
            risk_level=risk_level,
            risk_score=risk_score,
            dns_resolvable=dns_resolvable,
            is_free_mail_provider=is_free_mail,
            impersonation_target=impersonation_target,
            indicators=indicators,
            recommendations=recommendations,
            summary=summary.strip(),
        )

    def analyze_upi(self, request: UpiIntelRequest) -> UpiIntelResponse:
        raw = request.upi_id_or_uri.strip()
        payee_address = raw
        payee_name = None
        demanded_amount = None

        if raw.startswith("upi://pay"):
            parsed = urlparse(raw)
            params = parse_qs(parsed.query)
            payee_address = params.get("pa", [raw])[0]
            payee_name = params.get("pn", [None])[0]
            demanded_amount = params.get("am", [None])[0]
        else:
            amount_match = re.search(r"[₹Rs\.]*\s*([0-9]{2,6})", request.context_text or "")
            if amount_match:
                demanded_amount = f"₹{amount_match.group(1)}"

        handle_parts = payee_address.split("@")
        username = handle_parts[0] if len(handle_parts) > 0 else ""
        handle = handle_parts[1].lower() if len(handle_parts) > 1 else ""

        psp_bank = PERSONAL_UPI_PSPS.get(handle, f"Bank Handle (@{handle})" if handle else "Unknown UPI Provider")
        is_personal_psp = handle in PERSONAL_UPI_PSPS

        flags: list[dict[str, str]] = []
        recommendations: list[str] = []
        risk_score = 0

        if is_personal_psp:
            risk_score += 45
            flags.append({
                "code": "PERSONAL_RETAIL_PSP",
                "severity": "high",
                "message": f"VPA uses personal retail UPI handle '{handle}' ({psp_bank}). Corporate recruitment teams use registered corporate merchant accounts, not retail handles.",
            })
            recommendations.append("Never transfer security deposits or document fees to retail consumer UPI handles (@okhdfcbank, @ybl, @paytm, etc.).")

        suspicious_keywords = ["tcs", "hr", "recruitment", "career", "job", "deposit", "fee", "indigo", "wipro", "amazon", "task"]
        matched_keywords = [kw for kw in suspicious_keywords if kw in username.lower()]
        if matched_keywords:
            risk_score += 40
            flags.append({
                "code": "CORPORATE_KEYWORD_IN_PERSONAL_VPA",
                "severity": "critical",
                "message": f"VPA username '{username}' embeds corporate or recruitment terms ({', '.join(matched_keywords)}) inside a personal consumer UPI handle.",
            })
            recommendations.append(f"Report VPA '{payee_address}' to the National Cyber Crime Portal (1930) and your payment app.")

        if demanded_amount:
            risk_score += 20
            flags.append({
                "code": "ADVANCE_PAYMENT_DEMANDED",
                "severity": "high",
                "message": f"Demanded fee of {demanded_amount} detected in connection with employment or tasks. Legitimate employers in India are strictly prohibited from demanding money for jobs.",
            })

        risk_score = max(0, min(100, risk_score))
        if risk_score >= 70:
            risk_level = "critical" if risk_score >= 85 else "high"
        elif risk_score >= 40:
            risk_level = "medium"
        elif risk_score >= 20:
            risk_level = "low"
        else:
            risk_level = "safe"

        summary = f"UPI handle '{payee_address}' analyzed ({psp_bank}). Risk Score: {risk_score}/100 ({risk_level.upper()}). "
        if is_personal_psp and matched_keywords:
            summary += "WARNING: High-probability impersonation scam VPA demanding recruitment fees."

        return UpiIntelResponse(
            upi_id=payee_address,
            payee_name=payee_name,
            psp_bank=psp_bank,
            is_personal_psp=is_personal_psp,
            demanded_amount=demanded_amount,
            risk_level=risk_level,
            risk_score=risk_score,
            flags=flags,
            recommendations=recommendations or ["Verify company bank details on official corporate websites only."],
            summary=summary.strip(),
        )

    def analyze_forwarded_message(self, request: ForwardedMessageRequest) -> ForwardedMessageResponse:
        raw = request.raw_message
        clean_lines = []
        is_forwarded = False
        detected_platform = "Unknown"

        forward_patterns = [
            r"\[?Forwarded(?:\s+many\s+times)?\]?",
            r"\[?\d{1,2}:\d{2}\s*(?:AM|PM)?,?\s*\d{1,2}/\d{1,2}/\d{2,4}\]?",
            r"^~.*?:",
        ]

        for line in raw.splitlines():
            trimmed = line.strip()
            if any(re.search(pat, trimmed, re.IGNORECASE) for pat in forward_patterns):
                is_forwarded = True
                continue
            clean_lines.append(line)

        clean_message = "\n".join(clean_lines).strip()
        if not clean_message:
            clean_message = raw.strip()

        if re.search(r"WhatsApp|wa\.me|\+91\s*\d{5}", raw, re.IGNORECASE):
            detected_platform = "WhatsApp"
        elif re.search(r"Telegram|t\.me|@[\w_]+bot", raw, re.IGNORECASE):
            detected_platform = "Telegram"
        elif re.search(r"SMS|OTP|Dear\s+Candidate", raw, re.IGNORECASE):
            detected_platform = "SMS"

        phone_numbers = re.findall(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}", raw)
        clean_phones = list(dict.fromkeys(p.strip() for p in phone_numbers if len(re.sub(r"\D", "", p)) >= 10))

        telegram_links = re.findall(r"(?:https?://)?(?:www\.)?t\.me/[\w_+]+|@[\w_]{4,}", raw, re.IGNORECASE)
        external_links = re.findall(r"https?://[^\s<>\"']+", raw, re.IGNORECASE)

        promised_earnings = None
        demanded_fees = None

        earnings_match = re.search(r"(?:earn|salary|daily|per\s+day|income|profit)[:\s]*[₹Rs\.]*\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,6})", raw, re.IGNORECASE)
        if earnings_match:
            promised_earnings = f"₹{earnings_match.group(1)}"

        fees_match = re.search(r"(?:deposit|fee|charge|pay|recharge|registration)[:\s]*[₹Rs\.]*\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,6})", raw, re.IGNORECASE)
        if fees_match:
            demanded_fees = f"₹{fees_match.group(1)}"

        indicators: list[dict[str, str]] = []
        risk_score = 0

        if is_forwarded:
            risk_score += 25
            indicators.append({
                "code": "VIRAL_FORWARDED_MESSAGE",
                "severity": "medium",
                "message": "Message contains forwarded headers. Mass-forwarded job offers on social messaging apps are a prominent vector for cyber scams.",
            })

        intl_suspicious_phones = [p for p in clean_phones if p.startswith(("+62", "+234", "+84", "+92", "+254", "+1"))]
        if intl_suspicious_phones:
            risk_score += 40
            indicators.append({
                "code": "INTERNATIONAL_NUMBER_HR_DISCREPANCY",
                "severity": "high",
                "message": f"Job offer originates from international numbers ({', '.join(intl_suspicious_phones)}) while claiming to offer Indian employment.",
            })

        if telegram_links:
            risk_score += 30
            indicators.append({
                "code": "REDIRECT_TO_TELEGRAM",
                "severity": "high",
                "message": "Recruiter redirects conversation to Telegram task channels or private bot handles.",
            })

        if promised_earnings and ("daily" in raw.lower() or "rating" in raw.lower() or "like" in raw.lower()):
            risk_score += 35
            indicators.append({
                "code": "UNREALISTIC_TASK_EARNINGS",
                "severity": "high",
                "message": f"Promises unrealistic easy daily payouts ({promised_earnings}) for rating videos, liking merchants, or reviewing products.",
            })

        if demanded_fees:
            risk_score += 40
            indicators.append({
                "code": "ADVANCE_TASK_DEPOSIT",
                "severity": "critical",
                "message": f"Message demands an upfront deposit or activation fee ({demanded_fees}) to release tasks or earnings.",
            })

        risk_score = max(0, min(100, risk_score))
        if risk_score >= 70:
            risk_level = "critical" if risk_score >= 85 else "high"
        elif risk_score >= 40:
            risk_level = "medium"
        elif risk_score >= 20:
            risk_level = "low"
        else:
            risk_level = "safe"

        summary = f"{detected_platform} forwarded message analyzed with risk score {risk_score}/100 ({risk_level.upper()}). "
        if intl_suspicious_phones:
            summary += f"Detected foreign contact numbers. "
        if demanded_fees:
            summary += f"Requires advance fee: {demanded_fees}. "

        return ForwardedMessageResponse(
            is_forwarded=is_forwarded,
            detected_platform=detected_platform,
            suspicious_phone_numbers=clean_phones,
            telegram_links=telegram_links,
            external_links=external_links,
            promised_earnings=promised_earnings,
            demanded_fees=demanded_fees,
            risk_score=risk_score,
            risk_level=risk_level,
            indicators=indicators,
            clean_message=clean_message,
            summary=summary.strip(),
        )
