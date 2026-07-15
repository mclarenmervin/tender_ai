import os
import smtplib
from email.message import EmailMessage
from html import escape

from dotenv import load_dotenv

from app.database.models import NotificationLog, NotificationPreference, Tender, User

load_dotenv()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL") or SMTP_USERNAME or ADMIN_EMAIL
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"


def email_configured():
    return bool(SMTP_HOST and SMTP_FROM_EMAIL and (SMTP_USERNAME or not SMTP_PASSWORD))


def tender_html(tender):
    return f"""
<tr>
  <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
    <strong>{escape(tender.title or '')}</strong><br>
    <span style="color:#64748b;">{escape(tender.tender_id or '')}</span><br>
    Department: {escape(tender.department or '')}<br>
    State: {escape(tender.state or '')}<br>
    Value: Rs. {tender.estimated_value or 0}<br>
    Deadline: {escape(str(tender.deadline or ''))}<br>
    Score: {escape(str(tender.relevance_score if tender.relevance_score is not None else ''))}<br>
    <a href="{escape(tender.url or '')}">View source</a>
  </td>
</tr>
""".strip()


def scrape_details_html(details):
    if not details:
        return ""
    keywords = details.get("keywords") or []
    source_logs = details.get("source_logs") or []
    keyword_text = ", ".join(escape(str(keyword)) for keyword in keywords) or "No keywords recorded"
    source_rows = ""
    for log in source_logs[:20]:
        source_rows += f"""
<tr>
  <td style="padding:8px;border-bottom:1px solid #e5e7eb;">{escape(str(log.get('source') or 'GeM'))}</td>
  <td style="padding:8px;border-bottom:1px solid #e5e7eb;">{escape(str(log.get('status') or ''))}</td>
  <td style="padding:8px;border-bottom:1px solid #e5e7eb;">{escape(str(log.get('message') or ''))}</td>
</tr>
""".strip()
    if not source_rows:
        source_rows = '<tr><td colspan="3" style="padding:8px;">No source log rows recorded.</td></tr>'
    return f"""
<div style="margin:16px 0;padding:12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;">
  <h3 style="margin:0 0 8px;">Scrape details</h3>
  <p style="margin:0 0 6px;">Trigger: {escape(str(details.get('trigger') or 'scrape'))}</p>
  <p style="margin:0 0 6px;">Inserted: {escape(str(details.get('inserted', 0)))} | Scored: {escape(str(details.get('scored', 0)))} | Removed low priority: {escape(str(details.get('removed_low_priority', 0)))}</p>
  <p style="margin:0 0 10px;">Keywords: {keyword_text}</p>
  <table style="border-collapse:collapse;width:100%;font-size:13px;">
    <thead><tr><th align="left">Source</th><th align="left">Status</th><th align="left">Message</th></tr></thead>
    <tbody>{source_rows}</tbody>
  </table>
</div>
""".strip()


def scrape_details_text(details):
    if not details:
        return ""
    keywords = ", ".join(str(keyword) for keyword in (details.get("keywords") or [])) or "No keywords recorded"
    lines = [
        "Scrape details:",
        f"Trigger: {details.get('trigger') or 'scrape'}",
        f"Inserted: {details.get('inserted', 0)}",
        f"Scored: {details.get('scored', 0)}",
        f"Removed low priority: {details.get('removed_low_priority', 0)}",
        f"Keywords: {keywords}",
        "Source logs:",
    ]
    for log in (details.get("source_logs") or [])[:20]:
        lines.append(f"- {log.get('source') or 'GeM'} [{log.get('status') or ''}]: {log.get('message') or ''}")
    return "\n".join(lines)


def send_email(to_email, subject, html_body, text_body):
    if not email_configured() or not to_email:
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM_EMAIL
    msg["To"] = to_email
    if ADMIN_EMAIL:
        msg["Reply-To"] = ADMIN_EMAIL
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
        if SMTP_USE_TLS:
            server.starttls()
        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
    return True


def email_notification_readiness(db, user_id, tender_ids=None):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.email:
        return {"ok": False, "reason": "Profile email is missing."}
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id,
        NotificationPreference.channel == "email",
    ).first()
    if pref and not pref.enabled:
        return {"ok": False, "reason": "Email alerts are disabled in Profile."}
    if not email_configured():
        return {"ok": False, "reason": "SMTP email is not configured on the server."}
    if tender_ids is not None:
        if not tender_ids:
            return {"ok": False, "reason": "No newly inserted tenders were available for email."}
        count = db.query(Tender.id).filter(Tender.user_id == user_id, Tender.id.in_(tender_ids)).count()
        if not count:
            return {"ok": False, "reason": "New tender rows were not available when email was prepared, possibly because they were removed by high-priority-only filtering."}
    return {"ok": True, "reason": "Email notification ready."}


def log_email_notifications(db, tenders, recipient, status, message=None, error=None):
    for tender in tenders:
        db.add(NotificationLog(
            user_id=tender.user_id,
            tender_id=tender.id,
            channel="email",
            recipient=recipient,
            status=status,
            message=message,
            error=error,
        ))
    db.commit()


def notify_new_tenders_email(db, tender_ids, user_id, scrape_details=None):
    if not tender_ids:
        return 0

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.email:
        return 0
    pref=db.query(NotificationPreference).filter(NotificationPreference.user_id==user_id,NotificationPreference.channel=="email").first()
    if pref and not pref.enabled:
        return 0

    tenders = (
        db.query(Tender)
        .filter(Tender.user_id == user_id, Tender.id.in_(tender_ids))
        .order_by(Tender.created_at.desc())
        .all()
    )
    if not tenders:
        return 0

    rows = "\n".join(tender_html(tender) for tender in tenders)
    subject = f"Tender AI: {len(tenders)} new tender{'s' if len(tenders) != 1 else ''} added"
    details_html = scrape_details_html(scrape_details)
    details_text = scrape_details_text(scrape_details)
    html_body = f"""
<div style="font-family:Arial,sans-serif;color:#111827;">
  <h2>New tenders added to Tender AI</h2>
  <p>{len(tenders)} new tender{'s were' if len(tenders) != 1 else ' was'} added during your scrape.</p>
  {details_html}
  <table style="border-collapse:collapse;width:100%;">{rows}</table>
</div>
""".strip()
    tender_text = "\n\n".join(
        f"{t.title or ''}\nID: {t.tender_id or ''}\nDepartment: {t.department or ''}\nState: {t.state or ''}\nDeadline: {t.deadline or ''}\nScore: {t.relevance_score if t.relevance_score is not None else ''}\nLink: {t.url or ''}"
        for t in tenders
    )
    text_body = (details_text + "\n\n" if details_text else "") + tender_text

    try:
        if send_email(user.email, subject, html_body, text_body):
            log_email_notifications(db, tenders, user.email, "sent", message=subject)
            return len(tenders)
        log_email_notifications(db, tenders, user.email, "skipped", message="SMTP is not configured")
        return 0
    except Exception as e:
        log_email_notifications(db, tenders, user.email, "failed", message=subject, error=str(e))
        return 0
