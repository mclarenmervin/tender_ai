import unittest

from app.scraper.gem_scraper import GemScraper


class GemEmdFilterTests(unittest.TestCase):
    def test_extracts_stated_emd_amount(self):
        self.assertEqual(GemScraper().extract_emd_amount("EMD Amount: Rs. 25,000"), 25000)

    def test_zero_criterion_includes_nil_and_unspecified_emd(self):
        scraper = GemScraper(emd_amount=0)
        self.assertTrue(scraper.emd_matches_item({"emd_amount": 0}))
        self.assertTrue(scraper.emd_matches_item({"emd_amount": None}))
        self.assertFalse(scraper.emd_matches_item({"emd_amount": 1}))

    def test_positive_criterion_is_a_maximum(self):
        scraper = GemScraper(emd_amount=10000)
        self.assertTrue(scraper.emd_matches_item({"emd_amount": 10000}))
        self.assertTrue(scraper.emd_matches_item({"emd_amount": 9999}))
        self.assertFalse(scraper.emd_matches_item({"emd_amount": 10001}))
        self.assertFalse(scraper.emd_matches_item({"emd_amount": None}))


if __name__ == "__main__":
    unittest.main()
