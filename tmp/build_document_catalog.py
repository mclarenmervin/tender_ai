from pathlib import Path
import json
import re

ROOT = Path(r"C:\Users\Samsung\Downloads\tender_ai")
INDEX = ROOT / "tmp" / "extracted_text" / "index.json"
OUT = ROOT / "tmp" / "document_catalog.json"

records = json.loads(INDEX.read_text(encoding="utf-8"))
patterns = {
    "PAN": r"\bPAN\b|Permanent Account",
    "GST": r"\bGST(?:IN)?\b|Goods and Services Tax",
    "MSME_Udyam": r"\bMSME\b|\bUDYAM\b|Micro Small",
    "ISO": r"\bISO\s*(?:9001|13485)?",
    "OEM_authorization": r"\bOEM\b|authori[sz](?:ation|ed)|manufacturer",
    "turnover": r"turnover|annual financial|chartered accountant",
    "ITR": r"income tax return|\bITR\b|assessment year",
    "experience": r"experience|purchase order|work order|invoice|CRAC|completion certificate",
    "undertaking": r"undertaking|affidavit|stamp paper|non.?judicial",
    "establishment": r"shops? and establishment|gumasta|municipal|gram panchayat|nagarpalika",
    "service_support": r"service cent(?:er|re)|service support|toll.?free|escalation matrix",
    "ATC": r"\bATC\b|additional terms|compliance",
    "EMD": r"\bEMD\b|earnest money|demand draft|bid security|exemption",
    "medical_license": r"medical device|CDSCO|drug licen[cs]e",
    "product_specs": r"specification|technical compliance|model|catalogue|brochure",
}

catalog = []
for rec in records:
    if rec["relative"].startswith("BUYER/"):
        continue
    rel = rec["relative"]
    parts = rel.split("/")
    archive = parts[0]
    rest = parts[1:]
    if rest and rest[0] in {"Wheel Chair-68", "Wheel Chair-30"}:
        rest = rest[1:]
    bidder = rest[0] if rest else "UNKNOWN"
    text = ""
    if rec["text_file"]:
        text = Path(rec["text_file"]).read_text(encoding="utf-8", errors="replace")
    normalized = re.sub(r"\s+", " ", text)
    hits = {}
    for label, pattern in patterns.items():
        match = re.search(pattern, normalized, flags=re.I)
        if match:
            start = max(0, match.start() - 140)
            end = min(len(normalized), match.end() + 260)
            hits[label] = normalized[start:end]
    catalog.append({
        "archive": archive,
        "bidder": bidder,
        "relative": rel,
        "pages": rec["pages"],
        "text_chars": rec["text_chars"],
        "searchable": rec["text_chars"] > 100,
        "opening_text": normalized[:500],
        "hits": hits,
    })

OUT.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")

summary = {}
for doc in catalog:
    key = f'{doc["archive"]} :: {doc["bidder"]}'
    s = summary.setdefault(key, {"docs": 0, "searchable": 0, "categories": set()})
    s["docs"] += 1
    s["searchable"] += int(doc["searchable"])
    s["categories"].update(doc["hits"].keys())
for value in summary.values():
    value["categories"] = sorted(value["categories"])
print(json.dumps(summary, indent=2))
