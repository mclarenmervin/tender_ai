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
