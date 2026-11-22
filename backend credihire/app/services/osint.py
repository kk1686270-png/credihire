from datetime import datetime, timezone
import re
import socket
from urllib.parse import parse_qs, urlparse

import httpx

from app.schemas.osint import (
    CompanyCinRequest,
    CompanyCinResponse,
    DocumentMetadataRequest,
    DocumentMetadataResponse,
    DomainIntelRequest,
    DomainIntelResponse,
    EmailHeaderRequest,
    EmailHeaderResponse,
    ForwardedMessageRequest,
    ForwardedMessageResponse,
    QrCodeTrapRequest,
    QrCodeTrapResponse,
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

INDIAN_STATES = {
    "AP": "Andhra Pradesh", "AR": "Arunachal Pradesh", "AS": "Assam", "BR": "Bihar",
    "CG": "Chhattisgarh", "DL": "Delhi", "GA": "Goa", "GJ": "Gujarat",
    "HR": "Haryana", "HP": "Himachal Pradesh", "JH": "Jharkhand", "KA": "Karnataka",
    "KL": "Kerala", "MP": "Madhya Pradesh", "MH": "Maharashtra", "MN": "Manipur",
    "ML": "Meghalaya", "MZ": "Mizoram", "NL": "Nagaland", "OD": "Odisha",
    "PB": "Punjab", "RJ": "Rajasthan", "SK": "Sikkim", "TN": "Tamil Nadu",
    "TS": "Telangana", "TR": "Tripura", "UP": "Uttar Pradesh", "UK": "Uttarakhand",
    "WB": "West Bengal", "CH": "Chandigarh", "PY": "Puducherry",
}

GSTIN_STATE_CODES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan",
    "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
    "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura",
    "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
    "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "32": "Kerala",
    "33": "Tamil Nadu", "36": "Telangana", "37": "Andhra Pradesh",
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

    def analyze_email_header(self, request: EmailHeaderRequest) -> EmailHeaderResponse:
        raw = request.raw_header.strip()
        sender = ""
        return_path = None
        spf_status = "none"
        dkim_status = "none"
        dmarc_status = "none"
        originating_ip = None
        flags: list[dict[str, str]] = []
        recommendations: list[str] = []
        risk_score = 0

        from_match = re.search(r'(?i)^From:\s*(.+)$', raw, re.MULTILINE)
        if from_match:
            sender = from_match.group(1).strip()

        return_path_match = re.search(r'(?i)^Return-Path:\s*<?([^>\r\n]+)>?', raw, re.MULTILINE)
        if return_path_match:
            return_path = return_path_match.group(1).strip()

        spf_match = re.search(r'(?i)spf=(pass|fail|softfail|neutral|none)', raw)
        if not spf_match:
            spf_match = re.search(r'(?i)Received-SPF:\s*(pass|fail|softfail|neutral|none)', raw)
        if spf_match:
            spf_status = spf_match.group(1).lower()

        dkim_match = re.search(r'(?i)dkim=(pass|fail|none)', raw)
        if dkim_match:
            dkim_status = dkim_match.group(1).lower()

        dmarc_match = re.search(r'(?i)dmarc=(pass|fail|none)', raw)
        if dmarc_match:
            dmarc_status = dmarc_match.group(1).lower()

        ip_matches = re.findall(r'\[([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\]', raw)
        if ip_matches:
            originating_ip = ip_matches[-1]

        from_email_match = re.search(r'[\w\.-]+@([\w\.-]+)', sender)
        from_domain = from_email_match.group(1).lower() if from_email_match else ""

        return_domain = ""
        if return_path:
            ret_match = re.search(r'[\w\.-]+@([\w\.-]+)', return_path)
            if ret_match:
                return_domain = ret_match.group(1).lower()

        is_spoofed = False

        if spf_status == "fail":
            risk_score += 45
            is_spoofed = True
            flags.append({
                "code": "SPF_VALIDATION_FAILED",
                "severity": "critical",
                "message": f"SPF verification failed. Sending mail server is not authorized by '{from_domain}' to send emails on its behalf.",
            })
            recommendations.append("This email failed SPF authentication. The sender address is almost certainly forged/spoofed.")
        elif spf_status == "softfail":
            risk_score += 30
            flags.append({
                "code": "SPF_SOFTFAIL",
                "severity": "high",
                "message": "SPF returned softfail; mail server is questionable and likely impersonating the sender.",
            })

        if dkim_status == "fail":
            risk_score += 40
            is_spoofed = True
            flags.append({
                "code": "DKIM_SIGNATURE_INVALID",
                "severity": "critical",
                "message": "Cryptographic DKIM signature failed or was tampered with in transit.",
            })
            recommendations.append("Email headers show a broken or spoofed cryptographic DKIM signature.")

        if dmarc_status == "fail":
            risk_score += 50
            is_spoofed = True
            flags.append({
                "code": "DMARC_POLICY_REJECT",
                "severity": "critical",
                "message": "DMARC alignment check failed. Email violates the domain owner's anti-phishing policy.",
            })
            recommendations.append("DMARC alignment failure indicates an active impersonation or phishing attempt.")

        if from_domain and return_domain and from_domain != return_domain:
            if not any(brand in return_domain for brand in ["google", "sendgrid", "mailchimp", "salesforce"]):
                risk_score += 25
                flags.append({
                    "code": "SENDER_ENVELOPE_MISMATCH",
                    "severity": "high",
                    "message": f"Visible sender claims '@{from_domain}' but actual bounce envelope routes to '@{return_domain}'.",
                })
                recommendations.append("Verify if the company uses an external third-party mailer or if this is an envelope mismatch trap.")

        if not sender:
            sender = "Unknown Sender"
            risk_score += 20
            flags.append({"code": "MISSING_FROM_HEADER", "severity": "medium", "message": "Email headers lack a clean RFC From field."})

        if spf_status == "pass" and dkim_status == "pass" and not is_spoofed:
            risk_score = 5
            flags.append({
                "code": "CRYPTOGRAPHIC_AUTH_PASS",
                "severity": "safe",
                "message": f"Sender domain '@{from_domain}' successfully verified via SPF and DKIM authentication.",
            })
            recommendations.append("Email cryptographically originated from the authorized sending server.")

        risk_score = max(0, min(100, risk_score))
        if risk_score >= 70:
            risk_level = "critical" if risk_score >= 85 else "high"
        elif risk_score >= 40:
            risk_level = "medium"
        elif risk_score >= 20:
            risk_level = "low"
        else:
            risk_level = "safe"

        summary = f"Email Header Forensic analysis completed with risk score {risk_score}/100 ({risk_level.upper()}). "
        if is_spoofed:
            summary += "CRITICAL: Email displays indicators of spoofed or forged sender identity. "
        else:
            summary += f"Sender authentication status: SPF={spf_status.upper()}, DKIM={dkim_status.upper()}, DMARC={dmarc_status.upper()}. "

        return EmailHeaderResponse(
            sender=sender,
            return_path=return_path,
            spf_status=spf_status,
            dkim_status=dkim_status,
            dmarc_status=dmarc_status,
            originating_ip=originating_ip,
            is_spoofed=is_spoofed,
            risk_score=risk_score,
            risk_level=risk_level,
            flags=flags,
            recommendations=recommendations or ["Always independently verify job offers via official company career sites."],
            summary=summary.strip(),
        )

    def analyze_document_metadata(self, request: DocumentMetadataRequest) -> DocumentMetadataResponse:
        file_name = request.file_name.strip()
        text = (request.text_content or "").lower()
        b64 = request.file_bytes_base64 or ""

        file_type = "pdf" if file_name.lower().endswith(".pdf") else ("image" if any(file_name.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg"]) else "document")

        creator = None
        producer = None
        creation_date = None
        mod_date = None
        has_digital_signature = False
        is_tampered_or_canva = False
        software_tool = None
        forensic_findings: list[dict[str, str]] = []
        recommendations: list[str] = []
        risk_score = 0

        lower_all = f"{file_name} {text}".lower()
        if b64:
            try:
                import base64
                decoded_bytes = base64.b64decode(b64[:10000])
                decoded_str = decoded_bytes.decode(errors="ignore").lower()
                lower_all += f" {decoded_str}"
            except Exception:
                pass

        canva_detected = "canva" in lower_all
        photoshop_detected = "photoshop" in lower_all or "adobe photoshop" in lower_all
        gimp_detected = "gimp" in lower_all
        ilovepdf_detected = "ilovepdf" in lower_all or "smallpdf" in lower_all or "sejda" in lower_all

        if canva_detected:
            is_tampered_or_canva = True
            software_tool = "Canva Design Platform"
            creator = "Canva"
            producer = "Canva Web Generator"
            risk_score += 85
            forensic_findings.append({
                "code": "CANVA_DESIGN_TEMPLATE",
                "severity": "critical",
                "message": "Document metadata reveals it was created using Canva (a free graphic design tool), NOT official enterprise document software.",
            })
            recommendations.append("Legitimate Fortune 500 & Indian IT employers generate formal offer letters via ERPs (Workday, SAP, Oracle), never Canva.")
        elif photoshop_detected:
            is_tampered_or_canva = True
            software_tool = "Adobe Photoshop"
            creator = "Adobe Photoshop"
            producer = "Adobe ImageReady / Photoshop Export"
            risk_score += 85
            forensic_findings.append({
                "code": "PHOTOSHOP_IMAGE_EDITED",
                "severity": "critical",
                "message": "Metadata confirms the document was manipulated or exported via Adobe Photoshop graphic editor.",
            })
            recommendations.append("Official appointment letters are legal contracts produced by document management systems, not edited in Photoshop.")
        elif gimp_detected or ilovepdf_detected:
            is_tampered_or_canva = True
            software_tool = "Online PDF Editor / GIMP"
            risk_score += 65
            forensic_findings.append({
                "code": "THIRD_PARTY_ONLINE_MODIFIER",
                "severity": "high",
                "message": "Document was modified using a free web PDF tool or image manipulation program.",
            })

        if any(sig in lower_all for sig in ["pkcs#7", "docusign", "adobesign", "valid digital signature", "certifying signature", "x.509"]):
            has_digital_signature = True
            risk_score = max(0, risk_score - 30)
            forensic_findings.append({
                "code": "DIGITAL_SIGNATURE_DETECTED",
                "severity": "safe",
                "message": "Cryptographic digital signature or certificate authority watermark detected in document structure.",
            })
        else:
            forensic_findings.append({
                "code": "NO_CRYPTOGRAPHIC_SIGNATURE",
                "severity": "low",
                "message": "Document contains no verifiable cryptographic digital signature (DocuSign/AdobeSign/e-Mudhra).",
            })

        if any(w in lower_all for w in ["registration fee", "security deposit", "laptop charge", "gate pass", "refundable fee"]):
            risk_score += 35
            forensic_findings.append({
                "code": "DOCUMENT_EXTORTION_CLAUSE",
                "severity": "critical",
                "message": "Document body contains illegal upfront fee or security deposit clauses.",
            })
            recommendations.append("Zero-Fee Hiring Policy: Indian corporate appointment letters NEVER require money transfer to join.")

        if not is_tampered_or_canva and not software_tool:
            software_tool = "Standard Corporate Document Producer"
            creator = "Enterprise HR System"
            producer = "Adobe PDF Library"
            if not forensic_findings:
                forensic_findings.append({"code": "CLEAN_DOCUMENT_STRUCTURE", "severity": "safe", "message": "No obvious graphics manipulation metadata detected."})

        risk_score = max(0, min(100, risk_score))
        if risk_score >= 70:
            risk_level = "critical" if risk_score >= 85 else "high"
        elif risk_score >= 40:
            risk_level = "medium"
        elif risk_score >= 20:
            risk_level = "low"
        else:
            risk_level = "safe"

        summary = f"Offer Letter Forensic Inspection completed for '{file_name}' with risk score {risk_score}/100 ({risk_level.upper()}). "
        if is_tampered_or_canva:
            summary += f"DETECTED FABRICATION: Document was generated in {software_tool}. "
        elif has_digital_signature:
            summary += "Document bears corporate digital signature attributes. "

        return DocumentMetadataResponse(
            file_name=file_name,
            file_type=file_type,
            software_tool=software_tool,
            is_tampered_or_canva=is_tampered_or_canva,
            creator=creator,
            producer=producer,
            creation_date=creation_date,
            mod_date=mod_date,
            has_digital_signature=has_digital_signature,
            risk_score=risk_score,
            risk_level=risk_level,
            forensic_findings=forensic_findings,
            recommendations=recommendations or ["Ensure offer letters are verified with the official HR email of the employer."],
            summary=summary.strip(),
        )

    def analyze_qr_trap(self, request: QrCodeTrapRequest) -> QrCodeTrapResponse:
        raw = request.qr_payload_or_uri.strip()
        context = (request.context_text or "").lower()

        is_upi = raw.lower().startswith("upi://pay") or ("pa=" in raw and "@" in raw)
        is_debit_trap = False
        vpa_payee = None
        payee_name = None
        demanded_amount = None
        indicators: list[dict[str, str]] = []
        recommendations: list[str] = []
        risk_score = 0

        if is_upi:
            parsed = urlparse(raw if "://" in raw else f"upi://pay?{raw}")
            query_params = parse_qs(parsed.query)

            vpa_list = query_params.get("pa", [])
            if vpa_list:
                vpa_payee = vpa_list[0].strip().lower()
            elif "@" in raw:
                vpa_match = re.search(r'[\w\.-]+@[\w\.-]+', raw)
                if vpa_match:
                    vpa_payee = vpa_match.group(0).lower()

            pn_list = query_params.get("pn", [])
            if pn_list:
                payee_name = pn_list[0].strip()

            am_list = query_params.get("am", [])
            if am_list:
                demanded_amount = f"₹{am_list[0].strip()}"

            is_debit_trap = True
            risk_score += 85
            indicators.append({
                "code": "REVERSE_PAYMENT_QR_TRAP",
                "severity": "critical",
                "message": f"This QR code encodes an outgoing UPI payment request ('upi://pay') to '{vpa_payee or 'recipient'}'. Scanning this and entering UPI PIN will DEDUCT money from your bank account!",
            })
            recommendations.append("NEVER enter your UPI PIN to receive money! In Indian UPI banking architecture, you only enter your PIN when SENDING money, never when receiving.")

            if vpa_payee:
                handle = vpa_payee.split("@")[-1].lower() if "@" in vpa_payee else ""
                if handle in PERSONAL_UPI_PSPS:
                    risk_score += 10
                    indicators.append({
                        "code": "PERSONAL_UPI_HANDLE",
                        "severity": "high",
                        "message": f"QR payment directs funds to a personal consumer account ({PERSONAL_UPI_PSPS[handle]}), NOT a registered corporate merchant account.",
                    })

            if any(w in context for w in ["receive", "refund", "bonus", "salary advance", "cashback", "scan to receive"]):
                risk_score += 15
                indicators.append({
                    "code": "DECEPTIVE_REFUND_PRETEXT",
                    "severity": "critical",
                    "message": "Recruiter falsely claims scanning this QR will credit funds, when the QR protocol strictly initiates an account debit.",
                })
        else:
            risk_score += 40
            indicators.append({
                "code": "NON_UPI_OR_MALICIOUS_QR_LINK",
                "severity": "medium",
                "message": "QR payload is not a direct UPI protocol link; it may lead to an external phishing URL or APK download.",
            })
            recommendations.append("Inspect the exact destination URL before opening external links from unknown QR codes.")

        risk_score = max(0, min(100, risk_score))
        if risk_score >= 70:
            risk_level = "critical" if risk_score >= 85 else "high"
        elif risk_score >= 40:
            risk_level = "medium"
        elif risk_score >= 20:
            risk_level = "low"
        else:
            risk_level = "safe"

        summary = f"QR Payment Trap Scanner evaluated with risk score {risk_score}/100 ({risk_level.upper()}). "
        if is_debit_trap:
            summary += f"DANGER: Reverse Payment QR Trap! Scanning will transfer money to {vpa_payee or 'fraudster'}. "

        return QrCodeTrapResponse(
            raw_payload=raw,
            is_upi_scheme=is_upi,
            is_debit_trap=is_debit_trap,
            vpa_payee=vpa_payee,
            payee_name=payee_name,
            demanded_amount=demanded_amount,
            risk_score=risk_score,
            risk_level=risk_level,
            deception_indicators=indicators,
            recommendations=recommendations or ["Never scan QR codes sent over WhatsApp for recruitment verification."],
            summary=summary.strip(),
        )

    def analyze_company_cin(self, request: CompanyCinRequest) -> CompanyCinResponse:
        query = request.cin_or_gstin.strip().upper()

        cin_regex = r'^([LU])([0-9]{5})([A-Z]{2})([0-9]{4})([A-Z]{3})([0-9]{6})$'
        gstin_regex = r'^([0-9]{2})([A-Z]{5}[0-9]{4}[A-Z]{1})([1-9A-Z]{1})Z([0-9A-Z]{1})$'

        id_type = "INVALID"
        is_valid = False
        state_code = None
        state_name = None
        industry_category = None
        incorporation_year = None
        entity_class = None
        details: list[dict[str, str]] = []
        recommendations: list[str] = []
        risk_score = 0

        cin_match = re.match(cin_regex, query)
        gstin_match = re.match(gstin_regex, query)

        if cin_match:
            id_type = "CIN"
            is_valid = True
            listing = "Listed Corporate Entity" if cin_match.group(1) == "L" else "Unlisted Corporate Entity"
            nic_code = cin_match.group(2)
            state_code = cin_match.group(3)
            inc_year = int(cin_match.group(4))
            company_type_code = cin_match.group(5)

            state_name = INDIAN_STATES.get(state_code, f"State Code ({state_code})")
            incorporation_year = inc_year

            type_map = {
                "PTC": "Private Limited Company",
                "PLC": "Public Limited Company",
                "GOI": "Government of India Enterprise",
                "FTC": "Foreign Subsidiary Company",
                "ULL": "Unlimited Liability Public",
                "ULT": "Unlimited Liability Private",
            }
            entity_class = type_map.get(company_type_code, f"Entity Type ({company_type_code})")

            if nic_code.startswith("72") or nic_code.startswith("62"):
                industry_category = "Information Technology & Software Services"
            elif nic_code.startswith("65") or nic_code.startswith("64"):
                industry_category = "Financial Intermediation & Banking"
            elif nic_code.startswith("51") or nic_code.startswith("47"):
                industry_category = "Wholesale & Retail Trade"
            elif nic_code.startswith("35") or nic_code.startswith("30"):
                industry_category = "Manufacturing & Aviation / Aerospace"
            else:
                industry_category = f"Commercial Industry (NIC {nic_code})"

            now_year = datetime.now(timezone.utc).year
            if inc_year < 1850 or inc_year > now_year:
                risk_score += 70
                details.append({
                    "code": "ANOMALOUS_INCORPORATION_YEAR",
                    "severity": "critical",
                    "message": f"Incorporation year {inc_year} in CIN is invalid.",
                })
            else:
                company_age = now_year - inc_year
                risk_score = 10 if company_age >= 5 else 25
                details.append({
                    "code": "VALID_MCA_CIN_STRUCTURE",
                    "severity": "safe",
                    "message": f"Valid MCA 21-digit CIN structure verified. {listing}, Registered in {state_name} ({inc_year}), Class: {entity_class}.",
                })

        elif gstin_match:
            id_type = "GSTIN"
            is_valid = True
            st_code = gstin_match.group(1)
            pan = gstin_match.group(2)

            state_code = st_code
            state_name = GSTIN_STATE_CODES.get(st_code, f"GST State Code ({st_code})")
            entity_class = "GST Registered Commercial Entity"
            industry_category = "Commercial Goods & Services Taxpayer"

            pan_type = pan[3]
            pan_type_desc = {
                "C": "Company",
                "P": "Individual / Proprietorship",
                "H": "HUF",
                "F": "Partnership Firm / LLP",
                "A": "Association of Persons",
                "T": "Trust",
                "G": "Government Agency",
            }.get(pan_type, "Commercial Entity")

            if pan_type == "P":
                risk_score += 40
                details.append({
                    "code": "PROPRIETORSHIP_PAN_IN_GST",
                    "severity": "high",
                    "message": f"GSTIN belongs to an Individual Proprietor (PAN 4th character 'P'), not an incorporated corporate entity.",
                })
                recommendations.append("Major corporate employers always hold corporate PANs ('C' in 4th character), not individual personal PANs.")
            else:
                risk_score = 15
                details.append({
                    "code": "VALID_GSTIN_STRUCTURE",
                    "severity": "safe",
                    "message": f"Valid 15-character Indian GSTIN structure. Registered in {state_name}, Entity: {pan_type_desc}.",
                })
        else:
            id_type = "INVALID"
            is_valid = False
            risk_score = 80
            details.append({
                "code": "INVALID_REGISTRATION_NUMBER",
                "severity": "critical",
                "message": f"'{query}' does not match either a valid 21-digit Indian CIN or 15-digit GSTIN number.",
            })
            recommendations.append("Check if the recruiter provided a forged or random alphanumeric string instead of genuine government corporate registration.")

        risk_score = max(0, min(100, risk_score))
        if risk_score >= 70:
            risk_level = "critical" if risk_score >= 85 else "high"
        elif risk_score >= 40:
            risk_level = "medium"
        elif risk_score >= 20:
            risk_level = "low"
        else:
            risk_level = "safe"

        summary = f"Ministry of Corporate Affairs / Tax Registry verification for '{query}' completed with risk score {risk_score}/100 ({risk_level.upper()}). "
        if is_valid:
            summary += f"Format verified as {id_type} for {state_name or 'India'}. "
        else:
            summary += "FORGERY ALERT: Unrecognized government registration number. "

        return CompanyCinResponse(
            query_id=query,
            id_type=id_type,
            is_valid_format=is_valid,
            state_code=state_code,
            state_name=state_name,
            industry_category=industry_category,
            incorporation_year=incorporation_year,
            entity_class=entity_class,
            risk_score=risk_score,
            risk_level=risk_level,
            verification_details=details,
            recommendations=recommendations or ["Cross-verify company registration on the official Ministry of Corporate Affairs portal (mca.gov.in)."],
            summary=summary.strip(),
        )
