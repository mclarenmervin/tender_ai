import unittest
from unittest.mock import patch

from app.scraper.gem_scraper import GemScraper
from app.scraper.runner import run_scrapers


class GemScraperFilterTests(unittest.TestCase):
    def test_location_discovery_still_requires_configured_authority(self):
        scraper = GemScraper(max_bids=10, states=["Odisha"], authorities=["Materials"])
        item = {"department": "Public Works Department", "state": "Odisha", "description": "Odisha"}
        with patch.object(scraper, "collect_links_via_profile_search", return_value=None), \
             patch.object(scraper, "collect_links_via_advanced_search", return_value=[]), \
             patch.object(scraper, "collect_links_via_location_search", return_value=[{"bid_no": "GEM/2026/B/1", "match_scope": "location"}]), \
             patch.object(scraper, "parse_detail_page", return_value=item):
            self.assertEqual(scraper.scrape(), [])


    def test_authority_discovery_still_requires_configured_location(self):
        scraper = GemScraper(max_bids=10, states=["Odisha"], authorities=["Materials"])
        item = {"department": "Ministry of Mines / Materials", "state": "Gujarat", "description": "Gujarat"}
        with patch.object(scraper, "collect_links_via_profile_search", return_value=None), \
             patch.object(scraper, "collect_links_via_advanced_search", return_value=[{"bid_no": "GEM/2026/B/2", "match_scope": "authority"}]), \
             patch.object(scraper, "collect_links_via_location_search", return_value=[]), \
             patch.object(scraper, "parse_detail_page", return_value=item):
            self.assertEqual(scraper.scrape(), [])

    def test_persistence_boundary_rejects_wrong_department(self):
        scraper = GemScraper(states=["Odisha"], authorities=["Materials"])
        wrong = {"department": "Indian Railways", "state": "Odisha", "description": "Odisha"}
        with patch.object(scraper, "scrape", return_value=[wrong]):
            db = unittest.mock.MagicMock()
            inserted, details = run_scrapers(db, [scraper], return_details=True, user_id=1)
        self.assertEqual(inserted, 0)
        self.assertIn("Fetched 0 tenders", details[0]["message"])


if __name__ == "__main__":
    unittest.main()
