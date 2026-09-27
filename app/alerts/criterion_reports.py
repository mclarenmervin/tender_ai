"""Durable, user-scoped membership for cumulative criterion workbooks."""
import json
import re
from sqlalchemy.exc import IntegrityError
from app.database.models import CriterionTender, ScrapeRun, Tender


def criterion_tenders(db, user_id, profile_id, matched_ids=()):
    # Backfill bids saved before cumulative reports were introduced.
    runs = db.query(ScrapeRun).filter(ScrapeRun.user_id == user_id).all()
    run_ids = []
    for run in runs:
        try:
            if json.loads(run.criteria_json or '{}').get('profile_id') == profile_id:
                run_ids.append(run.id)
        except (ValueError, AttributeError):
            continue
    historical = db.query(Tender.id).filter(Tender.user_id == user_id, Tender.scrape_run_id.in_(run_ids)).all() if run_ids else []
    ids = set(matched_ids) | {row[0] for row in historical}
    valid = db.query(Tender.id).filter(Tender.user_id == user_id, Tender.id.in_(ids)).all() if ids else []
    existing = {row[0] for row in db.query(CriterionTender.tender_id).filter_by(user_id=user_id, profile_id=profile_id).all()}
    for (tender_id,) in valid:
        if tender_id not in existing:
            try:
                with db.begin_nested():
                    db.add(CriterionTender(user_id=user_id, profile_id=profile_id, tender_id=tender_id))
                    db.flush()
            except IntegrityError:
                pass  # A concurrent run already recorded this membership.
    db.commit()
    return db.query(Tender).join(CriterionTender, CriterionTender.tender_id == Tender.id).filter(
        CriterionTender.user_id == user_id, CriterionTender.profile_id == profile_id,
        Tender.user_id == user_id).order_by(Tender.created_at, Tender.id).all()


def criterion_attachment(db, user_id, details):
    from app.alerts.email_alerts import build_scrape_excel_attachment
    profile_id = (details or {}).get('profile_id')
    if not profile_id:
        return None
    tenders = criterion_tenders(db, user_id, profile_id)
    attachment = build_scrape_excel_attachment(db, tenders, allow_empty=True)
    if attachment:
        safe_id = re.sub(r'[^a-zA-Z0-9_-]', '_', profile_id)
        attachment['filename'] = f'criterion_{safe_id}_master.xlsx'
    return attachment
