import unittest

from app.ai_engine.procurement_anomaly import calculate_price_gap_metrics, price_similarity_risk


class PriceSimilarityRiskTests(unittest.TestCase):
    def test_document_boundary_bands(self):
        cases = [
            (0, "very_high"),
            (0.49, "very_high"),
            (0.5, "very_high"),
            (0.51, "high"),
            (2, "high"),
            (2.01, "medium"),
            (5, "medium"),
            (5.01, "low"),
            (25, "low"),
        ]
        for gap, expected in cases:
            with self.subTest(gap=gap):
                self.assertEqual(price_similarity_risk(gap), expected)

    def test_invalid_gap_has_no_risk(self):
        self.assertIsNone(price_similarity_risk(None))
        self.assertIsNone(price_similarity_risk(-0.01))


class PriceGapMetricTests(unittest.TestCase):
    def test_complete_l1_l2_l3_calculation(self):
        result = calculate_price_gap_metrics(100, 101, 102)
        self.assertEqual(result["l1_l2_gap_percent"], 1)
        self.assertEqual(result["l2_l3_gap_percent"], 1)
        self.assertEqual(result["cluster_spread_percent"], 2)
        self.assertEqual(result["risk_level"], "high")
        self.assertIn("not proof of wrongdoing", result["explanation"])

    def test_very_narrow_gap_is_not_misclassified_as_low(self):
        result = calculate_price_gap_metrics(10000, 10050)
        self.assertEqual(result["l1_l2_gap_percent"], 0.5)
        self.assertEqual(result["risk_level"], "very_high")

    def test_large_gap_is_low_similarity_risk(self):
        result = calculate_price_gap_metrics(100, 125)
        self.assertEqual(result["risk_level"], "low")

    def test_missing_l3_is_supported(self):
        result = calculate_price_gap_metrics(100, 103)
        self.assertIsNone(result["l2_l3_gap_percent"])
        self.assertIsNone(result["cluster_spread_percent"])
        self.assertEqual(result["risk_level"], "medium")

    def test_invalid_or_out_of_order_prices_are_rejected(self):
        self.assertIsNone(calculate_price_gap_metrics(0, 100))
        self.assertIsNone(calculate_price_gap_metrics(100, 99))
        self.assertIsNone(calculate_price_gap_metrics(100, 101, 100.5))
        self.assertIsNone(calculate_price_gap_metrics("bad", 101))


if __name__ == "__main__":
    unittest.main()
