import unittest

from app.ai_engine.procurement_anomaly import calculate_award_ratio_metrics, calculate_competition_metrics, calculate_price_gap_metrics, price_similarity_risk


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


class CompetitionMetricTests(unittest.TestCase):
    def test_one_qualified_bidder_is_very_high_risk(self):
        result = calculate_competition_metrics(4, 1, 3)
        self.assertEqual(result["competition_ratio_percent"], 25)
        self.assertEqual(result["disqualification_rate_percent"], 75)
        self.assertEqual(result["risk_level"], "very_high")

    def test_two_qualified_bidders_are_high_risk(self):
        result = calculate_competition_metrics(5, 2, 3)
        self.assertEqual(result["risk_level"], "high")

    def test_disqualification_rate_boundary_is_strictly_above_sixty(self):
        at_boundary = calculate_competition_metrics(5, 2, 3)
        above_boundary = calculate_competition_metrics(5, 1, 4)
        self.assertEqual(at_boundary["disqualification_rate_percent"], 60)
        self.assertNotIn("above 60%", at_boundary["explanation"])
        self.assertIn("above 60%", above_boundary["explanation"])

    def test_normal_competition_is_low_risk(self):
        result = calculate_competition_metrics(5, 4, 1)
        self.assertEqual(result["competition_ratio_percent"], 80)
        self.assertEqual(result["disqualification_rate_percent"], 20)
        self.assertEqual(result["risk_level"], "low")

    def test_partial_evaluation_data_preserves_unknown_values(self):
        result = calculate_competition_metrics(2)
        self.assertIsNone(result["competition_ratio_percent"])
        self.assertIsNone(result["disqualification_rate_percent"])
        self.assertEqual(result["risk_level"], "medium")

    def test_invalid_or_contradictory_counts_are_rejected(self):
        self.assertIsNone(calculate_competition_metrics(0, 0, 0))
        self.assertIsNone(calculate_competition_metrics(3, 4, 0))
        self.assertIsNone(calculate_competition_metrics(3, 2, 2))
        self.assertIsNone(calculate_competition_metrics("bad", 1, 1))


class AwardRatioMetricTests(unittest.TestCase):
    def test_above_estimate_requires_high_risk_review(self):
        result = calculate_award_ratio_metrics(100, 101)
        self.assertEqual(result["award_ratio_percent"], 101)
        self.assertEqual(result["saving_percent"], -1)
        self.assertEqual(result["risk_level"], "high")

    def test_exact_estimate_is_close_to_estimate(self):
        result = calculate_award_ratio_metrics(100, 100)
        self.assertEqual(result["risk_level"], "medium")
        self.assertEqual(result["saving_percent"], 0)

    def test_ninety_five_percent_boundary_is_close_to_estimate(self):
        result = calculate_award_ratio_metrics(100, 95)
        self.assertEqual(result["award_ratio"], 0.95)
        self.assertEqual(result["risk_level"], "medium")

    def test_eighty_to_below_ninety_five_is_moderate_saving(self):
        result = calculate_award_ratio_metrics(100, 94.99)
        self.assertEqual(result["risk_level"], "low")
        self.assertIn("moderate saving", result["interpretation"])
        boundary = calculate_award_ratio_metrics(100, 80)
        self.assertIn("moderate saving", boundary["interpretation"])

    def test_below_eighty_is_competitive_saving(self):
        result = calculate_award_ratio_metrics(100, 79.99)
        self.assertEqual(result["risk_level"], "low")
        self.assertIn("competitive saving", result["interpretation"])

    def test_invalid_values_are_rejected(self):
        self.assertIsNone(calculate_award_ratio_metrics(0, 10))
        self.assertIsNone(calculate_award_ratio_metrics(100, 0))
        self.assertIsNone(calculate_award_ratio_metrics("bad", 10))


if __name__ == "__main__":
    unittest.main()
