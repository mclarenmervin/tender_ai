"""Deterministic procurement anomaly calculations.

These functions are intentionally independent of the database so their
thresholds and boundary behaviour can be tested directly.
"""


RISK_ORDER = {"low": 0, "medium": 1, "high": 2, "very_high": 3}


def price_similarity_risk(gap_percent):
    """Classify a non-negative price gap using the approved intelligence bands."""
    if gap_percent is None or gap_percent < 0:
        return None
    if gap_percent <= 0.5:
        return "very_high"
    if gap_percent <= 2:
        return "high"
    if gap_percent <= 5:
        return "medium"
    return "low"


def _strongest_risk(*levels):
    present = [level for level in levels if level in RISK_ORDER]
    return max(present, key=RISK_ORDER.get) if present else None


def calculate_price_gap_metrics(l1_price, l2_price, l3_price=None):
    """Calculate L1/L2/L3 gaps and an evidence-based similarity assessment.

    Per the project specification, both L2-L3 gap and L1-L3 cluster spread use
    L1 as the denominator. Invalid or out-of-order prices are rejected instead
    of producing a misleading risk signal.
    """
    try:
        l1 = float(l1_price)
        l2 = float(l2_price)
        l3 = float(l3_price) if l3_price is not None else None
    except (TypeError, ValueError):
        return None

    if l1 <= 0 or l2 < l1 or (l3 is not None and l3 < l2):
        return None

    l1_l2_gap = round(((l2 - l1) / l1) * 100, 2)
    l2_l3_gap = round(((l3 - l2) / l1) * 100, 2) if l3 is not None else None
    cluster_spread = round(((l3 - l1) / l1) * 100, 2) if l3 is not None else None
    l1_l2_risk = price_similarity_risk(l1_l2_gap)
    cluster_risk = price_similarity_risk(cluster_spread)
    risk_level = _strongest_risk(l1_l2_risk, cluster_risk)

    evidence = [f"L1-L2 gap is {l1_l2_gap:.2f}% ({l1_l2_risk.replace('_', ' ')} similarity risk)"]
    if l3 is not None:
        evidence.append(f"L2-L3 gap is {l2_l3_gap:.2f}%")
        evidence.append(f"L1-L3 cluster spread is {cluster_spread:.2f}% ({cluster_risk.replace('_', ' ')} similarity risk)")

    return {
        "l1_l2_gap_percent": l1_l2_gap,
        "l2_l3_gap_percent": l2_l3_gap,
        "cluster_spread_percent": cluster_spread,
        "l1_l2_risk_level": l1_l2_risk,
        "cluster_risk_level": cluster_risk,
        "risk_level": risk_level,
        "explanation": "; ".join(evidence) + ". Requires manual review; not proof of wrongdoing.",
    }


def calculate_competition_metrics(total_bidders, technically_qualified=None, technically_disqualified=None):
    """Calculate low-competition and technical-rejection risk indicators.

    The calculation accepts partially evaluated bids, but rejects contradictory
    counts. A missing value remains unknown rather than being treated as zero.
    """
    try:
        total = int(total_bidders)
        qualified = int(technically_qualified) if technically_qualified is not None else None
        disqualified = int(technically_disqualified) if technically_disqualified is not None else None
    except (TypeError, ValueError):
        return None

    if total <= 0 or qualified is not None and qualified < 0 or disqualified is not None and disqualified < 0:
        return None
    if qualified is not None and qualified > total or disqualified is not None and disqualified > total:
        return None
    if qualified is not None and disqualified is not None and qualified + disqualified > total:
        return None

    competition_ratio = round((qualified / total) * 100, 2) if qualified is not None else None
    disqualification_rate = round((disqualified / total) * 100, 2) if disqualified is not None else None
    reasons = []
    levels = []

    if qualified == 1:
        levels.append("very_high")
        reasons.append("Only one bidder was technically qualified")
    elif qualified == 2:
        levels.append("high")
        reasons.append("Only two bidders were technically qualified")

    if disqualification_rate is not None and disqualification_rate > 60:
        levels.append("high")
        reasons.append(f"Technical disqualification rate is {disqualification_rate:.2f}%, above 60%")

    if total < 3:
        levels.append("medium")
        reasons.append(f"Only {total} bidder{'s' if total != 1 else ''} participated")

    risk_level = _strongest_risk(*levels) or "low"
    if not reasons:
        reasons.append("No prescribed low-competition threshold was crossed")

    return {
        "total_bidders": total,
        "technically_qualified": qualified,
        "technically_disqualified": disqualified,
        "competition_ratio_percent": competition_ratio,
        "disqualification_rate_percent": disqualification_rate,
        "risk_level": risk_level,
        "explanation": "; ".join(reasons) + ". Requires manual review; not proof of wrongdoing.",
    }


def calculate_award_ratio_metrics(estimated_value, awarded_value):
    """Compare awarded value with the tender's estimated value.

    Ratios above 1 require review, while awards from 0.95 through 1.00 are
    flagged as close to estimate. Lower ratios are retained as context but do
    not create an anomaly signal on their own.
    """
    try:
        estimated = float(estimated_value)
        awarded = float(awarded_value)
    except (TypeError, ValueError):
        return None

    if estimated <= 0 or awarded <= 0:
        return None

    ratio = awarded / estimated
    ratio_percent = round(ratio * 100, 2)
    saving_percent = round((1 - ratio) * 100, 2)

    if ratio > 1:
        risk_level = "high"
        interpretation = "Awarded value exceeds the estimated value"
    elif ratio >= 0.95:
        risk_level = "medium"
        interpretation = "Awarded value is very close to the estimated value"
    elif ratio >= 0.80:
        risk_level = "low"
        interpretation = "Award reflects moderate saving against the estimate"
    else:
        risk_level = "low"
        interpretation = "Award reflects competitive saving against the estimate"

    return {
        "estimated_value": estimated_value,
        "awarded_value": awarded_value,
        "award_ratio": round(ratio, 4),
        "award_ratio_percent": ratio_percent,
        "saving_percent": saving_percent,
        "risk_level": risk_level,
        "interpretation": interpretation,
        "explanation": f"{interpretation}; award ratio is {ratio_percent:.2f}% and saving is {saving_percent:.2f}%. Requires manual review; not proof of wrongdoing.",
    }
