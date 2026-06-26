import io
import os
import re
from datetime import date, datetime
from urllib.parse import urljoin

import requests
from pypdf import PdfReader
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from app.scraper.base_scraper import BaseScraper


class GemScraper(BaseScraper):
    source_name = "GeM"
    base_url = "https://bidplus.gem.gov.in"
    list_url = "https://bidplus.gem.gov.in/all-bids"

    def __init__(self, keywords=None, max_bids=20, state=None, states=None, city=None):
        self.keywords = [keyword.strip() for keyword in (keywords or []) if keyword and keyword.strip()]
        self.max_bids = max_bids
        state_values = states if states is not None else ([state] if state else [])
        self.state_filters = [
            self.clean_text(value).lower()
            for value in state_values
            if self.clean_text(value)
        ]
        self.city_filter = self.clean_text(city).lower()

    def clean_text(self, text):
        return re.sub(r"\s+", " ", text or "").strip()

    def extract_bid_no(self, text):
        match = re.search(r"GEM/\d{4}/B/\d+", text or "")
        return match.group(0) if match else None

    def extract_bid_numbers(self, text):
        return list(dict.fromkeys(re.findall(r"GEM/\d{4}/B/\d+", text or "")))

    def extract_date(self, text):
        for pattern in [r"(\d{2}-\d{2}-\d{4})", r"(\d{2}/\d{2}/\d{4})"]:
            match = re.search(pattern, text or "")
            if match:
                raw = match.group(1)
                for fmt in ("%d-%m-%Y", "%d/%m/%Y"):
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
                if label.lower() in line.lower():
                    if ":" in line:
                        value = line.split(":", 1)[1].strip()
                        if value:
                            return value
                    if i + 1 < len(lines):
                        return lines[i + 1]
        return ""

    def location_enabled(self):
        return bool(self.state_filters or self.city_filter)

    def location_search_suffix(self):
        return " ".join(self.state_filters + ([self.city_filter] if self.city_filter else []))

    def location_matches(self, text):
        if not self.location_enabled():
            return True
        haystack = self.clean_text(text).lower()
        if self.state_filters and not any(state in haystack for state in self.state_filters):
            return False
        if self.city_filter and self.city_filter not in haystack:
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
        return True

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

    def apply_keyword_search(self, page, keyword):
        if not keyword:
            return

        field = page.locator("#searchBid")
        if field.count() == 0:
            raise RuntimeError("GeM keyword search input #searchBid was not found")

        field.fill(keyword)
        page.locator("#searchBidRA").click()
        page.wait_for_timeout(4500)

    def collect_links_from_page(self, page):
        page.goto(self.list_url, wait_until="domcontentloaded", timeout=60000)

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
            page.goto(self.list_url, wait_until="domcontentloaded", timeout=60000)
            return self.collect_links_across_pages(page)

        all_links = []
        seen = set()

        for keyword in self.keywords:
            if len(all_links) >= self.max_bids:
                break
            page.goto(self.list_url, wait_until="domcontentloaded", timeout=60000)
            self.apply_keyword_search(page, keyword)
            links = self.collect_links_across_pages(page)

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

    def collect_links_across_pages(self, page):
        all_links = []
        seen = set()

        while len(all_links) < self.max_bids:
            links = self.collect_links_from_current_page(page)
            for link in links:
                if link["bid_no"] in seen:
                    continue
                seen.add(link["bid_no"])
                all_links.append(link)
                if len(all_links) >= self.max_bids:
                    break

            if len(all_links) >= self.max_bids:
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

        department = self.extract_field(full_text, [
            "Department Name",
            "Organisation Name",
            "Ministry",
            "Buyer Organization",
            "Office Name",
        ]) or "GeM"

        state = self.extract_field(full_text, [
            "State Name",
            "State",
            "Consignee State",
            "Buyer State",
        ]) or (self.state_filters[0].title() if len(self.state_filters) == 1 else "") or "India"

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
            "state": state[:100],
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

        description = self.clean_text((item.get("description") or "") + "\n" + pdf_text)
        item["description"] = description[:5000]
        return item

    def scrape(self):
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
                            if self.location_matches_item(item):
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
            raise RuntimeError(
                "Playwright could not start Chromium for GeM scraping. "
                "Run 'venv\\Scripts\\playwright.exe install chromium' and retry. "
                f"Original error: {message}"
            )
