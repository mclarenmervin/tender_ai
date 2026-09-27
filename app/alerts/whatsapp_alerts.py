import os
import re

import requests
from dotenv import load_dotenv

from app.database.models import AppSetting, NotificationLog, NotificationPreference, Tender

load_dotenv()

WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "").strip()
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
WHATSAPP_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v23.0").strip() or "v23.0"
WHATSAPP_TEMPLATE_NAME = os.getenv("WHATSAPP_TEMPLATE_NAME", "").strip()
WHATSAPP_TEMPLATE_LANGUAGE = os.getenv("WHATSAPP_TEMPLATE_LANGUAGE", "en").strip() or "en"
WHATSAPP_DASHBOARD_URL = os.getenv("WHATSAPP_DASHBOARD_URL", "").strip()


def normalize_whatsapp_phone(value):
    """Return an international WhatsApp recipient number without punctuation."""
    raw = (value or "").strip()
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("00"):
        digits = digits[2:]
    # A plain ten-digit number is treated as Indian because this installation
    # currently targets Indian GeM users. International users should enter +CC.
    if len(digits) == 10:
        digits = "91" + digits
    return digits if 8 <= len(digits) <= 15 else ""


def whatsapp_configured(require_template=False):
    base = bool(WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID)
    return base and (bool(WHATSAPP_TEMPLATE_NAME) if require_template else True)


def whatsapp_phone_for_user(db, user_id):
    row = db.query(AppSetting).filter(
        AppSetting.user_id == user_id,
        AppSetting.key == "whatsapp_phone",
    ).first()
    return normalize_whatsapp_phone(row.value if row else "")


def whatsapp_notification_readiness(db, user_id, require_template=True):
    phone = whatsapp_phone_for_user(db, user_id)
    if not phone:
        return {"ok": False, "reason": "WhatsApp phone number is missing or invalid."}
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id,
        NotificationPreference.channel == "whatsapp",
    ).first()
    if pref and not pref.enabled:
        return {"ok": False, "reason": "WhatsApp alerts are disabled in Profile."}
    if not whatsapp_configured(require_template=require_template):
        missing = "WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_TEMPLATE_NAME" if require_template else "WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID"
        return {"ok": False, "reason": f"WhatsApp Cloud API is not configured. Add {missing}."}
    return {"ok": True, "reason": "WhatsApp notification ready.", "phone": phone}


def _send_payload(payload, timeout=20):
    response = requests.post(
        f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages",
        headers={
            "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )
    if not response.ok:
        try:
            detail = response.json().get("error", {}).get("message")
        except Exception:
            detail = response.text
        raise RuntimeError(f"WhatsApp API {response.status_code}: {(detail or response.text)[:500]}")
    return response.json()


def send_whatsapp_text(phone, message, timeout=20):
    if not whatsapp_configured() or not phone or not message:
        return False
    _send_payload({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": normalize_whatsapp_phone(phone),
        "type": "text",
        "text": {"preview_url": True, "body": str(message)[:4096]},
    }, timeout=timeout)
    return True


def send_whatsapp_template(phone, report_text, timeout=20):
    if not whatsapp_configured(require_template=True) or not phone:
        return False
    _send_payload({
        "messaging_product": "whatsapp",
        "to": normalize_whatsapp_phone(phone),
        "type": "template",
        "template": {
            "name": WHATSAPP_TEMPLATE_NAME,
            "language": {"code": WHATSAPP_TEMPLATE_LANGUAGE},
            "components": [{
                "type": "body",
                "parameters": [{"type": "text", "text": str(report_text)[:950]}],
            }],
        },
    }, timeout=timeout)
    return True


def _compact_scrape_report(details, tenders):
    details = details or {}
    criteria = details.get("profile_name") or "Default targeting"
    keywords = ", ".join(str(value) for value in (details.get("keywords") or [])[:8]) or "None"
    lines = [
        "Tender AI auto-scrape report",
        f"Criteria: {criteria}",
        f"New: {int(details.get('inserted') or 0)} | Scored: {int(details.get('scored') or 0)} | Removed: {int(details.get('removed_low_priority') or 0)}",
        f"Keywords: {keywords}",
    ]
    for index, tender in enumerate(tenders[:5], 1):
        title = re.sub(r"\s+", " ", tender.title or "Untitled tender").strip()[:105]
        meta = " | ".join(value for value in [
            tender.tender_id or "",
            tender.department or "",
            str(tender.deadline or ""),
        ] if value)
        lines.append(f"{index}. {title}" + (f" ({meta[:145]})" if meta else ""))
    if len(tenders) > 5:
        lines.append(f"+ {len(tenders) - 5} more new tenders")
    if WHATSAPP_DASHBOARD_URL:
        lines.append(f"View: {WHATSAPP_DASHBOARD_URL}")
    return "\n".join(lines)[:950]


def _log(db, user_id, phone, status, message, tender_ids=None, error=None):
    ids = tender_ids or [None]
    for tender_id in ids:
        db.add(NotificationLog(
            user_id=user_id,
            tender_id=tender_id,
            channel="whatsapp",
            recipient=phone,
            status=status,
            message=message,
            error=error,
        ))
    db.commit()


def notify_scrape_whatsapp(db, tender_ids, user_id, scrape_details=None):
    """Send one approved-template alert for this user's criteria-specific run."""
    readiness = whatsapp_notification_readiness(db, user_id, require_template=True)
    phone = whatsapp_phone_for_user(db, user_id)
    if not readiness.get("ok"):
        if phone:
            _log(db, user_id, phone, "skipped", readiness.get("reason"), tender_ids)
        return 0
    tenders = []
    if tender_ids:
        tenders = db.query(Tender).filter(
            Tender.user_id == user_id,
            Tender.id.in_(tender_ids),
        ).order_by(Tender.created_at.desc()).all()
    report = _compact_scrape_report(scrape_details, tenders)
    try:
        sent = send_whatsapp_template(phone, report)
        _log(db, user_id, phone, "sent" if sent else "skipped", report, [row.id for row in tenders] or None)
        return 1 if sent else 0
    except Exception as exc:
        _log(db, user_id, phone, "failed", report, [row.id for row in tenders] or None, str(exc)[:1000])
        return 0

