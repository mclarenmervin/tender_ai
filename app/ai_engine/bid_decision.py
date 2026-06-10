import json
from datetime import date


def load_risks(eligibility):
    if not eligibility or not eligibility.risk_flags:
        return []
    try:
        value = json.loads(eligibility.risk_flags)
        return value if isinstance(value, list) else [str(value)]
    except Exception:
        return [eligibility.risk_flags]


def bid_decision_for_tender(tender, eligibility=None):
    score = float(tender.relevance_score or 0)
    reasons = []
    blockers = []
    next_steps = []
    decision_score = score

    if score >= 75:
        reasons.append("Strong AI/profile relevance score")
    elif score >= 55:
        reasons.append("Moderate relevance score")
    elif score > 0:
        blockers.append("Low relevance score")
    else:
        blockers.append("Tender is unscored or no relevance signals were found")

    if tender.deadline:
        days_left = (tender.deadline - date.today()).days
        if days_left < 0:
            blockers.append("Deadline already expired")
            decision_score -= 45
        elif days_left <= 3:
            blockers.append("Very short submission deadline")
            decision_score -= 25
        elif days_left <= 7:
            blockers.append("Short submission deadline")
            decision_score -= 12
        else:
            reasons.append(f"{days_left} days available before deadline")

    if eligibility:
        risks = load_risks(eligibility)
        if eligibility.confidence and eligibility.confidence >= 0.5:
            reasons.append("Eligibility information extracted from tender text/PDF")
            decision_score += 6
        if eligibility.emd:
            blockers.append("EMD or bid security requirement needs review")
            next_steps.append("Confirm EMD amount and exemption eligibility")
        if eligibility.turnover_requirement:
            blockers.append("Turnover requirement needs verification")
            next_steps.append("Check company turnover against tender requirement")
        if eligibility.experience_requirement:
            blockers.append("Past experience requirement needs verification")
            next_steps.append("Collect similar work orders and completion certificates")
        if eligibility.documents_required:
            reasons.append("Required document list found")
            next_steps.append("Prepare document checklist before bidding")
        if eligibility.certifications_required:
            blockers.append("Certification requirement needs verification")
            next_steps.append("Confirm required certifications are available")
        for risk in risks:
            if risk not in blockers:
                blockers.append(risk)
        decision_score -= min(25, len(risks) * 5)
    else:
        blockers.append("Eligibility not extracted yet")
        next_steps.append("Run eligibility extraction before final bid decision")
        decision_score -= 8

    status = (tender.status or "new").lower()
    if status in {"applied", "won"}:
        reasons.append(f"Tender status is already {status}")
    if status in {"lost", "ignored"}:
        blockers.append(f"Tender status is {status}")
        decision_score -= 30

    decision_score = max(0, min(100, round(decision_score, 1)))
    severe = any(
        phrase in " ".join(blockers).lower()
        for phrase in ["expired", "ignored", "lost"]
    )
    if severe or decision_score < 40:
        recommendation = "no_bid"
    elif decision_score >= 70 and len(blockers) <= 3:
        recommendation = "bid"
    else:
        recommendation = "review"

    if recommendation == "bid":
        next_steps.insert(0, "Proceed with bid preparation after confirming eligibility blockers")
    elif recommendation == "review":
        next_steps.insert(0, "Review blockers before committing bid resources")
    else:
        next_steps.insert(0, "Do not bid unless blockers are resolved")

    confidence = 0.45
    if tender.relevance_score is not None:
        confidence += 0.25
    if eligibility:
        confidence += min(0.25, float(eligibility.confidence or 0) * 0.25)
    if tender.deadline:
        confidence += 0.05

    return {
        "recommendation": recommendation,
        "decision_score": decision_score,
        "reasons": list(dict.fromkeys(reasons)),
        "blockers": list(dict.fromkeys(blockers)),
        "next_steps": list(dict.fromkeys(next_steps)),
        "confidence": round(min(1, confidence), 2),
    }
