from datetime import date

import requests
from sqlalchemy.sql import func

from app.database.models import Tender, TenderTracking


SOURCE_STATUS_KEYWORDS = {
    "awarded": ["bid awarded", "contract awarded", "awarded"],
    "cancelled": ["cancelled", "canceled", "bid cancelled", "tender cancelled"],
    "technical_evaluation": ["technical evaluation", "technical bid"],
    "financial_evaluation": ["financial evaluation", "financial bid", "financial opened"],
}


def ensure_tracking_record(db, tender):
    tracking = db.query(TenderTracking).filter(TenderTracking.tender_id == tender.id).first()
    if tracking:
        return tracking

    tracking = TenderTracking(tender_id=tender.id)
    db.add(tracking)
    db.flush()
    return tracking


def source_is_available(url):
    if not url:
        return False, ""

    try:
        response = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=30,
        )
        if response.status_code >= 400:
            return False, f"source returned HTTP {response.status_code}"

        content_type = response.headers.get("content-type", "")
        sample = response.content[:5000].decode("latin1", errors="ignore")
        return True, f"{content_type} {sample}".lower()
    except Exception as e:
        return False, f"source check failed: {e}"


def infer_source_status(tender, source_text):
    text = f"{tender.status or ''} {source_text or ''}".lower()

    for status, keywords in SOURCE_STATUS_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return status

    if tender.deadline:
        if tender.deadline < date.today():
            return "closed"
        return "open"

    return "unknown"


def infer_submission_status(tender):
    status = (tender.status or "new").lower()
    if status == "applied":
        return "submitted"
    if status in {"reviewing", "notified"}:
        return "in_review"
    if status in {"rejected", "awarded", "cancelled"}:
        return status
    return "not_started"


def infer_evaluation_status(tender, source_status):
    if tender.status in {"awarded", "cancelled", "rejected"}:
        return tender.status

    if source_status == "closed":
        return "awaiting_evaluation"
    if source_status in {"technical_evaluation", "financial_evaluation", "awarded", "cancelled"}:
        return source_status
    return "not_started"


def update_tracking_for_tender(db, tender):
    tracking = ensure_tracking_record(db, tender)
    available, source_text = source_is_available(tender.url)
    source_status = infer_source_status(tender, source_text)

    tracking.source_available = available
    tracking.source_status = source_status
    tracking.submission_status = infer_submission_status(tender)
    tracking.applied = (tender.status == "applied")
    tracking.documents_ready = bool(tender.url and available)
    tracking.evaluation_status = infer_evaluation_status(tender, source_status)
    tracking.last_checked_at = func.now()

    if source_status == "closed":
        tracking.remarks = "Bid deadline has passed. Evaluation may be pending."
    elif not available:
        tracking.remarks = source_text[:500]
    elif source_status == "open":
        tracking.remarks = "Source document is reachable and bid is open."
    else:
        tracking.remarks = f"Detected source status: {source_status}"

    return tracking


def update_tender_statuses(db, user_id=None, limit=100):
    checked = 0
    available = 0
    closed = 0

    query = db.query(Tender)
    if user_id is not None:
        query = query.filter(Tender.user_id == user_id)
    tenders = query.order_by(Tender.updated_at.desc()).limit(limit).all()
    for tender in tenders:
        tracking = update_tracking_for_tender(db, tender)
        checked += 1
        if tracking.source_available:
            available += 1
        if tracking.source_status == "closed":
            closed += 1

    db.commit()
    return {"checked": checked, "source_available": available, "closed": closed}
