"""Zero-Knowledge Personally Identifiable Information (PII) Redaction Engine.

Protects candidate confidentiality by identifying and masking Indian Aadhaar numbers,
PAN cards, bank account details, and government IDs prior to storage or AI inference,
ensuring strict compliance with the Digital Personal Data Protection (DPDP) Act.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

# Aadhaar: 12 digits, starts with 2-9, optional spaces or dashes
AADHAAR_REGEX = re.compile(r"\b[2-9]\d{3}[\s\-]??\d{4}[\s\-]??\d{4}\b")

# Indian PAN Card: 5 uppercase letters, 4 digits, 1 uppercase letter
PAN_REGEX = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")

# Indian Passport: 1 uppercase letter followed by 7 digits
PASSPORT_REGEX = re.compile(r"\b[A-Z][0-9]{7}\b")

# Indian Driving License: State code (2 letters) + 13-15 alphanumeric characters
DL_REGEX = re.compile(r"\b[A-Z]{2}[0-9]{2}[\s\-]?[0-9]{11}\b")

# Bank Account Numbers: 9-18 digits preceded by account context keywords
BANK_AC_REGEX = re.compile(r"(?i)\b(?:a/c|account|acct|acc\.?|a/c\s+no\.?|bank\s+acc)[\s:#\-]*(\d{9,18})\b")

# Indian Mobile Numbers: Starts with 6, 7, 8, or 9; 10 digits; optional +91 or 0 prefix
# Only redacts when tagged as candidate/applicant contact to avoid masking scammer numbers
CANDIDATE_PHONE_REGEX = re.compile(r"(?i)(?:candidate|applicant|my\s+contact|my\s+phone|mobile|phone)[\s:#\-]*((?:\+91[\s\-]?)?[6-9]\d{9})\b")


def redact_pii(text: str) -> Dict[str, Any]:
    """Scans and masks sensitive PII in candidate text while preserving scam indicators."""
    if not text:
        return {
            "redacted_text": text,
            "has_pii": False,
            "redactions_count": 0,
            "detected_types": [],
            "redacted_items": [],
        }

    redacted_items: List[Dict[str, str]] = []
    redacted_text = text

    # 1. Redact Bank Account Numbers first (so numbers preceded by A/C or Account are not misclassified)
    for match in BANK_AC_REGEX.finditer(redacted_text):
        ac_num = match.group(1)
        masked_ac = f"[BANK_AC_MASKED_XXXX_{ac_num[-4:]}]"
        redacted_text = redacted_text.replace(ac_num, masked_ac)
        redacted_items.append({"type": "Bank Account Number", "masked": masked_ac})

    # 2. Redact Aadhaar Numbers
    for match in AADHAAR_REGEX.finditer(redacted_text):
        raw_val = match.group(0)
        # Avoid false positives on 12-digit timestamps or purely repetitive digits
        clean_digits = re.sub(r"[\s\-]", "", raw_val)
        if len(set(clean_digits)) > 1:
            masked = f"[AADHAAR_MASKED_XXXX_{clean_digits[-4:]}]"
            redacted_text = redacted_text.replace(raw_val, masked)
            redacted_items.append({"type": "Aadhaar Number", "masked": masked})

    # 3. Redact PAN Cards
    for match in PAN_REGEX.finditer(redacted_text):
        raw_val = match.group(0)
        masked = f"[PAN_MASKED_{raw_val[:2]}XX{raw_val[-2:]}]"
        redacted_text = redacted_text.replace(raw_val, masked)
        redacted_items.append({"type": "PAN Card", "masked": masked})

    # 4. Redact Driving License
    for match in DL_REGEX.finditer(redacted_text):
        raw_val = match.group(0)
        masked = f"[DL_MASKED_{raw_val[:4]}XXXXX]"
        redacted_text = redacted_text.replace(raw_val, masked)
        redacted_items.append({"type": "Driving License", "masked": masked})

    # 5. Redact Passport Numbers
    for match in PASSPORT_REGEX.finditer(redacted_text):
        raw_val = match.group(0)
        masked = f"[PASSPORT_MASKED_{raw_val[0]}XXXXXX]"
        redacted_text = redacted_text.replace(raw_val, masked)
        redacted_items.append({"type": "Passport Number", "masked": masked})

    # 6. Redact Candidate Personal Phone if explicitly flagged
    for match in CANDIDATE_PHONE_REGEX.finditer(redacted_text):
        raw_phone = match.group(1)
        masked = f"[CANDIDATE_PHONE_MASKED_XXXX_{raw_phone[-4:]}]"
        redacted_text = redacted_text.replace(raw_phone, masked)
        redacted_items.append({"type": "Candidate Mobile Phone", "masked": masked})

    detected_types = list({item["type"] for item in redacted_items})

    return {
        "redacted_text": redacted_text,
        "has_pii": len(redacted_items) > 0,
        "redactions_count": len(redacted_items),
        "detected_types": detected_types,
        "redacted_items": redacted_items,
    }
