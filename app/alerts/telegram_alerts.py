import os
from datetime import date, timedelta
from html import escape

import requests
from dotenv import load_dotenv

from app.database.models import NotificationLog, NotificationPreference, TelegramSubscriber, Tender

load_dotenv()

BOT = os.getenv("TELEGRAM_BOT_TOKEN")
HIGH = float(os.getenv("HIGH_PRIORITY_SCORE", "70"))
DAYS = int(os.getenv("DEADLINE_ALERT_DAYS", "10"))


def send_telegram_message(message, chat_id, timeout=5):
    if not BOT or not chat_id:
        return False

    response = requests.post(
        f"https://api.telegram.org/bot{BOT}/sendMessage",
        json={
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        },
        timeout=timeout,
    )

    response.raise_for_status()
    return True


def sync_telegram_subscribers(db, timeout=5):
    if not BOT:
        return 0

    try:
        response = requests.get(
            f"https://api.telegram.org/bot{BOT}/getUpdates",
            timeout=timeout,
        )
        response.raise_for_status()
        updates = response.json().get("result", [])
    except Exception:
        return 0

    synced = 0
    for update in updates:
        message = update.get("message") or update.get("my_chat_member", {})
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        if not chat_id:
            continue

        chat_id = str(chat_id)
        subscriber = db.query(TelegramSubscriber).filter(TelegramSubscriber.chat_id == chat_id).first()
        if not subscriber:
            subscriber = TelegramSubscriber(chat_id=chat_id)
            db.add(subscriber)
        subscriber.username = chat.get("username")
        subscriber.first_name = chat.get("first_name") or chat.get("title")
        subscriber.chat_type = chat.get("type")
        subscriber.is_active = True
        synced += 1

    if synced:
        db.commit()
    return synced


def active_chat_ids(db):
    sync_telegram_subscribers(db)
    return [
        subscriber.chat_id
        for subscriber in db.query(TelegramSubscriber).filter(TelegramSubscriber.is_active.is_(True)).all()
    ]


def log_notification(db, user_id, tender_id, channel, recipient, status, message=None, error=None):
    db.add(NotificationLog(
        user_id=user_id,
        tender_id=tender_id,
        channel=channel,
        recipient=str(recipient) if recipient is not None else None,
        status=status,
        message=message,
        error=error,
    ))
    db.commit()


def broadcast_telegram_message(db, message, timeout=5, user_id=None, tender_id=None):
    sent = 0
    for chat_id in active_chat_ids(db):
        try:
            if send_telegram_message(message, chat_id, timeout=timeout):
                log_notification(db, user_id, tender_id, "telegram", chat_id, "sent", message=message[:1000])
                sent += 1
        except Exception:
            log_notification(db, user_id, tender_id, "telegram", chat_id, "failed", message=message[:1000], error="send failed")
            subscriber = db.query(TelegramSubscriber).filter(TelegramSubscriber.chat_id == str(chat_id)).first()
            if subscriber:
                subscriber.is_active = False
                db.commit()
    return sent


def tender_line(tender):
    score = tender.relevance_score if tender.relevance_score is not None else ""
    return f"""
<b>{escape(tender.title or '')}</b>
ID: {escape(tender.tender_id or '')}
Department: {escape(tender.department or '')}
State: {escape(tender.state or '')}
Value: Rs. {tender.estimated_value or 0}
Deadline: {escape(str(tender.deadline or ''))}
Score: {escape(str(score))}
Link: {escape(tender.url or '')}
""".strip()


def notify_new_tenders(db, tender_ids, timeout=5, user_id=None):
    if not tender_ids:
        return 0
    if user_id is not None:
        pref=db.query(NotificationPreference).filter(NotificationPreference.user_id==user_id,NotificationPreference.channel=="telegram").first()
        if pref and not pref.enabled:
            return 0

    query = db.query(Tender).filter(Tender.id.in_(tender_ids))
    if user_id is not None:
        query = query.filter(Tender.user_id == user_id)

    tenders = query.order_by(Tender.created_at.desc()).all()
    sent = 0

    for i in range(0, len(tenders), 5):
        chunk = tenders[i:i + 5]
        message = "<b>New tenders added to Tender AI</b>\n\n" + "\n\n---\n\n".join(
            tender_line(tender) for tender in chunk
        )
        first_tender_id = chunk[0].id if chunk else None
        if broadcast_telegram_message(db, message, timeout=timeout, user_id=user_id, tender_id=first_tender_id):
            sent += len(chunk)

    return sent


def notify_high_priority_tenders(db, tender_ids=None, timeout=5, user_id=None):
    sent = 0
    if user_id is not None:
        pref=db.query(NotificationPreference).filter(NotificationPreference.user_id==user_id,NotificationPreference.channel=="telegram").first()
        if pref and not pref.enabled:
            return 0
    soon = date.today() + timedelta(days=DAYS)

    query = (
        db.query(Tender)
        .filter(
            Tender.relevance_score >= HIGH,
            Tender.deadline <= soon,
            Tender.status == "new",
        )
    )
    if user_id is not None:
        query = query.filter(Tender.user_id == user_id)
    if tender_ids is not None:
        if not tender_ids:
            return 0
        query = query.filter(Tender.id.in_(tender_ids))

    tenders = query.all()

    for tender in tenders:
        message = f"""
<b>High Priority Tender</b>

{tender_line(tender)}
Reason: {escape(tender.ai_reason or '')}
""".strip()

        try:
            if broadcast_telegram_message(db, message, timeout=timeout, user_id=user_id, tender_id=tender.id):
                tender.status = "notified"
                db.commit()
                sent += 1
        except Exception:
            db.rollback()

    return sent
