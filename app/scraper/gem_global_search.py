import json
from datetime import datetime
from html.parser import HTMLParser
from urllib.parse import urljoin

import requests

from app.scraper.location_parser import extract_location


GEM_BASE_URL = "https://bidplus.gem.gov.in"
SORT_VALUES = {
    "Bid-Start-Date-Latest", "Bid-Start-Date-Oldest",
    "Bid-End-Date-Latest", "Bid-End-Date-Oldest",
}


class _HiddenInputParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = {}

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "input":
            return
        values = dict(attrs)
        if values.get("id"):
            self.values[values["id"]] = values.get("value", "")


def _first(value, default=""):
    if isinstance(value, list):
        return value[0] if value else default
    return value if value not in (None, "") else default


def _parse_gem_date(value):
    value = str(_first(value, "")).strip()
    if not value:
        return ""
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).isoformat()
        except ValueError:
            pass
    return value


def _document_url(doc):
    bid_id = str(_first(doc.get("b_id"), "")).strip()
    bid_type = str(_first(doc.get("b_bid_type"), "")).strip()
    if bid_type == "5":
        path = f"/showdirectradocumentPdf/{bid_id}"
    elif bid_type == "2":
        path = f"/showradocumentPdf/{bid_id}"
    else:
        path = f"/showbidDocument/{bid_id}"
    return urljoin(GEM_BASE_URL, path)


def map_gem_document(doc):
    ministry = str(_first(doc.get("ba_official_details_minName"), "")).strip()
    department = str(_first(doc.get("ba_official_details_deptName"), "")).strip()
    authority = " / ".join(part for part in (ministry, department) if part)
    category = str(_first(doc.get("b_category_name"), "")).strip()
    office = str(_first(doc.get("ba_official_details_officeName"), "")).strip()
    organisation = str(_first(doc.get("ba_official_details_orgName"), "")).strip()
    location_text = " ".join((authority, office, organisation, category))
    state, city = extract_location(location_text)
    return {
        "source_id": str(_first(doc.get("b_id"), "")),
        "bid_number": str(_first(doc.get("b_bid_number"), "")),
        "title": category or "GeM tender",
        "category": category,
        "quantity": str(_first(doc.get("b_total_quantity"), "")),
        "ministry": ministry,
        "department": department,
        "authority": authority,
        "organisation": organisation,
        "office": office,
        "state": state,
        "city": city,
        "status": str(_first(doc.get("b_status"), "")),
        "bid_type": str(_first(doc.get("b_bid_type"), "")),
        "start_date": _parse_gem_date(doc.get("final_start_date_sort")),
        "end_date": _parse_gem_date(doc.get("final_end_date_sort")),
        "is_high_value": str(_first(doc.get("is_high_value"), "0")).lower() in {"1", "true", "yes"},
        "is_global_tender": str(_first(doc.get("ba_is_global_tendering"), "0")).lower() in {"1", "true", "yes"},
        "url": _document_url(doc),
    }


def _matches(item, q="", department=""):
    def contains(value, query):
        return not query or query.casefold() in (value or "").casefold()
    authority_text = " ".join((item["authority"], item["organisation"], item["office"]))
    searchable = " ".join((item["bid_number"], item["title"], authority_text))
    return contains(authority_text, department) and contains(searchable, q)


