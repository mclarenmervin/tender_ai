from unittest.mock import Mock, patch

from app.alerts import whatsapp_alerts


def test_normalize_whatsapp_phone_supports_indian_and_international_numbers():
    assert whatsapp_alerts.normalize_whatsapp_phone("98765 43210") == "919876543210"
    assert whatsapp_alerts.normalize_whatsapp_phone("+91-98765-43210") == "919876543210"
    assert whatsapp_alerts.normalize_whatsapp_phone("0044 7700 900123") == "447700900123"
    assert whatsapp_alerts.normalize_whatsapp_phone("123") == ""


def test_send_template_uses_one_body_report_parameter():
    response = Mock(ok=True)
    response.json.return_value = {"messages": [{"id": "wamid.test"}]}
    with patch.object(whatsapp_alerts, "WHATSAPP_ACCESS_TOKEN", "token"), \
         patch.object(whatsapp_alerts, "WHATSAPP_PHONE_NUMBER_ID", "phone-id"), \
         patch.object(whatsapp_alerts, "WHATSAPP_TEMPLATE_NAME", "tender_ai_auto_scrape"), \
         patch.object(whatsapp_alerts.requests, "post", return_value=response) as post:
        assert whatsapp_alerts.send_whatsapp_template("+91 98765 43210", "Criteria: Odisha IT") is True

    payload = post.call_args.kwargs["json"]
    assert payload["to"] == "919876543210"
    assert payload["type"] == "template"
    assert payload["template"]["components"][0]["parameters"][0]["text"] == "Criteria: Odisha IT"
