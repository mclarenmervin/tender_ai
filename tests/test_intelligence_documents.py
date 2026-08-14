import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from app.main import tender_document_intelligence_item


class IntelligenceDocumentMappingTests(unittest.TestCase):
    def test_document_uses_created_at_and_status_fields(self):
        created_at = datetime(2026, 8, 14, 10, 30, tzinfo=timezone.utc)
        doc = SimpleNamespace(
            id=7,
            file_path="uploads/results/result.pdf",
            url=None,
            document_type="result_pdf",
            status="extracted",
            created_at=created_at,
        )
        item = tender_document_intelligence_item(doc)
        self.assertEqual(item["file_name"], "result.pdf")
        self.assertEqual(item["extraction_status"], "extracted")
        self.assertEqual(item["uploaded_at"], created_at.isoformat())

    def test_url_query_is_removed_from_display_name(self):
        doc = SimpleNamespace(
            id=8,
            file_path=None,
            url="https://example.test/files/bid.pdf?download=1",
            document_type=None,
            status=None,
            created_at=None,
        )
        item = tender_document_intelligence_item(doc)
        self.assertEqual(item["file_name"], "bid.pdf")
        self.assertEqual(item["extraction_status"], "pending")
        self.assertEqual(item["uploaded_at"], "")

    def test_missing_source_gets_stable_fallback_name(self):
        doc = SimpleNamespace(
            id=9,
            file_path=None,
            url=None,
            document_type="raw_bid",
            status="pending",
            created_at=None,
        )
        self.assertEqual(tender_document_intelligence_item(doc)["file_name"], "Document 9")


if __name__ == "__main__":
    unittest.main()
