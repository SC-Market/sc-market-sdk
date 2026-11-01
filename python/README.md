# sc-market-sdk (Python)

A typed Python client for the [SC Market](https://sc-market.space) public API and its public price feed. It has no dependencies (standard library only) and needs Python 3.8 or later.

```python
import os
from sc_market_sdk import ScMarketClient, PricesFeed

sc = ScMarketClient(os.environ["SC_MARKET_TOKEN"])   # scmp_live_… (Settings → API tokens)
for order in sc.iter_orders(role="seller", status="not-started"):
    print(order["order_id"], order["title"])

print(PricesFeed().index()["count"], "priced items")  # no token needed
```

- Every operation of the public API v1. Method names come from the OpenAPI spec (`get_me`, `list_orders`, `change_order_status`…), and the responses are typed with generated `TypedDict`s.
- `iter_…` methods fetch every page for you.
- On 429 and 503, the client waits `Retry-After` and retries (`max_retries=3`, `max_retry_delay=60`). Otherwise it raises `RateLimitError`.
- `bearer(token)` and `auth_headers(token)` build the header for your own HTTP client.

Docs: [Developers](https://sc-market.space/developers) · [API guide](https://sc-market.space/guides/discord/api-tokens) · [OpenAPI spec](https://api.sc-market.space/api/public/v1/openapi.json) · [Source, rate limits and examples](https://github.com/SC-Market/sc-market-sdk)

The price feed's data is published under CC BY 4.0. Credit it as "Data: SC Market (sc-market.space)". Game data © Cloud Imperium Games. The SDK is MIT-licensed.
