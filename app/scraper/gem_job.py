import os
import json
from datetime import datetime, timedelta

from sqlalchemy.sql import func

from app.alerts.telegram_alerts import notify_new_tenders
from app.alerts.email_alerts import email_notification_readiness, notify_new_tenders_email, notify_scrape_summary_email
from app.ai_engine.keyword_engine import expand_keyword, rotate_terms
from app.ai_engine.scorer import score_unscored_tenders
from app.database.db_connection import get_db
from app.database.models import AppSetting, CompanyProfile, KeywordPerformance, ScrapeKeyword, ScrapeRun, Tender, TenderTracking, User
from app.scraper.runner import run_gem_keyword_scraper

DEFAULT_BOOTSTRAP_TERMS = ["iot", "automation", "software", "hardware", "security"]


def run_gem_job(user_id=None, trigger="manual", profile=None):
    db = next(get_db())
    run = None
    try:
        user_id = user_id or current_job_user_id(db)
        mark_stale_runs(db, user_id)
        run = ScrapeRun(user_id=user_id, trigger=trigger, source="GeM", status="running")
        db.add(run)
        db.commit()
        is_gem_alert = str(trigger or "").startswith("gem_alert")
        profile=profile if isinstance(profile,dict) else None
        keyword_rows = [] if (is_gem_alert or profile) else db.query(ScrapeKeyword).filter(ScrapeKeyword.user_id == user_id, ScrapeKeyword.is_active.is_(True)).all()
        expanded_keywords = []
        for item in keyword_rows:
            expanded_keywords.extend(expand_keyword(item.keyword, item.profile, item.synonyms))
        if is_gem_alert:
            expanded_keywords.extend(setting_json_list(db, user_id, "gem_alert_categories"))
            expanded_keywords.extend(setting_json_list(db, user_id, "gem_alert_companies"))
        elif profile:
            expanded_keywords.extend(profile.get("keywords") or [])
            states=[value for value in (profile.get("states") or []) if value]
            cities=[value for value in (profile.get("cities") or []) if value]
            city=cities[0] if cities else ""
            authorities=[value for value in (profile.get("authorities") or []) if value]
        else:
            expanded_keywords.extend(company_profile_terms(db, user_id))
            expanded_keywords.extend(gem_alert_terms(db, user_id))
        if is_gem_alert:
            states = setting_json_list(db, user_id, "gem_alert_states")
            cities = setting_json_list(db, user_id, "gem_alert_cities")
            city = cities[0] if cities else ""
            authorities = setting_json_list(db, user_id, "gem_alert_departments")
        elif not profile:
            states = setting_json_list(db, user_id, "scrape_states")
            legacy_state = setting_value(db, user_id, "scrape_state", "")
            if legacy_state and legacy_state not in states:
                states.append(legacy_state)
            city = setting_value(db, user_id, "scrape_city", "")
            cities = [city] if city else []
            authorities = setting_json_list(db, user_id, "scrape_authorities")
        if is_gem_alert:
            # Search location terms as well as applying strict post-parse
            # location checks, so location-only alerts are not limited to the
            # first page of general GeM listings.
            expanded_keywords.extend(states)
            expanded_keywords.extend(cities)
        used_default_keywords = False
        used_authority_terms = False
        if is_gem_alert and not (expanded_keywords or states or cities or authorities):
            raise RuntimeError("Configure at least one GeM alert category, department, state, or city before running the alert check.")
        if not expanded_keywords and authorities:
            expanded_keywords.extend(authorities)
            used_authority_terms = True
        elif not expanded_keywords and not (states or city) and not is_gem_alert:
            expanded_keywords.extend(DEFAULT_BOOTSTRAP_TERMS)
            used_default_keywords = True
        rotation_offset = int(setting_value(db, user_id, "keyword_rotation_offset", "0") or "0")
        keywords = rotate_terms(expanded_keywords, rotation_offset, limit=10)
        if expanded_keywords:
            next_offset = (rotation_offset + len(keywords)) % len(list(dict.fromkeys(expanded_keywords)))
            upsert_setting(db, user_id, "keyword_rotation_offset", str(next_offset))
        only_high_priority = bool(profile.get("only_high_priority")) if profile else setting_enabled(db, user_id, "only_high_priority_scrape")
        has_filters = bool(states or city or authorities)
        max_bids = 300 if used_authority_terms else (120 if has_filters else (45 if only_high_priority else 35))
        inserted, source_logs = run_gem_keyword_scraper(
            db,
            keywords,
            return_details=True,
            max_bids=max_bids,
            user_id=user_id,
            states=states,
            city=city,
            cities=cities,
            authorities=authorities,
            scrape_run_id=run.id if run else None,
        )
        inserted_ids = [
            tender_id
            for log in source_logs
            for tender_id in log.get("inserted_ids", [])
        ]
        scored = score_unscored_tenders(db, inserted_ids, user_id=user_id)
        update_keyword_performance_scores(db, user_id, run.id if run else None, inserted_ids)
        removed_low_priority = remove_low_priority_inserts(db, user_id, inserted_ids)
        notified = notify_new_tenders(db, inserted_ids, timeout=5, user_id=user_id)
        email_status = email_notification_readiness(db, user_id, inserted_ids)
        scrape_details = {
            "trigger": trigger,
            "profile_name":profile.get("name") if profile else None,
            "keywords": keywords,
            "inserted": inserted,
            "scored": scored,
            "removed_low_priority": removed_low_priority,
            "source_logs": source_logs,
        }
        run.criteria_json=json.dumps({
            "profile_id":profile.get("id") if profile else None,
            "profile_name":profile.get("name") if profile else None,
            "keywords":keywords,
            "departments":authorities,
            "states":states,
            "cities":cities,
            "only_high_priority":only_high_priority,
            "max_bids":max_bids,
        })
        emailed = notify_new_tenders_email(db, inserted_ids, user_id, scrape_details=scrape_details)
        if str(trigger).startswith("auto") and not inserted_ids:
            emailed = notify_scrape_summary_email(
                db,
                user_id,
                scrape_details,
                subject="Tender AI auto scrape report: no new tenders found",
            )
        if inserted_ids and emailed == 0:
            source_logs.append({
                "source": "Email",
                "status": "skipped" if not email_status.get("ok") else "failed",
                "message": email_status.get("reason") or "Email notification was not sent.",
                "inserted_ids": [],
            })
        failed_sources = [log["source"] for log in source_logs if log["status"] == "failed"]
        status = "failed" if failed_sources else "success"
        message = "; ".join(log.get("message", "") for log in source_logs if log.get("message"))
        if used_default_keywords:
            default_message = "No active keywords/profile terms were configured, so default starter keywords were used: " + ", ".join(keywords)
            message = (message + "; " if message else "") + default_message
            if source_logs:
                source_logs[0]["message"] = source_logs[0].get("message", "") + "; " + default_message
            else:
                source_logs.append({"source": "GeM", "status": "success", "message": default_message, "inserted_ids": []})
        elif used_authority_terms:
            authority_message = "No active product keywords were configured. Each selected authority was searched separately and exact Department-segment filtering was applied for: " + ", ".join(authorities)
            message = (message + "; " if message else "") + authority_message
            if source_logs:
                source_logs[0]["message"] = source_logs[0].get("message", "") + "; " + authority_message
        if inserted == 0 and not failed_sources and not source_logs:
            message = "Scrape completed but returned no source logs. Add active keywords or complete the company profile, then retry."
            source_logs.append({"source": "GeM", "status": "success", "message": message, "inserted_ids": []})
        run.status = status
        run.inserted_count = inserted
        run.scored_count = scored
        run.telegram_count = notified
        run.email_count = emailed
        run.removed_low_priority_count = removed_low_priority
        run.message = message
        run.finished_at = func.now()
        db.commit()
        return {
            "inserted": inserted,
            "scored": scored,
            "alerts_sent": notified,
            "emails_sent": emailed,
            "email_status": email_status,
            "removed_low_priority": removed_low_priority,
            "failed_sources": failed_sources,
            "source_logs": source_logs,
            "keyword_count": len(keywords),
            "keywords": keywords,
            "used_default_keywords": used_default_keywords,
            "used_authority_terms": used_authority_terms,
        }
    except Exception as e:
        if run:
            run.status = "failed"
            run.message = str(e) or repr(e)
            run.finished_at = func.now()
            db.commit()
        raise
    finally:
        db.close()


