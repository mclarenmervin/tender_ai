from datetime import date, datetime, timedelta
from html import escape

from app.alerts.email_alerts import send_email
from app.alerts.telegram_alerts import broadcast_telegram_message, tender_line
from app.database.models import NotificationLog, NotificationPreference, Tender, User


def channel_enabled(db, user_id, channel):
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id,
        NotificationPreference.channel == channel,
    ).first()
    return not pref or pref.enabled


def digest_tenders(db, user_id, min_score=70, days=1, limit=12):
    since = datetime.now() - timedelta(days=days)
    soon = date.today() + timedelta(days=10)
    query = db.query(Tender).filter(Tender.user_id == user_id)

    recent = (
        query.filter(Tender.created_at >= since)
        .order_by(Tender.created_at.desc())
        .limit(limit)
        .all()
    )
    high_priority = (
        query.filter(Tender.relevance_score >= min_score)
        .order_by(Tender.relevance_score.desc().nullslast(), Tender.created_at.desc())
        .limit(limit)
        .all()
    )
    upcoming = (
        query.filter(Tender.deadline >= date.today(), Tender.deadline <= soon)
        .order_by(Tender.deadline.asc(), Tender.relevance_score.desc().nullslast())
        .limit(limit)
        .all()
    )
    return recent, high_priority, upcoming


def unique_tenders(*groups):
    seen = set()
    items = []
    for group in groups:
        for tender in group:
            if tender.id in seen:
                continue
            seen.add(tender.id)
            items.append(tender)
    return items


def html_rows(tenders):
    if not tenders:
        return '<tr><td style="padding:10px;color:#64748b;">No tenders in this section.</td></tr>'
    rows = []
    for tender in tenders:
        rows.append(f"""
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
""".strip())
    return "\n".join(rows)


def text_section(title, tenders):
    if not tenders:
        return f"{title}\nNo tenders in this section."
    lines = [title]
    for tender in tenders:
        lines.append(
            f"- {tender.title or ''} | Score: {tender.relevance_score if tender.relevance_score is not None else ''} | "
            f"Deadline: {tender.deadline or ''} | {tender.url or ''}"
        )
    return "\n".join(lines)


def build_digest(user, recent, high_priority, upcoming, min_score):
    subject = f"Tender AI Daily Digest - {date.today()}"
    html_body = f"""
<div style="font-family:Arial,sans-serif;color:#111827;">
  <h2>Tender AI Daily Digest</h2>
  <p>Hi {escape(user.name or user.email)}, here is today's tender summary.</p>
  <p><strong>New:</strong> {len(recent)} &nbsp; <strong>High priority {min_score}+:</strong> {len(high_priority)} &nbsp; <strong>Upcoming:</strong> {len(upcoming)}</p>
  <h3>New tenders from the last 24 hours</h3>
  <table style="border-collapse:collapse;width:100%;">{html_rows(recent)}</table>
  <h3>High priority tenders</h3>
  <table style="border-collapse:collapse;width:100%;">{html_rows(high_priority)}</table>
  <h3>Upcoming deadlines</h3>
  <table style="border-collapse:collapse;width:100%;">{html_rows(upcoming)}</table>
</div>
""".strip()
    text_body = "\n\n".join([
        f"Tender AI Daily Digest - {date.today()}",
        text_section("New tenders from the last 24 hours", recent),
        text_section(f"High priority tenders ({min_score}+)", high_priority),
        text_section("Upcoming deadlines", upcoming),
    ])
    telegram_body = "\n\n".join([
        f"<b>Tender AI Daily Digest</b>\nDate: {date.today()}\nNew: {len(recent)} | High: {len(high_priority)} | Upcoming: {len(upcoming)}",
        "<b>High priority</b>\n" + ("\n\n---\n\n".join(tender_line(tender) for tender in high_priority[:5]) if high_priority else "No high priority tenders."),
        "<b>Upcoming deadlines</b>\n" + ("\n\n---\n\n".join(tender_line(tender) for tender in upcoming[:5]) if upcoming else "No upcoming deadlines."),
    ])
    return subject, html_body, text_body, telegram_body


def log_digest(db, user_id, channel, recipient, status, message=None, error=None):
    db.add(NotificationLog(
        user_id=user_id,
        tender_id=None,
        channel=channel,
        recipient=recipient,
        status=status,
        message=message,
        error=error,
    ))
    db.commit()


def send_daily_digest(db, user_id, min_score=70, timeout=5):
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user:
        return {"email_sent": 0, "telegram_sent": 0, "total_tenders": 0}

    recent, high_priority, upcoming = digest_tenders(db, user_id, min_score=min_score)
    all_tenders = unique_tenders(recent, high_priority, upcoming)
    subject, html_body, text_body, telegram_body = build_digest(user, recent, high_priority, upcoming, min_score)

    email_sent = 0
    telegram_sent = 0

    if channel_enabled(db, user_id, "email"):
        try:
            if send_email(user.email, subject, html_body, text_body):
                log_digest(db, user_id, "email_digest", user.email, "sent", message=subject)
                email_sent = 1
            else:
                log_digest(db, user_id, "email_digest", user.email, "skipped", message="SMTP is not configured")
        except Exception as e:
            log_digest(db, user_id, "email_digest", user.email, "failed", message=subject, error=str(e))

    if channel_enabled(db, user_id, "telegram"):
        telegram_sent = broadcast_telegram_message(db, telegram_body, timeout=timeout, user_id=user_id, tender_id=all_tenders[0].id if all_tenders else None)

    return {
        "email_sent": email_sent,
        "telegram_sent": telegram_sent,
        "total_tenders": len(all_tenders),
        "recent": len(recent),
        "high_priority": len(high_priority),
        "upcoming": len(upcoming),
    }
