import time
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from app.database.db_connection import get_db
from app.database.models import AppSetting, User
from app.alerts.daily_digest import send_daily_digest
from app.scraper.gem_job import run_gem_job
from app.tracking.status_tracker import update_tender_statuses


def get_setting(db, user_id, key, default=None):
    item = db.query(AppSetting).filter(AppSetting.user_id == user_id, AppSetting.key == key).first()
    return item.value if item else default


def set_setting(db, user_id, key, value):
    item = db.query(AppSetting).filter(AppSetting.user_id == user_id, AppSetting.key == key).first()
    if item:
        item.value = value
    else:
        item = AppSetting(user_id=user_id, key=key, value=value)
        db.add(item)
    db.commit()
    return item


def parse_last_run(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def parse_daily_time(value):
    if not value:
        return None
    try:
        hour, minute = value.split(":", 1)
        return int(hour), int(minute)
    except Exception:
        return None


def auto_scrape_due(db, user, now=None):
    if get_setting(db, user.id, "auto_scrape_enabled", "false") != "true":
        return False

    now = now or datetime.now()
    last_run = parse_last_run(get_setting(db, user.id, "auto_scrape_last_run", ""))
    mode = get_setting(db, user.id, "auto_scrape_mode", "interval")

    if mode == "daily":
        daily_time = parse_daily_time(get_setting(db, user.id, "auto_scrape_time", "09:00"))
        if not daily_time:
            return False
        hour, minute = daily_time
        scheduled = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if now < scheduled:
            return False
        return not last_run or last_run.date() < now.date()

    try:
        hours = max(1, min(168, int(get_setting(db, user.id, "auto_scrape_interval_hours", "6"))))
    except ValueError:
        hours = 6

    return not last_run or now - last_run >= timedelta(hours=hours)


def daily_digest_due(db, user, now=None):
    if get_setting(db, user.id, "daily_digest_enabled", "false") != "true":
        return False
    now = now or datetime.now()
    daily_time = parse_daily_time(get_setting(db, user.id, "daily_digest_time", "09:00"))
    if not daily_time:
        return False
    hour, minute = daily_time
    scheduled = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if now < scheduled:
        return False
    last_run = parse_last_run(get_setting(db, user.id, "daily_digest_last_run", ""))
    return not last_run or last_run.date() < now.date()


def gem_alert_due_slots(db, user, now=None):
    if get_setting(db, user.id, "gem_alert_enabled", "false") != "true":
        return []
    categories = json_list_setting(db, user.id, "gem_alert_categories")
    companies = json_list_setting(db, user.id, "gem_alert_companies")
    if not categories and not companies:
        return []
    now = now or datetime.now()
    due = []
    for slot in ["06:00", "18:00"]:
        hour, minute = parse_daily_time(slot)
        scheduled = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if now < scheduled:
            continue
        key = f"gem_alert_last_run_{slot.replace(':', '')}"
        last_run = parse_last_run(get_setting(db, user.id, key, ""))
        if not last_run or last_run.date() < now.date():
            due.append((slot, key))
    return due


def json_list_setting(db, user_id, key):
    import json
    raw = get_setting(db, user_id, key, "[]")
    try:
        values = json.loads(raw or "[]")
    except Exception:
        values = []
    if not isinstance(values, list):
        return []
    return [str(value).strip() for value in values if str(value).strip()]


def scraping_job():
    db = next(get_db())
    try:
        users = db.query(User).filter(User.is_active.is_(True)).all()
        for user in users:
            if not auto_scrape_due(db, user):
                continue
            print("[AutoScrape] starting", user.email)
            result = run_gem_job(user.id, trigger="auto")
            set_setting(db, user.id, "auto_scrape_last_run", datetime.now().isoformat(timespec="seconds"))
            print("[AutoScrape] finished", user.email, result)
    finally:
        db.close()


def gem_alert_job():
    db = next(get_db())
    try:
        users = db.query(User).filter(User.is_active.is_(True)).all()
        for user in users:
            for slot, key in gem_alert_due_slots(db, user):
                print("[GeMAlert] starting", user.email, slot)
                result = run_gem_job(user.id, trigger=f"gem_alert_{slot.replace(':', '')}")
                set_setting(db, user.id, key, datetime.now().isoformat(timespec="seconds"))
                print("[GeMAlert] finished", user.email, slot, result)
    finally:
        db.close()


def tracking_job():
    db = next(get_db())
    try:
        for user in db.query(User).filter(User.is_active.is_(True)).all():
            print("[Tracking]", user.email, update_tender_statuses(db, user.id))
    finally:
        db.close()


def daily_digest_job():
    db = next(get_db())
    try:
        users = db.query(User).filter(User.is_active.is_(True)).all()
        for user in users:
            if not daily_digest_due(db, user):
                continue
            try:
                min_score = int(get_setting(db, user.id, "daily_digest_min_score", "70") or "70")
            except ValueError:
                min_score = 70
            print("[DailyDigest] sending", user.email)
            result = send_daily_digest(db, user.id, min_score=max(0, min(100, min_score)))
            set_setting(db, user.id, "daily_digest_last_run", datetime.now().isoformat(timespec="seconds"))
            print("[DailyDigest] finished", user.email, result)
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(scraping_job, "interval", minutes=1, id="auto_scrape_tick", max_instances=1)
    scheduler.add_job(gem_alert_job, "interval", minutes=1, id="gem_alert_tick", max_instances=1)
    scheduler.add_job(daily_digest_job, "interval", minutes=1, id="daily_digest_tick", max_instances=1)
    scheduler.add_job(tracking_job, "interval", days=1, id="tracking_tick", max_instances=1)
    scheduler.start()
    print("Scheduler running. Auto scrape settings are checked every minute.")
    try:
        while True:
            time.sleep(5)
    except KeyboardInterrupt:
        scheduler.shutdown()