def mark_stale_runs(db, user_id, minutes=20):
    cutoff = datetime.now().astimezone() - timedelta(minutes=minutes)
    stale = db.query(ScrapeRun).filter(
        ScrapeRun.user_id == user_id,
        ScrapeRun.status == "running",
        ScrapeRun.started_at < cutoff,
    ).all()
    for item in stale:
        item.status = "failed"
        item.message = f"Marked failed because it was still running after {minutes} minutes."
        item.finished_at = func.now()
    if stale:
        db.commit()

def current_job_user_id(db):
    env_user_id = os.getenv("MANUAL_SCRAPE_USER_ID")
    if env_user_id:
        return int(env_user_id)
    user = db.query(User).order_by(User.id).first()
    if not user:
        raise RuntimeError("Create a user before running scraper")
    return user.id


def setting_enabled(db, user_id, key):
    return setting_value(db, user_id, key) == "true"


def setting_value(db, user_id, key, default=None):
    item = db.query(AppSetting).filter(AppSetting.user_id == user_id, AppSetting.key == key).first()
    return item.value.strip() if item and item.value is not None else default


def upsert_setting(db, user_id, key, value):
    item = db.query(AppSetting).filter(AppSetting.user_id == user_id, AppSetting.key == key).first()
    if item:
        item.value = value
    else:
        db.add(AppSetting(user_id=user_id, key=key, value=value))
    db.commit()


