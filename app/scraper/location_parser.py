import re


INDIAN_STATE_NAMES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
    "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
    "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
]

GUJARAT_LOCATION_ALIASES = {
    "Tapi": ["Tapi"],
    "Vyara": ["Vyara"],
    "Surat": ["Surat"],
    "Navsari": ["Navsari"],
    "The Dangs": ["The Dangs", "The Dang", "Dang", "Dangs", "Ahwa"],
    "Chhotaudepur": ["Chhotaudepur", "Chhota Udepur", "Chhota-Udepur"],
    "Narmada": ["Narmada", "Rajpipla"],
    "Vapi": ["Vapi"],
    "Bharuch": ["Bharuch"],
    "Valsad": ["Valsad"],
    "Dadra & Nagar Haveli": ["Dadra & Nagar Haveli", "Dadra and Nagar Haveli", "Silvassa"],
    "Ankleshwar": ["Ankleshwar", "Ankaleshwar"],
    "Vadodara": ["Vadodara", "Baroda"],
    "Panch Mahals": ["Panch Mahals", "Panchmahal", "Panch Mahal", "Godhra"],
    "Ahmedabad": ["Ahmedabad", "Amdavad"],
    "Jamnagar": ["Jamnagar"],
    "Mahesana": ["Mahesana", "Mehsana"],
    "Rajkot": ["Rajkot"],
    "Gir Somnath": ["Gir Somnath"],
    "Morbi": ["Morbi"],
    "Arvalli": ["Arvalli", "Aravalli"],
    "Porbandar": ["Porbandar"],
    "Kheda": ["Kheda", "Nadiad"],
    "Devbhumi Dwarka": ["Devbhumi Dwarka", "Devbhoomi Dwarka"],
    "Kutch": ["Kutch", "Kachchh", "Bhuj"],
    "Amreli": ["Amreli"],
    "Botad": ["Botad"],
    "Sabarkantha": ["Sabarkantha", "Sabar Kantha", "Himmatnagar"],
    "Surendra Nagar": ["Surendra Nagar", "Surendranagar"],
    "Patan": ["Patan"],
    "Banaskantha": ["Banaskantha", "Banas Kantha", "Palanpur"],
    "Dahod": ["Dahod"],
    "Mahisagar": ["Mahisagar", "Lunawada"],
    "Anand": ["Anand"],
    "Junagadh": ["Junagadh"],
    "Bhavnagar": ["Bhavnagar"],
    "Gandhinagar": ["Gandhinagar"],
}

STATE_LOCATION_ALIASES = {
    "Odisha": ["Odisha", "Orissa", "Bhubaneswar", "Bhubaneshwar", "Cuttack", "Koraput", "Damanjodi", "Rourkela", "Sambalpur", "Berhampur", "Balasore", "Puri", "Angul", "Jharsuguda", "Jeypore"],
    "Gujarat": list({alias for aliases in GUJARAT_LOCATION_ALIASES.values() for alias in aliases}),
}


def compact(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def contains_phrase(text, phrase):
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(phrase.lower())}(?![a-z0-9])", text.lower()))


def normalize_state(value):
    cleaned = compact(value)
    if not cleaned or cleaned.lower() in {"india", "all india", "n/a", "na"}:
        return ""
    for state in INDIAN_STATE_NAMES:
        if cleaned.lower() == state.lower():
            return state
    return ""


def infer_state(text, configured_states=None):
    haystack = compact(text)
    configured = [normalize_state(value) for value in (configured_states or [])]
    configured = [value for value in configured if value]
    for state in configured:
        if contains_phrase(haystack, state):
            return state
    for state in INDIAN_STATE_NAMES:
        if contains_phrase(haystack, state):
            return state
    for state,aliases in STATE_LOCATION_ALIASES.items():
        if any(contains_phrase(haystack, alias) for alias in aliases):
            return state
    return configured[0] if len(configured) == 1 else ""


def infer_city(text, configured_city=""):
    haystack = compact(text)
    requested = compact(configured_city)
    if requested:
        for canonical, aliases in GUJARAT_LOCATION_ALIASES.items():
            if requested.lower() == canonical.lower() or any(requested.lower() == alias.lower() for alias in aliases):
                if any(contains_phrase(haystack, alias) for alias in aliases):
                    return canonical
    matches = []
    for canonical, aliases in GUJARAT_LOCATION_ALIASES.items():
        for alias in aliases:
            if contains_phrase(haystack, alias):
                matches.append((len(alias), canonical))
    return max(matches, default=(0, ""))[1]


def extract_location(text, state_value="", city_value="", configured_states=None, configured_city=""):
    state = normalize_state(state_value) or infer_state(text, configured_states)
    city = infer_city(city_value or text, configured_city)
    if city and not state:
        state = "Gujarat"
    return state, city
