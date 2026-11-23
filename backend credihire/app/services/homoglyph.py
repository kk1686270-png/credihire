"""Unicode Homograph and Visual Typo-Squatting Forensic Analyzer.

Detects internationalized domain name (IDN) spoofing, Punycode deception,
Cyrillic/Greek lookalike characters, and visual brand impersonation.
"""

from __future__ import annotations

import unicodedata
import urllib.parse
from typing import Any, Dict, List, Optional

# Comprehensive mapping of visual homoglyphs (Cyrillic, Greek, Latin lookalikes) to standard Latin ASCII
HOMOGLYPH_MAP: Dict[str, str] = {
    # Cyrillic lowercase
    "\u0430": "a",  # Cyrillic Small Letter A
    "\u0441": "c",  # Cyrillic Small Letter Es
    "\u0435": "e",  # Cyrillic Small Letter Ie
    "\u043e": "o",  # Cyrillic Small Letter O
    "\u0440": "p",  # Cyrillic Small Letter Er
    "\u0445": "x",  # Cyrillic Small Letter Ha
    "\u0443": "y",  # Cyrillic Small Letter U
    "\u0456": "i",  # Cyrillic Small Letter Byelorussian-Ukrainian I
    "\u0458": "j",  # Cyrillic Small Letter Je
    "\u0455": "s",  # Cyrillic Small Letter Dze
    "\u0501": "d",  # Cyrillic Small Letter Komi De
    "\u051b": "q",  # Cyrillic Small Letter Qa
    "\u051d": "w",  # Cyrillic Small Letter We
    "\u04bb": "h",  # Cyrillic Small Letter Shha
    "\u04cf": "l",  # Cyrillic Small Letter Palochka
    "\u0442": "t",  # Cyrillic Small Letter Te
    # Cyrillic uppercase
    "\u0410": "A",
    "\u0412": "B",
    "\u0421": "C",
    "\u0415": "E",
    "\u041d": "H",
    "\u0406": "I",
    "\u0408": "J",
    "\u041a": "K",
    "\u041c": "M",
    "\u041e": "O",
    "\u0420": "P",
    "\u0422": "T",
    "\u0425": "X",
    "\u04ae": "Y",
    # Greek lowercase & uppercase
    "\u03b1": "a",  # Greek Small Letter Alpha
    "\u03b5": "e",  # Greek Small Letter Epsilon
    "\u03b9": "i",  # Greek Small Letter Iota
    "\u03ba": "k",  # Greek Small Letter Kappa
    "\u03bd": "v",  # Greek Small Letter Nu
    "\u03bf": "o",  # Greek Small Letter Omicron
    "\u03c1": "p",  # Greek Small Letter Rho
    "\u03c4": "t",  # Greek Small Letter Tau
    "\u03c5": "u",  # Greek Small Letter Upsilon
    "\u03c7": "x",  # Greek Small Letter Chi
    "\u0391": "A",
    "\u0392": "B",
    "\u0395": "E",
    "\u0397": "H",
    "\u0399": "I",
    "\u039a": "K",
    "\u039c": "M",
    "\u039d": "N",
    "\u039f": "O",
    "\u03a1": "P",
    "\u03a4": "T",
    "\u03a7": "X",
    "\u03a5": "Y",
    "\u0396": "Z",
}

# Top employer brands frequently targeted in India & globally
BRAND_TARGETS: Dict[str, str] = {
    "tcs.com": "Tata Consultancy Services (TCS)",
    "tcs-careers.com": "TCS Recruitment",
    "infosys.com": "Infosys Ltd",
    "wipro.com": "Wipro Technologies",
    "google.com": "Google",
    "careers.google.com": "Google Careers",
    "microsoft.com": "Microsoft",
    "amazon.com": "Amazon",
    "amazon.jobs": "Amazon Jobs",
    "tata.com": "Tata Group",
    "tatamotors.com": "Tata Motors",
    "goindigo.in": "IndiGo Airlines",
    "accenture.com": "Accenture",
    "ibm.com": "IBM",
    "linkedin.com": "LinkedIn",
    "naukri.com": "Naukri",
    "internshala.com": "Internshala",
}


def analyze_homoglyphs(domain_or_url: str) -> Dict[str, Any]:
    """Analyze a domain or URL for Unicode homoglyph spoofing and Punycode deception."""
    raw = domain_or_url.strip()
    # Strip scheme if present
    if "://" in raw:
        parsed = urllib.parse.urlparse(raw)
        host = parsed.netloc or parsed.path
    else:
        host = raw.split("/")[0]

    # Remove port if present
    host = host.split(":")[0].strip().lower()

    is_punycode = False
    decoded_host = host
    if host.startswith("xn--") or ".xn--" in host:
        is_punycode = True
        try:
            decoded_host = host.encode("ascii").decode("idna")
        except Exception:
            decoded_host = host

    detected_glyphs: List[Dict[str, str]] = []
    canonical_chars: List[str] = []

    for ch in decoded_host:
        if ch in HOMOGLYPH_MAP:
            replacement = HOMOGLYPH_MAP[ch]
            char_name = unicodedata.name(ch, "UNKNOWN CHARACTER")
            script = "Cyrillic" if "CYRILLIC" in char_name else ("Greek" if "GREEK" in char_name else "Unicode")
            detected_glyphs.append({
                "char": ch,
                "codepoint": f"U+{ord(ch):04X}",
                "name": char_name,
                "script": script,
                "replaces": replacement,
            })
            canonical_chars.append(replacement)
        else:
            canonical_chars.append(ch)

    canonical_domain = "".join(canonical_chars)
    has_homoglyph = len(detected_glyphs) > 0 or is_punycode

    # Brand target identification
    spoofed_target: Optional[str] = None
    target_company_name: Optional[str] = None

    if has_homoglyph:
        # Check if canonical domain or its sub-parts match any known brand
        for b_domain, b_name in BRAND_TARGETS.items():
            b_core = b_domain.split(".")[0]
            if canonical_domain == b_domain or canonical_domain.startswith(f"{b_core}.") or canonical_domain.startswith(f"{b_core}-"):
                spoofed_target = b_domain
                target_company_name = b_name
                break

    # Determine risk score and severity
    if spoofed_target and has_homoglyph:
        risk_score = 100
        risk_level = "critical"
        verdict = f"CRITICAL HOMOGRAPH SPOOFING: Visual lookalike domain disguising as '{target_company_name}' ({spoofed_target})!"
    elif has_homoglyph:
        risk_score = 85
        risk_level = "high"
        verdict = f"SUSPICIOUS HOMOGLYPH DETECTED: Domain contains {len(detected_glyphs)} deceptive non-ASCII character(s)."
    else:
        risk_score = 0
        risk_level = "safe"
        verdict = "Clean ASCII domain. No Unicode homoglyphs or Punycode deception found."

    return {
        "raw_domain": host,
        "is_punycode": is_punycode,
        "decoded_unicode": decoded_host,
        "canonical_domain": canonical_domain,
        "is_homograph": has_homoglyph,
        "detected_glyphs_count": len(detected_glyphs),
        "detected_glyphs": detected_glyphs,
        "spoofed_target": spoofed_target,
        "target_company_name": target_company_name,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "verdict": verdict,
    }