def setting_json_list(db, user_id, key):
    raw = setting_value(db, user_id, key, "[]")
    try:
        values = json.loads(raw)
    except Exception:
        values = []
    if not isinstance(values, list):
        return []
    return [str(value).strip() for value in values if str(value).strip()]


def split_profile_terms(value):
    terms = []
    for chunk in (value or "").replace("|", ",").replace(";", ",").split(","):
        for line in chunk.splitlines():
            cleaned = line.strip().lower()
            if cleaned:
                terms.append(cleaned)
    return terms


def company_profile_terms(db, user_id):
    profile = db.query(CompanyProfile).filter(
        CompanyProfile.user_id == user_id,
        CompanyProfile.is_active.is_(True),
    ).first()
    if not profile:
        return []
    terms = []
    for value in [profile.products, profile.services, profile.industries, profile.experience_keywords]:
        terms.extend(split_profile_terms(value))
    return list(dict.fromkeys(terms))[:20]


def gem_alert_terms(db, user_id):
    terms = []
    terms.extend(setting_json_list(db, user_id, "gem_alert_categories"))
    terms.extend(setting_json_list(db, user_id, "gem_alert_companies"))
    return list(dict.fromkeys(term.strip().lower() for term in terms if term.strip()))[:30]


def high_priority_score():
    return float(os.getenv("HIGH_PRIORITY_SCORE", "70"))


def update_keyword_performance_scores(db, user_id, scrape_run_id, inserted_ids):
    if not scrape_run_id or not inserted_ids:
        return
    rows = db.query(KeywordPerformance).filter(
        KeywordPerformance.user_id == user_id,
        KeywordPerformance.scrape_run_id == scrape_run_id,
    ).all()
    tenders = db.query(Tender).filter(Tender.user_id == user_id, Tender.id.in_(inserted_ids)).all()
    threshold = high_priority_score()
    for row in rows:
        if not row.inserted_count:
            row.high_priority_count = 0
            row.average_score = 0
            continue
        if row.keyword == "general":
            matched = tenders
        else:
            marker = f"/ {row.keyword}".lower()
            matched = [tender for tender in tenders if marker in (tender.category or "").lower()]
        if not matched:
            continue
        row.high_priority_count = sum(1 for tender in matched if tender.relevance_score is not None and tender.relevance_score >= threshold)
        row.average_score = sum(tender.relevance_score or 0 for tender in matched) / len(matched)
    db.commit()


def remove_low_priority_inserts(db, user_id, tender_ids):
    if not tender_ids or not setting_enabled(db, user_id, "only_high_priority_scrape"):
        return 0

    threshold = high_priority_score()
    low_priority = (
        db.query(Tender)
        .filter(Tender.user_id == user_id, Tender.id.in_(tender_ids))
        .filter((Tender.relevance_score < threshold) | (Tender.relevance_score.is_(None)))
        .all()
    )
    low_priority_ids = [tender.id for tender in low_priority]

    if not low_priority_ids:
        return 0

    db.query(TenderTracking).filter(TenderTracking.tender_id.in_(low_priority_ids)).delete(synchronize_session=False)
    removed = db.query(Tender).filter(Tender.user_id == user_id, Tender.id.in_(low_priority_ids)).delete(synchronize_session=False)
    db.commit()
    return removed


if __name__ == "__main__":
    try:
        env_profile=json.loads(os.getenv("SCRAPE_PROFILE_JSON") or "null")
    except Exception:
        env_profile=None
    print(json.dumps(run_gem_job(trigger=os.getenv("MANUAL_SCRAPE_TRIGGER", "manual"),profile=env_profile), default=str), flush=True)
    os._exit(0)