def search_gem_bids(q="", department="", state="", city="", bid_type="all",
                    status="ongoing_bids", from_date="", to_date="",
                    sort="Bid-End-Date-Oldest", page=1, page_size=10):
    page = max(1, int(page))
    page_size = max(5, min(50, int(page_size)))
    is_bid_number = str(q).strip().upper().startswith("GEM/")
    search_text = (q if is_bid_number else city or state or department or q).strip()
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 TenderAI/1.0"})
    try:
        listing = session.get(f"{GEM_BASE_URL}/all-bids", timeout=25)
        listing.raise_for_status()
        parser = _HiddenInputParser()
        parser.feed(listing.text)
        csrf_name = parser.values.get("cname", "").strip()
        csrf_token = parser.values.get("chash", "").strip()
        if not csrf_name or not csrf_token:
            raise RuntimeError("GeM search token was not available")

        payload = {
            "page": page,
            "param": {"searchBid": search_text, "searchType": "fullText"},
            "filter": {
                "bidStatusType": status if status in {"ongoing_bids", "bidrastatus"} else "ongoing_bids",
                "byType": bid_type or "all",
                "highBidValue": "",
                "byEndDate": {"from": from_date or "", "to": to_date or ""},
                "sort": sort if sort in SORT_VALUES else "Bid-End-Date-Oldest",
            },
        }
        response = session.post(
            f"{GEM_BASE_URL}/all-bids-data",
            data={"payload": json.dumps(payload, separators=(",", ":")), csrf_name: csrf_token},
            headers={"Referer": f"{GEM_BASE_URL}/all-bids", "X-Requested-With": "XMLHttpRequest"},
            timeout=35,
        )
        response.raise_for_status()
        result = response.json()
        body = result.get("response", {}).get("response", {})
        docs = body.get("docs", []) or []
        items = [map_gem_document(doc) for doc in docs]
        for item in items:
            if state and not item["state"]:
                item["state"] = state
            if city and not item["city"]:
                item["city"] = city
        # GeM performs the state/city full-text match against its complete index;
        # the compact result record does not expose address fields. Remaining
        # visible criteria are checked locally to prevent unrelated cards.
        local_q = "" if search_text == q else q
        items = [item for item in items if _matches(item, local_q, department)]
        total = int(body.get("numFound") or len(items))
        return {
            "items": items[:page_size],
            "page": page,
            "page_size": page_size,
            "total": total,
            "pages": max(1, (total + page_size - 1) // page_size),
            "query": search_text,
            "notice": "Results are loaded live from GeM. GeM may take up to 15 minutes to show newly published or modified bids.",
        }
    except (requests.RequestException, ValueError, RuntimeError) as exc:
        raise RuntimeError(f"GeM search is temporarily unavailable: {exc}") from exc


def search_gem_advanced(mode="bid", page=1, bid_number="", category="", ministry="",
                        buyer_state="", organization="", department="", state="", city="",
                        boq_title="", high_value="", from_date="", to_date=""):
    """Run one of the four public GeM Advanced Search modes."""
    mode = mode if mode in {"bid", "ministry", "location", "boq"} else "bid"
    if mode == "bid" and category and not bid_number:
        return search_gem_bids(q=category,from_date=from_date,to_date=to_date,page=page,page_size=10)
    city_values=[value.strip() for value in str(city or "").split(",") if value.strip()]
    if mode == "location" and len(city_values)>1:
        combined=[]; total=0
        for value in city_values:
            result=search_gem_advanced(mode=mode,page=page,state=state,city=value,from_date=from_date,to_date=to_date)
            total+=result.get("total",0)
            for item in result.get("items",[]):
                if item.get("bid_number") not in {row.get("bid_number") for row in combined}:
                    combined.append(item)
        return {"items":combined[:10],"page":max(1,int(page)),"page_size":10,"total":total,
                "pages":max(1,(total+9)//10),"query":"location",
                "notice":"Advanced location results are loaded live from GeM for the selected cities / districts."}
    def gem_date(value):
        try:
            return datetime.strptime(value,"%Y-%m-%d").strftime("%d-%m-%Y") if value else ""
        except ValueError:
            return value
    from_date,to_date=gem_date(from_date),gem_date(to_date)
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 TenderAI/1.0"})
    try:
        listing = session.get(f"{GEM_BASE_URL}/advance-search", timeout=25)
        listing.raise_for_status()
        parser = _HiddenInputParser(); parser.feed(listing.text)
        csrf_name = parser.values.get("cname", "").strip()
        csrf_token = parser.values.get("chash", "").strip()
        if not csrf_name or not csrf_token:
            raise RuntimeError("GeM Advanced Search token was not available")
        if mode == "ministry":
            payload = {"searchType":"ministry-search","ministry":ministry,"buyerState":buyer_state,
                       "organization":organization,"department":department,"bidEndFromMin":from_date,"bidEndToMin":to_date}
        elif mode == "location":
            payload = {"searchType":"con","state_name_con":state,"city_name_con":city,
                       "bidEndFromCon":from_date,"bidEndToCon":to_date}
        elif mode == "boq":
            payload = {"searchType":"boq","boqtitle_con":boq_title,"bidvalue":high_value,
                       "bidEndFromBoq":from_date,"bidEndToBoq":to_date}
        else:
            payload = {"searchType":"bidNumber","bidNumber":bid_number,"category":category,
                       "bidEndFrom":from_date,"bidEndTo":to_date}
        payload["page"] = max(1, int(page))
        response = session.post(f"{GEM_BASE_URL}/search-bids",
            data={"payload":json.dumps(payload,separators=(",",":")),csrf_name:csrf_token},
            headers={"Referer":f"{GEM_BASE_URL}/advance-search","X-Requested-With":"XMLHttpRequest"},timeout=35)
        if response.status_code == 404:
            return {"items":[],"page":max(1,int(page)),"page_size":10,"total":0,"pages":1,
                    "query":mode,"notice":"No live GeM bids matched the selected Advanced Search filters."}
        response.raise_for_status()
        result=response.json(); body=result.get("response",{}).get("response",{})
        items=[map_gem_document(doc) for doc in (body.get("docs") or [])]
        total=int(body.get("numFound") or len(items)); current=max(1,int(page))
        return {"items":items,"page":current,"page_size":10,"total":total,
                "pages":max(1,(total+9)//10),"query":mode,
                "notice":"Advanced results are loaded live from GeM using the selected search group."}
    except (requests.RequestException,ValueError,RuntimeError) as exc:
        raise RuntimeError(f"GeM Advanced Search is temporarily unavailable: {exc}") from exc


def gem_advanced_options():
    session=requests.Session(); session.headers.update({"User-Agent":"Mozilla/5.0 TenderAI/1.0"})
    try:
        ministry_data=session.get(f"{GEM_BASE_URL}/ministry-list-adv",timeout=25).json().get("data",{})
        ministries=ministry_data.get("MinistryList",[])
        states=session.get(f"{GEM_BASE_URL}/state-list-adv",timeout=25).json().get("data",[])
        return {"ministries":ministries,"buyer_states":ministry_data.get("BuyerStateList",[]),
                "states":[row.get("state_name","") for row in states if row.get("state_name")]}
    except (requests.RequestException,ValueError) as exc:
        raise RuntimeError(f"GeM Advanced Search options are temporarily unavailable: {exc}") from exc


def gem_dependent_options(kind, ministry="", buyer_state="", organization="", state=""):
    endpoints={"organizations":"org-list-adv","departments":"dept-list-adv","cities":"city-list-adv"}
    if kind not in endpoints:
        raise RuntimeError("Unsupported GeM option group")
    session=requests.Session(); session.headers.update({"User-Agent":"Mozilla/5.0 TenderAI/1.0"})
    try:
        page=session.get(f"{GEM_BASE_URL}/advance-search",timeout=25); page.raise_for_status()
        parser=_HiddenInputParser(); parser.feed(page.text)
        csrf_name=parser.values.get("cname",""); csrf_token=parser.values.get("chash","")
        data={csrf_name:csrf_token}
        if kind=="organizations":
            if ministry: data["ministry"]=ministry
            if buyer_state: data["buyer_state"]=buyer_state
        elif kind=="departments":
            data.update({"ministry":ministry,"buyer_state":buyer_state,"organization":organization})
        else:
            data["state_name"]=state
        response=session.post(f"{GEM_BASE_URL}/{endpoints[kind]}",data=data,
            headers={"Referer":f"{GEM_BASE_URL}/advance-search","X-Requested-With":"XMLHttpRequest"},timeout=30)
        response.raise_for_status(); payload=response.json()
        if kind=="cities":
            values=[row.get("city_name","") for row in (payload.get("data") or []) if row.get("city_name")]
        else:
            values=payload if isinstance(payload,list) else []
        cleaned=[]
        for value in values:
            value=str(value or "").strip()
            if value and value.lower() not in {"null","na","n/a"} and value not in cleaned: cleaned.append(value)
        return {"items":cleaned}
    except (requests.RequestException,ValueError) as exc:
        raise RuntimeError(f"GeM dependent options are temporarily unavailable: {exc}") from exc
