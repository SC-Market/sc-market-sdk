import json
import os
import sys
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sc_market_sdk import ApiError, PricesFeed, RateLimitError, ScMarketClient, bearer, parse_retry_after  # noqa: E402

FIXTURES = Path(__file__).resolve().parents[2] / "test" / "fixtures"  # shared with the TypeScript tests
TOKEN = "scmp_live_exampleexampleexample"


class FakeTransport:
    """Replays scripted responses and records each request."""

    def __init__(self, *responses):
        self.queue = list(responses)
        self.calls = []

    def __call__(self, method, url, headers, body, timeout):
        self.calls.append({"method": method, "url": url, "headers": dict(headers), "body": body})
        status, fixture, headers_out = self.queue.pop(0)
        raw = (FIXTURES / fixture).read_bytes() if fixture.endswith(".json") else fixture.encode()
        ctype = "application/json; charset=utf-8" if fixture.endswith(".json") else "text/csv"
        return status, dict({"Content-Type": ctype}, **headers_out), raw


class ClientTests(unittest.TestCase):
    def test_bearer(self):
        self.assertEqual(bearer(TOKEN), "Bearer " + TOKEN)
        with self.assertRaisesRegex(ValueError, "Legacy scm_"):
            bearer("scm_abc")
        with self.assertRaises(ValueError):
            ScMarketClient("nope")

    def test_get_me(self):
        t = FakeTransport((200, "v1-me.json", {}))
        me = ScMarketClient(TOKEN, transport=t).get_me()
        self.assertEqual(me["user"]["username"], "example_trader")
        self.assertEqual(t.calls[0]["url"], "https://api.sc-market.space/api/public/v1/me")
        self.assertEqual(t.calls[0]["headers"]["Authorization"], "Bearer " + TOKEN)

    def test_iter_orders(self):
        t = FakeTransport((200, "v1-orders-page1.json", {}), (200, "v1-orders-page2.json", {}))
        sc = ScMarketClient(TOKEN, transport=t)
        orders = list(sc.iter_orders(role="seller", status="not-started"))
        self.assertEqual(len(orders), 3)
        q = parse_qs(urlparse(t.calls[0]["url"]).query)
        self.assertEqual(q, {"role": ["seller"], "status": ["not-started"], "page_size": ["100"], "page": ["1"]})
        self.assertEqual(parse_qs(urlparse(t.calls[1]["url"]).query)["page"], ["2"])

    def test_change_order_status(self):
        t = FakeTransport((200, "v1-order-status.json", {}))
        res = ScMarketClient(TOKEN, transport=t).change_order_status("a/b", {"status": "in-progress"})
        self.assertEqual(res["status"], "in-progress")
        self.assertEqual(t.calls[0]["method"], "POST")
        self.assertTrue(t.calls[0]["url"].endswith("/orders/a%2Fb/status"))
        self.assertEqual(json.loads(t.calls[0]["body"]), {"status": "in-progress"})

    def test_retry_after(self):
        slept = []
        t = FakeTransport((429, "v1-rate-limited.json", {"Retry-After": "2"}), (200, "v1-me.json", {}))
        me = ScMarketClient(TOKEN, transport=t, sleep=slept.append).get_me()
        self.assertEqual(me["token"]["name"], "Discord order feed")
        self.assertEqual(slept, [2.0])

    def test_retry_after_too_long(self):
        t = FakeTransport((429, "v1-rate-limited.json", {"Retry-After": "120"}))
        with self.assertRaises(RateLimitError) as cm:
            ScMarketClient(TOKEN, transport=t, sleep=lambda s: None, max_retry_delay=60).get_me()
        self.assertEqual(cm.exception.code, "RATE_LIMIT_EXCEEDED")
        self.assertEqual(cm.exception.retry_after, 120.0)

    def test_error(self):
        t = FakeTransport((401, "v1-unauthorized.json", {"X-Request-Id": "req-1"}))
        with self.assertRaises(ApiError) as cm:
            ScMarketClient(TOKEN, transport=t).get_order("x")
        self.assertEqual((cm.exception.status, cm.exception.code, cm.exception.request_id), (401, "UNAUTHORIZED", "req-1"))

    def test_prices(self):
        t = FakeTransport((200, "prices-index.json", {}), (200, "prices-item.json", {}), (404, "prices-not-found.json", {}))
        feed = PricesFeed(transport=t, token=TOKEN)
        self.assertEqual(feed.index()["items"][0]["slug"], "dff0ce09--a03-canuto-sniper-rifle")
        self.assertEqual(feed.item("DFF0CE09--a03-canuto-sniper-rifle")["current"]["lowest_ask"], 1000000)
        with self.assertRaises(ApiError) as cm:
            feed.item("nope")
        self.assertEqual(cm.exception.code, "NOT_FOUND")
        for c in t.calls:
            self.assertNotIn("Authorization", c["headers"])

    def test_parse_retry_after(self):
        self.assertEqual(parse_retry_after("5"), 5.0)
        self.assertIsNone(parse_retry_after(None))
        self.assertIsNone(parse_retry_after("soon"))
        from email.utils import parsedate_to_datetime
        now = parsedate_to_datetime("Sun, 01 Nov 2026 00:00:00 GMT").timestamp()
        self.assertEqual(parse_retry_after("Sun, 01 Nov 2026 00:00:30 GMT", now=now), 30.0)


if __name__ == "__main__":
    unittest.main()
