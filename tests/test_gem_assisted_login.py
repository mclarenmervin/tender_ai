import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from app import main


class GemAssistedLoginTests(unittest.IsolatedAsyncioTestCase):
    async def asyncTearDown(self):
        main.GEM_ASSISTED_SESSIONS.clear()

    async def test_navigation_updates_ready_state(self):
        page = AsyncMock()
        main.GEM_ASSISTED_SESSIONS[7] = {"page": page, "session_id": "test"}
        with patch.object(main, "fill_gem_login_if_possible", AsyncMock(return_value=["user ID"])):
            await main.navigate_gem_assisted_session(7, "https://example.test", "user", "password")
        session = main.GEM_ASSISTED_SESSIONS[7]
        self.assertEqual(session["navigation_status"], "ready")
        self.assertEqual(session["filled"], ["user ID"])
        page.goto.assert_awaited_once_with("https://example.test", wait_until="commit", timeout=30000)

    async def test_navigation_failure_is_reported_without_destroying_viewer(self):
        page = AsyncMock()
        page.goto.side_effect = RuntimeError("SSO timeout")
        main.GEM_ASSISTED_SESSIONS[8] = {"page": page, "session_id": "test"}
        await main.navigate_gem_assisted_session(8, "https://example.test", "user", "password")
        session = main.GEM_ASSISTED_SESSIONS[8]
        self.assertEqual(session["navigation_status"], "failed")
        self.assertIn("SSO timeout", session["navigation_error"])


if __name__ == "__main__":
    unittest.main()
