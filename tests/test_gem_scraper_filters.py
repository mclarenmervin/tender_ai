import unittest
from unittest.mock import patch

from app.scraper.gem_scraper import GemScraper


class GemScraperFilterTests(unittest.TestCase):
    def test_location_discovery_still_requires_configured_authority(self):
        scraper = GemScraper(max_bids=10, states=["Odisha"], authorities=["Materials"])
        item = {"department": "Public Works Department", "state": "Odisha", "description": "Odisha"}
        with patch.object(scraper, "collect_links_via_advanced_search", return_value=[]), \
             patch.object(scraper, "collect_links_via_location_search", return_value=[{"bid_no": "GEM/2026/B/1", "match_scope": "location"}]), \
             patch.object(scraper, "parse_detail_page", return_value=item):
            self.assertEqual(scraper.scrape(), [])


    def test_authority_discovery_still_requires_configured_location(self):
        scraper = GemScraper(max_bids=10, states=["Odisha"], authorities=["Materials"])
        item = {"department": "Ministry of Mines / Materials", "state": "Gujarat", "description": "Gujarat"}
        with patch.object(scraper, "collect_links_via_advanced_search", return_value=[{"bid_no": "GEM/2026/B/2", "match_scope": "authority"}]), \
             patch.object(scraper, "collect_links_via_location_search", return_value=[]), \
             patch.object(scraper, "parse_detail_page", return_value=item):
            self.assertEqual(scraper.scrape(), [])


if __name__ == "__main__":
    unittest.main()
