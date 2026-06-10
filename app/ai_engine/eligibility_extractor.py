import re
from datetime import date


def clean_text(value):
    value = re.sub(r"\s+", " ", value or " ").strip()
    return value


def compact_lines(text):
    lines = []
    for line in (text or "").splitlines():
        cleaned = clean_text(line)
        if cleaned:
            lines.append(cleaned)
    if not lines:
        wrapped = re.split(r"(?<=[.;])\s+", clean_text(text))
        lines = [line for line in wrapped if line]
    return lines


def find_nearby(lines, keywords, max_items=3):
    matches = []
    for line in lines:
        lowered = line.lower()
        if any(keyword in lowered for keyword in keywords):
            matches.append(line[:500])
            if len(matches) >= max_items:
                break
    return "; ".join(dict.fromkeys(matches))


def find_amount_near(text, keywords):
    lines = compact_lines(text)
    for line in lines:
        lowered = line.lower()
        if any(keyword in lowered for keyword in keywords):
            amount = re.search(r"(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.\d+)?)", line, re.I)
            if amount:
                return f"{amount.group(0)} ({line[:240]})"
            percent = re.search(r"\b([0-9]+(?:\.\d+)?)\s*%", line)
            if percent:
                return f"{percent.group(0)} ({line[:240]})"
            return line[:300]
    return ""


def extract_certifications(text):
    patterns = [
        r"\bISO\s*[0-9: -]{3,20}",
        r"\bMSME\b",
        r"\bUdyam\b",
        r"\bOEM\b",
        r"\bBIS\b",
        r"\bCE\b",
        r"\bNSIC\b",
        r"\bStartup India\b",
    ]
    found = []
    for pattern in patterns:
        found.extend(match.group(0).strip() for match in re.finditer(pattern, text or "", re.I))
    return ", ".join(dict.fromkeys(found))


def extract_deadline(text, tender=None):
    lines = compact_lines(text)
    keywords = ["bid end date", "submission date", "last date", "due date", "closing date", "bid submission"]
    value = find_nearby(lines, keywords, max_items=2)
    if value:
        return value
    return str(tender.deadline) if tender and tender.deadline else ""


def risk_flags(data, tender=None):
    risks = []
    if data.get("emd"):
        risks.append("EMD/bid security found")
    if data.get("turnover_requirement"):
        risks.append("Turnover requirement found")
    if data.get("experience_requirement"):
        risks.append("Experience requirement found")
    if data.get("certifications_required"):
        risks.append("Certification requirement found")
    if tender and tender.deadline:
        days = (tender.deadline - date.today()).days
        if days < 0:
            risks.append("Deadline already expired")
        elif days <= 7:
            risks.append("Short deadline")
    if not data.get("documents_required"):
        risks.append("Document checklist not clearly found")
    return risks


def confidence_score(data):
    fields = [
        "emd",
        "turnover_requirement",
        "experience_requirement",
        "documents_required",
        "certifications_required",
        "submission_deadline",
        "payment_terms",
        "technical_specs",
    ]
    found = sum(1 for field in fields if data.get(field))
    return round(min(1, found / len(fields)), 2)


def extract_eligibility(text, tender=None):
    lines = compact_lines(text)
    data = {
        "emd": find_amount_near(text, ["emd", "earnest money", "bid security"]),
        "turnover_requirement": find_nearby(lines, ["turnover", "annual turnover", "financial capacity"], max_items=3),
        "experience_requirement": find_nearby(lines, ["experience", "similar work", "past performance", "work order"], max_items=4),
        "documents_required": find_nearby(lines, ["documents required", "required documents", "document required", "upload", "certificate", "annexure"], max_items=6),
        "certifications_required": extract_certifications(text),
        "submission_deadline": extract_deadline(text, tender),
        "payment_terms": find_nearby(lines, ["payment terms", "payment", "invoice", "milestone"], max_items=3),
        "technical_specs": find_nearby(lines, ["technical specification", "specification", "scope of work", "boq", "quantity"], max_items=5),
    }
    risks = risk_flags(data, tender)
    data["risk_flags"] = risks
    summary_parts = []
    for label, key in [
        ("EMD", "emd"),
        ("Turnover", "turnover_requirement"),
        ("Experience", "experience_requirement"),
        ("Documents", "documents_required"),
        ("Certifications", "certifications_required"),
    ]:
        if data.get(key):
            summary_parts.append(f"{label}: {data[key]}")
    if risks:
        summary_parts.append("Risks: " + ", ".join(risks))
    data["summary"] = "\n".join(summary_parts)[:4000] if summary_parts else "No clear eligibility fields found in available text."
    data["confidence"] = confidence_score(data)
    return data
