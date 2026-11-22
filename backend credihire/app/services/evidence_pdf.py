from datetime import datetime, timezone
import uuid
import pymupdf

from app.schemas.osint import DossierPdfRequest


class EvidencePdfGenerator:
    def generate_dossier_pdf(self, data: DossierPdfRequest) -> bytes:
        doc = pymupdf.open()
        page = doc.new_page(width=595, height=842)  # Standard A4 (points)

        dossier_id = data.dossier_id or f"CRD-CYBER-{datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
        generated_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

        # Color Palette
        c_navy = (0.07, 0.13, 0.28)
        c_white = (1.0, 1.0, 1.0)
        c_card_bg = (0.95, 0.96, 0.98)
        c_border = (0.8, 0.84, 0.9)
        c_danger = (0.85, 0.15, 0.15) if data.risk_score >= 70 else (0.9, 0.55, 0.1) if data.risk_score >= 40 else (0.1, 0.6, 0.3)
        c_text_dark = (0.12, 0.15, 0.2)
        c_text_muted = (0.4, 0.45, 0.52)

        # 1. Top Header Banner
        header_rect = pymupdf.Rect(35, 35, 560, 95)
        page.draw_rect(header_rect, color=c_navy, fill=c_navy)

        page.insert_text(pymupdf.Point(48, 58), "NATIONAL CYBER CRIME REPORTING EVIDENCE DOSSIER", fontsize=11, color=(0.85, 0.9, 1.0), fontname="helv")
        page.insert_text(pymupdf.Point(48, 78), "CREDIHIRE FORENSIC INVESTIGATION REPORT", fontsize=15, color=c_white, fontname="helv")
        page.insert_text(pymupdf.Point(48, 90), "Statutory Evidence Annexure under IT Act 2000 & Indian Penal Code", fontsize=8, color=(0.7, 0.78, 0.9), fontname="helv")

        # Reference Badge on Top Right
        page.insert_text(pymupdf.Point(400, 60), f"REF: {dossier_id}", fontsize=9, color=c_white, fontname="helv")
        page.insert_text(pymupdf.Point(400, 75), f"DATE: {generated_at}", fontsize=8, color=(0.8, 0.85, 0.95), fontname="helv")

        # 2. Risk Evaluation Box
        risk_box = pymupdf.Rect(35, 105, 560, 155)
        page.draw_rect(risk_box, color=c_border, fill=c_card_bg)

        page.insert_text(pymupdf.Point(50, 125), "THREAT LEVEL ASSESSMENT", fontsize=9, color=c_text_muted, fontname="helv")
        page.insert_text(pymupdf.Point(50, 145), f"{data.risk_level.upper()} RISK ({data.risk_score}/100)", fontsize=16, color=c_danger, fontname="helv")

        # Demanded amount & contact badges
        fee_label = data.demanded_amount or "Advance Fee Demanded"
        vpa_label = data.payment_handle or "Suspect UPI / Payment Handle"
        page.insert_text(pymupdf.Point(260, 125), "EXTORTION / DEMAND AMOUNT:", fontsize=8, color=c_text_muted, fontname="helv")
        page.insert_text(pymupdf.Point(260, 142), fee_label, fontsize=12, color=c_danger, fontname="helv")

        page.insert_text(pymupdf.Point(410, 125), "BENEFICIARY TARGET:", fontsize=8, color=c_text_muted, fontname="helv")
        page.insert_text(pymupdf.Point(410, 142), vpa_label[:22], fontsize=10, color=c_text_dark, fontname="helv")

        # 3. Statutory Legal Provisions Box
        legal_box = pymupdf.Rect(35, 165, 560, 245)
        page.draw_rect(legal_box, color=(0.85, 0.75, 0.5), fill=(0.99, 0.98, 0.94))

        page.insert_text(pymupdf.Point(48, 182), "APPLICABLE STATUTORY LEGAL PROVISIONS (INDIAN LAW)", fontsize=9, color=(0.6, 0.4, 0.1), fontname="helv")
        page.insert_text(pymupdf.Point(48, 200), "• Section 420 IPC: Cheating and dishonestly inducing delivery of property (Imprisonment up to 7 years + fine).", fontsize=8, color=c_text_dark, fontname="helv")
        page.insert_text(pymupdf.Point(48, 214), "• Section 419 IPC: Punishment for cheating by personation (Imprisonment up to 3 years + fine).", fontsize=8, color=c_text_dark, fontname="helv")
        page.insert_text(pymupdf.Point(48, 228), "• Section 66D IT Act 2000: Cheating by personation using computer resource or communication device.", fontsize=8, color=c_text_dark, fontname="helv")
        page.insert_text(pymupdf.Point(48, 240), "• Emigration Act 1983 (Sec 10/24): Prohibits demanding recruitment processing fees from job seekers.", fontsize=8, color=c_text_dark, fontname="helv")

        # 4. Verified Indicators Section
        y_pos = 265
        page.insert_text(pymupdf.Point(35, y_pos), "DETECTED SCAM INDICATORS & RED FLAGS", fontsize=11, color=c_navy, fontname="helv")
        y_pos += 15

        indicators_to_show = data.indicators[:4] or ["Advance fee / deposit demanded prior to commencement of work."]
        for ind in indicators_to_show:
            ind_text = ind if isinstance(ind, str) else ind.get("message", "Suspicious recruitment indicator detected")
            page.draw_rect(pymupdf.Rect(35, y_pos - 2, 560, y_pos + 16), color=c_border, fill=c_white)
            page.insert_text(pymupdf.Point(45, y_pos + 10), f"⚠  {ind_text[:85]}", fontsize=8.5, color=c_text_dark, fontname="helv")
            y_pos += 22

        # 5. Evidentiary Text Excerpt Box
        y_pos += 8
        page.insert_text(pymupdf.Point(35, y_pos), "EVIDENTIARY TEXT EXCERPT (EXTRACTED OFFER CONTENT)", fontsize=11, color=c_navy, fontname="helv")
        y_pos += 12

        excerpt_box = pymupdf.Rect(35, y_pos, 560, y_pos + 140)
        page.draw_rect(excerpt_box, color=c_border, fill=c_card_bg)

        # Wrap text into excerpt box
        wrapped_lines = []
        raw_text = data.job_text.replace("\r", " ").replace("\n", " ").strip()
        words = raw_text.split()
        current_line = []
        for word in words:
            if len(" ".join(current_line + [word])) < 95:
                current_line.append(word)
            else:
                wrapped_lines.append(" ".join(current_line))
                current_line = [word]
                if len(wrapped_lines) >= 8:
                    break
        if current_line and len(wrapped_lines) < 8:
            wrapped_lines.append(" ".join(current_line))

        ty = y_pos + 18
        for wline in wrapped_lines:
            page.insert_text(pymupdf.Point(45, ty), wline, fontsize=8, color=c_text_dark, fontname="courier")
            ty += 14

        y_pos += 155

        # 6. Official Golden Hour Emergency Steps
        sop_box = pymupdf.Rect(35, y_pos, 560, y_pos + 115)
        page.draw_rect(sop_box, color=(0.2, 0.4, 0.7), fill=(0.95, 0.97, 1.0))

        page.insert_text(pymupdf.Point(48, y_pos + 18), "VICTIM GOLDEN HOUR ACTION PROTOCOL (CYBERCRIME SOP)", fontsize=9.5, color=c_navy, fontname="helv")
        page.insert_text(pymupdf.Point(48, y_pos + 35), "1. Call 1930 Helpline immediately: Citizen Financial Cyber Fraud Reporting System operates 24x7.", fontsize=8, color=c_text_dark, fontname="helv")
        page.insert_text(pymupdf.Point(48, y_pos + 50), "2. File on https://cybercrime.gov.in: Select 'Financial Fraud' or 'Job Scam' and attach this PDF Dossier.", fontsize=8, color=c_text_dark, fontname="helv")
        page.insert_text(pymupdf.Point(48, y_pos + 65), "3. Request UPI / Bank Freeze: Quote this report to initiate an immediate freeze on suspect VPA/Account under Sec 102 CrPC.", fontsize=8, color=c_text_dark, fontname="helv")
        page.insert_text(pymupdf.Point(48, y_pos + 80), "4. Report WhatsApp / Telegram Accounts: Use the messaging app's 'Report as Scam' tool to block SIM recycling.", fontsize=8, color=c_text_dark, fontname="helv")
        page.insert_text(pymupdf.Point(48, y_pos + 98), "CrediHire Helpline Advisory: Legitimate Indian companies never charge security deposits or interview fees.", fontsize=8, color=(0.1, 0.35, 0.65), fontname="helv")

        # 7. Verification Stamp & Footer
        page.insert_text(pymupdf.Point(35, 815), "Generated by CrediHire Autonomous Scam Intelligence System • Verified Digital Forensic Artifact", fontsize=7.5, color=c_text_muted, fontname="helv")
        page.insert_text(pymupdf.Point(450, 815), f"Page 1 of 1 • {dossier_id}", fontsize=7.5, color=c_text_muted, fontname="helv")

        pdf_bytes = doc.tobytes()
        doc.close()
        return pdf_bytes
