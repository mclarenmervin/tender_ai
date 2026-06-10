import json
import re

from app.database.db_connection import SessionLocal
from app.database.models import ScoringCriterion

KEYWORD_PROFILES = {
    "IoT": {
        "terms": ["iot", "internet of things", "sensor", "telemetry", "remote monitoring", "smart device"],
        "weight": 15,
    },
    "SCADA": {
        "terms": ["scada", "plc", "rtu", "hmi", "industrial control", "control system"],
        "weight": 22,
    },
    "Smart Water": {
        "terms": ["smart irrigation", "water monitoring", "flow meter", "pump automation", "smart metering"],
        "weight": 20,
    },
    "IT Infrastructure": {
        "terms": ["network monitoring", "server", "cloud", "dashboard", "data center", "it infrastructure"],
        "weight": 15,
    },
    "Industrial Automation": {
        "terms": ["automation", "industry 4.0", "process control", "instrumentation", "vfd", "control panel"],
        "weight": 18,
    },
}

NEGATIVE_TERMS = [
    ("tablet", 25),
    ("injection", 25),
    ("syringe", 25),
    ("medicine", 25),
    ("hospital consumables", 25),
    ("furniture", 20),
    ("catering", 20),
    ("manpower", 20),
    ("vehicle hiring", 20),
    ("civil construction", 25),
    ("boundary wall", 25),
    ("stationery", 15),
]

DEFAULT_CRITERIA = [
    ("iot", 10, "positive", "IoT"),
    ("scada", 20, "positive", "SCADA"),
    ("automation", 15, "positive", "Industrial Automation"),
    ("smart irrigation", 20, "positive", "Smart Water"),
    ("industry 4.0", 15, "positive", "Industrial Automation"),
    ("sensor", 10, "positive", "IoT"),
    ("monitoring", 10, "positive", "IoT"),
    ("telemetry", 15, "positive", "IoT"),
    ("smart city", 20, "positive", "IT Infrastructure"),
    ("industrial control", 20, "positive", "SCADA"),
    ("it infrastructure", 15, "positive", "IT Infrastructure"),
    ("network monitoring", 15, "positive", "IT Infrastructure"),
] + [(term, weight, "negative", "Negative") for term, weight in NEGATIVE_TERMS]


def normalize_text(text):
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_term(term):
    return normalize_text(term)


def term_matches(term, text):
    normalized = normalize_term(term)
    if not normalized:
        return False
    return normalized in text


def default_criteria():
    return [
        {"keyword": keyword, "weight": weight, "match_type": match_type, "profile": profile}
        for keyword, weight, match_type, profile in DEFAULT_CRITERIA
    ]


def load_active_criteria(user_id=None):
    db = SessionLocal()
    try:
        query = db.query(ScoringCriterion).filter(ScoringCriterion.is_active.is_(True))
        if user_id is not None:
            query = query.filter(ScoringCriterion.user_id == user_id)
        rows = query.all()
        if not rows:
            return default_criteria()
        criteria = []
        for row in rows:
            criteria.append({
                "keyword": row.keyword,
                "weight": row.weight,
                "match_type": row.match_type or "positive",
                "profile": row.profile or "Custom",
            })
        existing = {item["keyword"].lower() for item in criteria}
        for term, weight in NEGATIVE_TERMS:
            if term not in existing:
                criteria.append({"keyword": term, "weight": weight, "match_type": "negative", "profile": "Negative"})
        return criteria
    finally:
        db.close()


def keyword_score(text, criteria=None, user_id=None):
    criteria = criteria or load_active_criteria(user_id)
    normalized_text = normalize_text(text)
    positive = []
    negative = []

    for item in criteria:
        if term_matches(item["keyword"], normalized_text):
            if item.get("match_type") == "negative":
                negative.append(item)
            else:
                positive.append(item)

    if not positive and not negative:
        return 0, []

    base = 60 if positive else 0
    score = base + sum(item["weight"] for item in positive) - sum(item["weight"] for item in negative)
    score = max(0, min(100, score))
    matched = [item["keyword"] for item in positive] + [f"-{item['keyword']}" for item in negative]
    return score, matched


def profile_names():
    return list(KEYWORD_PROFILES.keys())


def expand_keyword(keyword, profile=None, synonyms=None):
    terms = [keyword]
    if profile and profile in KEYWORD_PROFILES:
        terms.extend(KEYWORD_PROFILES[profile]["terms"])
    if synonyms:
        if isinstance(synonyms, str):
            try:
                decoded = json.loads(synonyms)
                synonyms = decoded if isinstance(decoded, list) else synonyms.split(",")
            except Exception:
                synonyms = synonyms.split(",")
        terms.extend(synonyms)
    return list(dict.fromkeys(term.strip().lower() for term in terms if term and term.strip()))


def rotate_terms(terms, offset=0, limit=8):
    terms = list(dict.fromkeys(term for term in terms if term))
    if not terms:
        return []
    offset = offset % len(terms)
    rotated = terms[offset:] + terms[:offset]
    return rotated[:limit]
