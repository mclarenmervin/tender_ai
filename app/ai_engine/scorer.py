import os
import json
import re
from dotenv import load_dotenv
from openai import OpenAI

from app.database.db_connection import SessionLocal
from app.database.models import CompanyProfile, Tender
from app.ai_engine.keyword_engine import keyword_score

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def parse_ai_json(content):
    content = (content or "").strip()
    if not content:
        return None

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
    return None


def keyword_reason(matched):
    return "Keyword score used. Matched: " + (", ".join(matched) or "none")


def keyword_result(fallback, matched, note=None):
    reason = keyword_reason(matched)
    if note:
        reason += f". {note}"
    return {
        "score": fallback,
        "apply": fallback >= 70,
        "reason": reason,
    }


def normalize_score(score, fallback):
    try:
        value = float(score)
    except (TypeError, ValueError):
        value = float(fallback)

    if 0 < value <= 10:
        value *= 10

    return max(0, min(100, value))


def split_terms(value):
    terms = re.split(r"[\n,;|]+", value or "")
    return [term.strip().lower() for term in terms if term and term.strip()]


def term_in_text(term, text):
    normalized = re.sub(r"[^a-z0-9]+", " ", (term or "").lower()).strip()
    return bool(normalized and normalized in text)


def load_company_profile(user_id):
    if not user_id:
        return None
    db = SessionLocal()
    try:
        return db.query(CompanyProfile).filter(
            CompanyProfile.user_id == user_id,
            CompanyProfile.is_active.is_(True),
        ).first()
    finally:
        db.close()


def company_profile_score(tender: Tender, text):
    profile = load_company_profile(tender.user_id)
    if not profile:
        return 0, []

    normalized_text = re.sub(r"[^a-z0-9]+", " ", (text or "").lower())
    department_text = re.sub(r"[^a-z0-9]+", " ", (tender.department or "").lower())
    state_text = (tender.state or "").strip().lower()
    positive_matches = []
    negative_matches = []
    score = 0

    groups = [
        ("product", split_terms(profile.products), 18),
        ("service", split_terms(profile.services), 16),
        ("industry", split_terms(profile.industries), 12),
        ("certification", split_terms(profile.certifications), 8),
        ("experience", split_terms(profile.experience_keywords), 10),
    ]
    for label, terms, weight in groups:
        for term in terms:
            if term_in_text(term, normalized_text):
                positive_matches.append(f"{label}: {term}")
                score += weight

    for term in split_terms(profile.target_departments):
        if term_in_text(term, department_text) or term_in_text(term, normalized_text):
            positive_matches.append(f"department: {term}")
            score += 12

    target_states = split_terms(profile.target_states)
    if target_states and state_text:
        for term in target_states:
            if term == state_text or term_in_text(term, state_text):
                positive_matches.append(f"state: {term}")
                score += 10

    for term in split_terms(profile.negative_keywords):
        if term_in_text(term, normalized_text):
            negative_matches.append(f"negative: {term}")
            score -= 22

    value = tender.estimated_value or 0
    if profile.min_tender_value and value and value < profile.min_tender_value:
        negative_matches.append("below minimum tender value")
        score -= 18
    if profile.max_tender_value and value and value > profile.max_tender_value:
        negative_matches.append("above maximum tender value")
        score -= 12
    if value and (
        (not profile.min_tender_value or value >= profile.min_tender_value)
        and (not profile.max_tender_value or value <= profile.max_tender_value)
    ):
        positive_matches.append("value range")
        score += 8

    if not positive_matches and not negative_matches:
        return 0, []

    base = 50 if positive_matches else 0
    final = max(0, min(100, base + score))
    return final, positive_matches + negative_matches


def ai_score_tender(tender: Tender):
    text = f"""
Title: {tender.title or ''}

Department: {tender.department or ''}

Description: {tender.description or ''}

State: {tender.state or ''}
""".strip()

    fallback, matched = keyword_score(text, user_id=tender.user_id)
    profile_score, profile_matches = company_profile_score(tender, text)
    deterministic_score = max(fallback, profile_score)
    combined_matches = list(dict.fromkeys(matched + profile_matches))
    note = None
    if profile_matches:
        note = "Company profile matched: " + ", ".join(profile_matches[:8])
    deterministic = keyword_result(deterministic_score, combined_matches, note=note)

    if os.getenv("USE_OPENAI_SCORING", "false").lower() != "true":
        return deterministic

    if not client:
        return deterministic

    prompt = (
        "Score this tender for IoT, SCADA, smart irrigation, industrial automation, "
        "IT infrastructure and smart city business. "
        "Use a 0 to 100 score where 70+ means high priority and worth applying. "
        "Return only JSON with score, apply, reason. Tender:\n\n" + text
    )

    try:
        r = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )

        content = r.choices[0].message.content.strip()
        d = parse_ai_json(content)
        if not d:
            return keyword_result(fallback, matched)

        ai_reason = d.get("reason")
        return {
            "score": deterministic_score,
            "apply": deterministic_score >= 70,
            "reason": ai_reason or deterministic["reason"],
        }

    except Exception:
        return deterministic


def score_unscored_tenders(db, tender_ids=None, user_id=None):
    count = 0

    query = db.query(Tender).filter(Tender.relevance_score.is_(None))
    if user_id is not None:
        query = query.filter(Tender.user_id == user_id)
    if tender_ids is not None:
        if not tender_ids:
            return 0
        query = query.filter(Tender.id.in_(tender_ids))

    for t in query.all():
        r = ai_score_tender(t)

        t.relevance_score = r["score"]
        t.ai_recommendation = r["apply"]
        t.ai_reason = r["reason"]

        db.commit()
        count += 1

    return count


def rescore_all_tenders(db, user_id=None):
    count = 0

    query = db.query(Tender)
    if user_id is not None:
        query = query.filter(Tender.user_id == user_id)

    for t in query.all():
        r = ai_score_tender(t)

        t.relevance_score = r["score"]
        t.ai_recommendation = r["apply"]
        t.ai_reason = r["reason"]

        db.commit()
        count += 1

    return count
