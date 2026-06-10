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


def notify_new_tenders_email(db, tender_ids, user_id):
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
    html_body = f"""
<div style="font-family:Arial,sans-serif;color:#111827;">
  <h2>New tenders added to Tender AI</h2>
  <p>{len(tenders)} new tender{'s were' if len(tenders) != 1 else ' was'} added during your scrape.</p>
  <table style="border-collapse:collapse;width:100%;">{rows}</table>
</div>
""".strip()
    text_body = "\n\n".join(
        f"{t.title or ''}\nID: {t.tender_id or ''}\nDepartment: {t.department or ''}\nState: {t.state or ''}\nDeadline: {t.deadline or ''}\nScore: {t.relevance_score if t.relevance_score is not None else ''}\nLink: {t.url or ''}"
        for t in tenders
    )

    try:
        if send_email(user.email, subject, html_body, text_body):
            log_email_notifications(db, tenders, user.email, "sent", message=subject)
            return len(tenders)
        log_email_notifications(db, tenders, user.email, "skipped", message="SMTP is not configured")
        return 0
    except Exception as e:
        log_email_notifications(db, tenders, user.email, "failed", message=subject, error=str(e))
        return 0
