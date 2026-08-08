import io
import json
import os
import re
import math
from datetime import date, datetime
from urllib.parse import urljoin

import requests
from pypdf import PdfReader
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from app.scraper.base_scraper import BaseScraper
from app.scraper.location_parser import extract_location
from app.scraper.gem_global_search import _HiddenInputParser


class GemScraper(BaseScraper):
    source_name = "GeM"
    base_url = "https://bidplus.gem.gov.in"
    list_url = "https://bidplus.gem.gov.in/all-bids"

    def __init__(self, keywords=None, max_bids=20, state=None, states=None, city=None, cities=None, authorities=None):
        self.keywords = [keyword.strip() for keyword in (keywords or []) if keyword and keyword.strip()]
        self.max_bids = max_bids
        state_values = states if states is not None else ([state] if state else [])
        self.state_filters = [
            self.clean_text(value).lower()
            for value in state_values
            if self.clean_text(value)
        ]
        city_values = cities if cities is not None else ([city] if city else [])
        self.city_filters = [self.clean_text(value).lower() for value in city_values if self.clean_text(value)]
        self.city_filter = self.city_filters[0] if self.city_filters else ""
        self.authority_filters = [self.clean_text(value).lower() for value in (authorities or []) if self.clean_text(value)]

    def clean_text(self, text):
        return re.sub(r"\s+", " ", text or "").strip()

    def extract_bid_no(self, text):
        match = re.search(r"GEM/\d{4}/B/\d+", text or "")
        return match.group(0) if match else None

    def extract_bid_numbers(self, text):
        return list(dict.fromkeys(re.findall(r"GEM/\d{4}/B/\d+", text or "")))

    def extract_date(self, text):
        labelled = self.extract_field(text, [
            "Bid End Date/Time",
            "Bid End Date",
            "End Date/Time",
            "End Date",
            "Bid Closing Date",
            "Closing Date",
        ])
        candidates = [labelled] if labelled else []
        candidates.extend(re.findall(r"(?:\d{2}[-/]\d{2}[-/]\d{4}|\d{4}-\d{2}-\d{2})", text or ""))
        for candidate in candidates:
            match = re.search(r"(?:\d{2}[-/]\d{2}[-/]\d{4}|\d{4}-\d{2}-\d{2})", candidate or "")
            if not match:
                continue
            raw = match.group(0)
            for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
                try:
                    return datetime.strptime(raw, fmt).date()
                except ValueError:
                    pass
        return date.today()

    def extract_value(self, text):
        cleaned = self.clean_text(text).replace(",", "")
        match = re.search(
            r"Estimated\s+Bid\s+Value\s*[:/-]?\s*(?:Rs\.?|INR|₹)?\s*([0-9]{4,})",
            cleaned,
            re.IGNORECASE,
        )
        if match:
            return int(match.group(1))

        money_values = [
            int(value)
            for value in re.findall(r"(?:Rs\.?|INR|₹)\s*([0-9]{4,})", cleaned, re.IGNORECASE)
        ]
        if money_values:
            return max(money_values)
        return 0

    def extract_pdf_text(self, url, timeout=20, pages=3):
        try:
            response = requests.get(
                url,
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=timeout,
            )
            response.raise_for_status()
            if response.content[:4] != b"%PDF":
                return ""
            reader = PdfReader(io.BytesIO(response.content))
            return "\n".join(page.extract_text() or "" for page in reader.pages[:pages])
        except Exception:
            return ""

    def extract_field(self, text, labels):
        lines = [self.clean_text(line) for line in (text or "").split("\n") if self.clean_text(line)]

        for i, line in enumerate(lines):
            for label in labels:
                # Reject partial label matches such as "Department Name" in
                # "Department Name And Address".
                if not re.search(
                    rf"^\s*/?\s*{re.escape(label)}\s*(?::|\||-|$)",
                    line,
                    re.IGNORECASE,
                ):
                    continue
                match = re.search(
                    rf"(?:^|/)\s*{re.escape(label)}\s*(?::|[-–|])?\s*(.*?)\s*$",
                    line,
                    re.IGNORECASE,
                )
                if not match:
                    continue
                value = self.clean_text(match.group(1))
                if value and value.lower() != label.lower():
                    return value
                if i + 1 < len(lines):
                    return lines[i + 1]
        return ""

    def extract_multiline_field(self,text,labels,stop_labels=None,max_lines=4):
        lines=[self.clean_text(line) for line in (text or "").split("\n") if self.clean_text(line)]
        stops=stop_labels or ["Start Date","End Date","Bid Start Date","Bid End Date","BID NO"]
        for index,line in enumerate(lines):
            for label in labels:
                match=re.search(rf"^\s*/?\s*{re.escape(label)}\s*(?::|\||-|$)\s*(.*?)\s*$",line,re.IGNORECASE)
                if not match: continue
                values=[]; inline=self.clean_text(match.group(1) or "")
                if inline: values.append(inline)
                for candidate in lines[index+1:index+1+max_lines]:
                    if any(re.search(rf"^\s*{re.escape(stop)}\s*(?::|\||-|$)",candidate,re.IGNORECASE) for stop in stops): break
                    if self.extract_bid_no(candidate): break
                    values.append(candidate)
                return " / ".join(dict.fromkeys(value for value in values if value))
        return ""

    def location_enabled(self):
        return bool(self.state_filters or self.city_filters)

    def location_search_suffix(self):
        return " ".join(self.state_filters + self.city_filters)

    def location_matches(self, text):
        if not self.location_enabled():
            return True
        haystack = self.clean_text(text).lower()
        if self.state_filters:
            inferred_state,_=extract_location(text)
            if not any(state in haystack for state in self.state_filters) and inferred_state.lower() not in self.state_filters:
                return False
        if self.city_filters and not any(city in haystack for city in self.city_filters):
            return False
        return True

    def location_matches_item(self, item):
        if not self.location_enabled():
            return True
        if self.location_matches(item.get("description", "")):
            return True

        pdf_text = self.extract_pdf_text(item.get("url"), timeout=6, pages=2)
        if not pdf_text or not self.location_matches(pdf_text):
            return False

        item["description"] = self.clean_text((item.get("description") or "") + "\n" + pdf_text)[:5000]
        matched_state = self.matched_state(pdf_text)
        if matched_state:
            item["state"] = matched_state.title()[:100]
        state, city = extract_location(
            pdf_text,
            state_value=item.get("state", ""),
            city_value=item.get("city", ""),
            configured_states=self.state_filters,
            configured_city=next((value for value in self.city_filters if value in pdf_text.lower()), self.city_filter),
        )
        item["state"] = state[:100]
        item["city"] = city[:150]
        return True

    def authority_matches_item(self,item):
        if not self.authority_filters:
            return True
        department=self.clean_text(item.get('department','')).lower()
        if not department or department in {'gem','unknown'}:
            return False
        segments={self.clean_text(value).lower() for value in re.split(r'[/|\n]+',department) if self.clean_text(value)}
        segments.add(department)
        return any(authority in segments for authority in self.authority_filters)

    def matched_state(self, text):
        haystack = self.clean_text(text).lower()
        for state in self.state_filters:
            if state in haystack:
                return state
        return None

    def browser_args(self):
        return [
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-setuid-sandbox",
        ]

    def browser_proxy(self):
        server = os.getenv("GEM_PROXY_SERVER", "").strip()
        if not server:
            return None
        proxy = {"server": server}
        username = os.getenv("GEM_PROXY_USERNAME", "").strip()
        password = os.getenv("GEM_PROXY_PASSWORD", "").strip()
        if username:
            proxy["username"] = username
        if password:
            proxy["password"] = password
        return proxy

    def collect_links_via_http(self):
        session = requests.Session()
        session.headers.update({"User-Agent": "Mozilla/5.0 TenderAI/1.0"})
        listing = session.get(self.list_url, timeout=30)
        listing.raise_for_status()
        parser = _HiddenInputParser()
        parser.feed(listing.text)
        csrf_name = parser.values.get("cname", "").strip()
        csrf_token = parser.values.get("chash", "").strip()
        if not csrf_name or not csrf_token:
            raise RuntimeError("GeM search token was not available")

        keywords = self.keywords or [""]
        per_keyword_limit = max(1, math.ceil(self.max_bids / len(keywords)))
        links, seen = [], set()
        for keyword in keywords:
            page_number = 1
            total_pages = 1
            while page_number <= min(total_pages, 80) and len(
                [row for row in links if row.get("keyword") == keyword]
            ) < per_keyword_limit:
                payload = {
                    "page": page_number,
                    "param": {"searchBid": keyword, "searchType": "fullText"},
                    "filter": {
                        "bidStatusType": "ongoing_bids", "byType": "all",
                        "highBidValue": "", "byEndDate": {"from": "", "to": ""},
                        "sort": "Bid-End-Date-Oldest",
                    },
                }
                response = session.post(
                    f"{self.base_url}/all-bids-data",
                    data={"payload": json.dumps(payload, separators=(",", ":")), csrf_name: csrf_token},
                    headers={"Referer": self.list_url, "X-Requested-With": "XMLHttpRequest"},
                    timeout=35,
                )
                response.raise_for_status()
                body = ((response.json() or {}).get("response") or {}).get("response") or {}
                docs = body.get("docs") or []
                total_pages = max(1, math.ceil(int(body.get("numFound") or 0) / 10))
                if not docs:
                    break
                for doc in docs:
                    first = lambda value: value[0] if isinstance(value, list) and value else (value or "")
                    bid_no = self.extract_bid_no(str(first(doc.get("b_bid_number"))))
                    if not bid_no or bid_no in seen:
                        continue
                    ministry = self.clean_text(str(first(doc.get("ba_official_details_minName"))))
                    department = self.clean_text(str(first(doc.get("ba_official_details_deptName"))))
                    organisation = self.clean_text(str(first(doc.get("ba_official_details_orgName"))))
                    office = self.clean_text(str(first(doc.get("ba_official_details_officeName"))))
                    authority_segments = {
                        value.lower() for value in (ministry, department, organisation, office) if value
                    }
                    if self.authority_filters and not any(value in authority_segments for value in self.authority_filters):
                        continue
                    categories = doc.get("b_category_name") or []
                    if isinstance(categories, str):
                        categories = [categories]
                    bid_id = str(first(doc.get("b_id")))
                    bid_type = str(first(doc.get("b_bid_type")))
                    path = f"/showradocumentPdf/{bid_id}" if bid_type == "2" else f"/showbidDocument/{bid_id}"
                    card_text = "\n".join([
                        f"BID NO: {bid_no}", "Items:", " / ".join(map(str, categories)),
                        "Ministry:", ministry, "Department Name:",
                        " / ".join(value for value in (ministry, department, organisation, office) if value),
                        "Organisation Name:", organisation, "Office Name:", office,
                        "Start Date:", str(first(doc.get("final_start_date_sort"))),
                        "End Date:", str(first(doc.get("final_end_date_sort"))),
                    ])
                    links.append({
                        "bid_no": bid_no, "url": urljoin(self.base_url, path),
                        "card_text": card_text, "keyword": keyword,
                    })
                    seen.add(bid_no)
                    if len([row for row in links if row.get("keyword") == keyword]) >= per_keyword_limit:
                        break
                page_number += 1
        return links[:self.max_bids]

    def apply_keyword_search(self, page, keyword):
        if not keyword:
            return

        page.wait_for_selector("#searchBid", timeout=30000)
        field = page.locator("#searchBid")
        if field.count() == 0:
            raise RuntimeError("GeM keyword search input #searchBid was not found")

        field.fill(keyword)
        page.locator("#searchBidRA").click()
        page.wait_for_timeout(4500)

    def collect_links_from_page(self, page):
        page.goto(self.list_url, wait_until="commit", timeout=30000)

        try:
            page.wait_for_function(
                "() => document.body && /GEM\\/\\d{4}\\/B\\/\\d+/.test(document.body.innerText)",
                timeout=45000,
            )
        except PlaywrightTimeoutError:
            raise RuntimeError("GeM page loaded, but no bid numbers appeared within 45 seconds")

        links = []
        cards = page.locator(".card, .bid_no_hover, .bid-list, li, tr, div").all()

        for card in cards[:150]:
            try:
                text = card.inner_text()
                bid_no = self.extract_bid_no(text)
                if not bid_no:
                    continue

                href = None
                for anchor in card.locator("a").all():
                    possible_href = anchor.get_attribute("href")
                    if possible_href and ("showbidDocument" in possible_href or "bid" in possible_href.lower()):
                        href = possible_href
                        break

                links.append({
                    "bid_no": bid_no,
                    "url": urljoin(self.base_url, href) if href else self.list_url,
                    "card_text": text,
                })
            except Exception:
                continue

        seen = set()
        unique_links = []
        for link in links:
            if link["bid_no"] in seen:
                continue
            seen.add(link["bid_no"])
            unique_links.append(link)

        if unique_links:
            return unique_links[:self.max_bids]

        body_text = page.inner_text("body")
        for bid_no in self.extract_bid_numbers(body_text)[:self.max_bids]:
            unique_links.append({
                "bid_no": bid_no,
                "url": self.list_url,
                "card_text": body_text,
            })

        if not unique_links:
            raise RuntimeError("No GeM bid numbers found on the all-bids page")

        return unique_links

    def get_bid_links(self, page):
        if not self.keywords:
            page.goto(self.list_url, wait_until="commit", timeout=30000)
            page.wait_for_selector("#searchBid", timeout=30000)
            return self.collect_links_across_pages(page)

        all_links = []
        seen = set()
        per_keyword_limit = max(1, math.ceil(self.max_bids / max(len(self.keywords), 1)))

        for keyword in self.keywords:
            page.goto(self.list_url, wait_until="commit", timeout=30000)
            self.apply_keyword_search(page, keyword)
            links = self.collect_authority_links_from_feed(page,match_limit=per_keyword_limit) if self.authority_filters else self.collect_links_across_pages(page, limit=per_keyword_limit)

            for link in links:
                if len(all_links) >= self.max_bids:
                    break
                if link["bid_no"] in seen:
                    continue
                link["keyword"] = keyword
                seen.add(link["bid_no"])
                all_links.append(link)

        if not all_links:
            raise RuntimeError("No GeM bid numbers found for active keywords: " + ", ".join(self.keywords))

        return all_links[:self.max_bids]

    def collect_authority_links_from_feed(self,page,match_limit=100,max_scan_pages=80):
        links=[]; seen=set(); page_number=1; total_pages=max_scan_pages
        while page_number<=min(total_pages,max_scan_pages) and len(links)<match_limit:
            result=page.evaluate(
                """async ({pageNumber}) => {
                    const tokenName=document.querySelector('#cname')?.value;
                    const tokenValue=document.querySelector('#chash')?.value;
                    const payload={page:pageNumber,param:window.param,filter:window.filter};
                    const values={payload:JSON.stringify(payload)};
                    if(tokenName) values[tokenName]=tokenValue;
                    const response=await fetch('/all-bids-data',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams(values)});
                    if(!response.ok) throw new Error('GeM bid data request failed: '+response.status);
                    return await response.json();
                }""",
                {"pageNumber":page_number},
            )
            response=((result or {}).get("response") or {}).get("response") or {}
            docs=response.get("docs") or []
            total_pages=max(1,math.ceil(int(response.get("numFound") or 0)/10))
            if not docs: break
            for doc in docs:
                scalar=lambda value: value[0] if isinstance(value,list) and value else value
                bid_no=self.extract_bid_no(str(scalar(doc.get("b_bid_number")) or ""))
                bid_id=scalar(doc.get("b_id")); ministry=self.clean_text(str(scalar(doc.get("ba_official_details_minName")) or "")); department=self.clean_text(str(scalar(doc.get("ba_official_details_deptName")) or ""))
                authority=" / ".join(value for value in (ministry,department) if value)
                if not bid_no or bid_no in seen or not self.authority_matches_item({"department":authority}): continue
                categories=doc.get("b_category_name") or []
                if isinstance(categories,str): categories=[categories]
                card_text="\n".join([bid_no,"Items:"," / ".join(str(value) for value in categories),"Department Name And Address:",ministry,department,"Start Date:",str(scalar(doc.get("final_start_date_sort")) or ""),"End Date:",str(scalar(doc.get("final_end_date_sort")) or "")])
                links.append({"bid_no":bid_no,"url":urljoin(self.base_url,f"/showbidDocument/{bid_id}"),"card_text":card_text}); seen.add(bid_no)
                if len(links)>=match_limit: break
            page_number+=1
        return links

    def collect_links_across_pages(self, page, limit=None):
        all_links = []
        seen = set()
        limit = limit or self.max_bids

        while len(all_links) < limit:
            links = self.collect_links_from_current_page(page)
            for link in links:
                if link["bid_no"] in seen:
                    continue
                seen.add(link["bid_no"])
                all_links.append(link)
                if len(all_links) >= limit:
                    break

            if len(all_links) >= limit:
                break

            next_link = page.locator("#light-pagination a.next").first
            try:
                if next_link.count() == 0 or not next_link.is_visible():
                    break
                before = page.inner_text("body")
                next_link.click()
                page.wait_for_timeout(3000)
                after = page.inner_text("body")
                if before == after:
                    break
            except Exception:
                break

        return all_links

    def collect_links_from_current_page(self, page):
        try:
            page.wait_for_function(
                "() => document.body && /GEM\\/\\d{4}\\/B\\/\\d+/.test(document.body.innerText)",
                timeout=45000,
            )
        except PlaywrightTimeoutError:
            return []

        body_text = page.inner_text("body")
        anchors = page.locator("a.bid_no_hover").evaluate_all(
            """els => els.map(a => ({bid_no: a.innerText.trim(), href: a.href}))"""
        )
        links = []
        for index, anchor in enumerate(anchors):
            bid_no = self.extract_bid_no(anchor.get("bid_no", ""))
            if not bid_no:
                continue
            next_bid_no = None
            for later in anchors[index + 1:]:
                next_bid_no = self.extract_bid_no(later.get("bid_no", ""))
                if next_bid_no:
                    break
            start = body_text.find(bid_no)
            end = body_text.find(next_bid_no, start + len(bid_no)) if next_bid_no and start >= 0 else -1
            if start >= 0:
                card_text = body_text[start:end if end > start else start + 1200]
            else:
                card_text = bid_no
            links.append({
                "bid_no": bid_no,
                "url": anchor.get("href") or self.list_url,
                "card_text": card_text,
            })

        seen = set()
        unique_links = []
        for link in links:
            if link["bid_no"] in seen:
                continue
            seen.add(link["bid_no"])
            unique_links.append(link)

        if unique_links:
            return unique_links[:self.max_bids]

        body_text = page.inner_text("body")
        return [
            {"bid_no": bid_no, "url": self.list_url, "card_text": body_text}
            for bid_no in self.extract_bid_numbers(body_text)[:self.max_bids]
        ]

    def parse_detail_page(self, page, bid):
        url = bid["url"]

        full_text = bid["card_text"]
        search_keyword = bid.get("keyword")
        if search_keyword:
            full_text = f"Search keyword: {search_keyword}\n{full_text}"
        clean_full_text = self.clean_text(full_text)
        bid_no = self.extract_bid_no(full_text) or bid["bid_no"]

        title = self.extract_field(full_text, [
            "Item Category",
            "Items",
            "Product Category",
            "Service Category",
            "Bid Details",
        ]) or bid_no

        combined_authority = self.extract_multiline_field(full_text, [
            "Department Name And Address",
            "Department Name & Address",
        ])
        department = self.extract_field(full_text, [
            "Department Name",
            "Organisation Name",
            "Organization Name",
            "Ministry/State Name",
            "Ministry / State Name",
            "Ministry",
            "Buyer Organization",
            "Office Name",
        ])
        address = self.extract_field(full_text, [
            "Buyer Address",
            "Office Address",
            "Consignee Address",
            "Department Address",
            "Address",
        ])
        if department.strip().lower().rstrip(":") in {"and address", "address"}:
            department = ""
        department = department or combined_authority or "GeM"

        raw_state = self.extract_field(full_text, [
            "State Name",
            "State",
            "Consignee State",
            "Buyer State",
        ])
        raw_city = self.extract_field(full_text, [
            "City",
            "District",
            "Consignee District",
            "Delivery Location",
            "Location",
        ])
        state, city = extract_location(
            full_text,
            state_value=raw_state,
            city_value=raw_city,
            configured_states=self.state_filters,
            configured_city=next((value for value in self.city_filters if value in pdf_text.lower()), self.city_filter),
        )

        category = self.extract_field(full_text, [
            "Item Category",
            "Product Category",
            "Service Category",
        ]) or "GeM Bid"
        if search_keyword:
            category = f"{category} / {search_keyword}"

        return {
            "source": self.source_name,
            "tender_id": bid_no,
            "title": title[:500],
            "department": department[:500],
            "address": address[:2000],
            "state": state[:100],
            "city": city[:150],
            "estimated_value": self.extract_value(full_text),
            "deadline": self.extract_date(full_text),
            "url": url,
            "description": clean_full_text[:5000],
            "category": category[:255],
            "_search_keyword": search_keyword or "",
        }

    def enrich_item_from_pdf(self, item):
        pdf_text = self.extract_pdf_text(item.get("url"))
        if not pdf_text:
            return item

        value = self.extract_value(pdf_text)
        if value:
            item["estimated_value"] = value

        if not item.get("address"):
            item["address"] = self.extract_field(pdf_text, [
                "Buyer Address",
                "Office Address",
                "Consignee Address",
                "Department Address",
                "Address",
            ])[:2000]
        if not item.get("department") or item.get("department") == "GeM":
            pdf_department = self.extract_field(pdf_text, [
                "Department Name",
                "Organisation Name",
                "Organization Name",
                "Ministry/State Name",
                "Ministry / State Name",
                "Buyer Organization",
                "Office Name",
                "Ministry",
            ])
            if not pdf_department:
                pdf_department = self.extract_field(pdf_text, ["Department Name And Address", "Department Name & Address"])
            if pdf_department:
                item["department"] = pdf_department[:500]

        description = self.clean_text((item.get("description") or "") + "\n" + pdf_text)
        item["description"] = description[:5000]
        state, city = extract_location(
            pdf_text,
            state_value=item.get("state", ""),
            city_value=item.get("city", ""),
            configured_states=self.state_filters,
            configured_city=next((value for value in self.city_filters if value in pdf_text.lower()), self.city_filter),
        )
        item["state"] = state[:100]
        item["city"] = city[:150]
        return item

    def scrape(self):
        try:
            bids = self.collect_links_via_http()
            tenders = []
            for bid in bids:
                item = self.parse_detail_page(None, bid)
                if self.authority_matches_item(item) and self.location_matches_item(item):
                    tenders.append(item)
            return tenders
        except requests.RequestException:
            # Retain the browser path as a fallback when GeM's data endpoint is
            # temporarily unavailable but the public listing page still works.
            pass
        try:
            with sync_playwright() as playwright:
                launch_options = {"headless": True, "args": self.browser_args()}
                proxy = self.browser_proxy()
                if proxy:
                    launch_options["proxy"] = proxy
                browser = playwright.chromium.launch(**launch_options)
                page = browser.new_page(
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 Chrome/120 Safari/537.36"
                    ),
                    viewport={"width": 1366, "height": 768},
                )

                try:
                    bids = self.get_bid_links(page)
                    tenders = []
                    for bid in bids:
                        try:
                            item = self.parse_detail_page(page, bid)
                            if self.authority_matches_item(item) and self.location_matches_item(item):
                                tenders.append(item)
                        except Exception:
                            continue
                    return tenders
                finally:
                    browser.close()
        except Exception as e:
            if not isinstance(e, PlaywrightError) and "PlaywrightContextManager" not in str(e):
                raise
            message = str(e) or repr(e)
            if "ERR_CONNECTION_REFUSED" in message or "ERR_CONNECTION_CLOSED" in message or "ERR_CONNECTION_RESET" in message:
                raise RuntimeError(
                    "Chromium started, but the deployed server could not connect to GeM "
                    "at https://bidplus.gem.gov.in/all-bids. This usually means GeM is refusing "
                    "the Railway/cloud server IP or outbound network path. Run scraping from a network "
                    "that can access GeM, or use an approved proxy/static egress and retry. "
                    f"Original error: {message}"
                )
            if "Host system is missing dependencies" in message or "Executable doesn't exist" in message:
                raise RuntimeError(
                    "Playwright could not start Chromium for GeM scraping. On Linux/Railway, use the "
                    "Playwright Docker image or install Chromium system dependencies. "
                    f"Original error: {message}"
                )
            if "Timeout" in message or "timed out" in message.lower():
                raise RuntimeError(
                    "GeM did not finish loading within the allowed time. The run was stopped safely; "
                    "retry when GeM is responsive. "
                    f"Original error: {message}"
                )
            raise RuntimeError(f"GeM browser scrape failed: {message}")
