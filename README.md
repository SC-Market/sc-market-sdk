# SC Market SDK

Typed clients for the [SC Market](https://sc-market.space) public API and its public price feed, for TypeScript/JavaScript (`@sc-market/sdk`) and Python (`sc_market_sdk`). SC Market is a Star Citizen player marketplace; all prices are in aUEC, the in-game currency.

- **Developers page:** https://sc-market.space/developers
- **API guide (tokens, scopes, examples):** https://sc-market.space/guides/discord/api-tokens
- **OpenAPI spec:** https://api.sc-market.space/api/public/v1/openapi.json
- **Price feed index:** https://api.sc-market.space/api/public/prices/index.json

The SDK and the API are free to use.

## What's covered

**Public API v1** (`https://api.sc-market.space/api/public/v1`). It needs an API token. Generated from the OpenAPI spec:

| Method | Endpoint | Scope |
| --- | --- | --- |
| `getMe()` | `GET /me` | any |
| `listShops()`, `iterateShops()` | `GET /shops` | `shops:read` |
| `getShop(shop)` | `GET /shops/{shop}` | `shops:read` |
| `listShopListings(shop)`, `iterateShopListings(shop)` | `GET /shops/{shop}/listings` | `listings:read` |
| `getListing(id)` | `GET /listings/{listingId}` | `listings:read` |
| `getListingStock(id)`, `iterateListingStock(id)` | `GET /listings/{listingId}/stock` | `stock:read` |
| `listOrders()`, `iterateOrders()` | `GET /orders` | `orders:read` |
| `getOrder(id)` | `GET /orders/{orderId}` | `orders:read` |
| `changeOrderStatus(id, { status })` | `POST /orders/{orderId}/status` | `orders:write` |
| `listOffers()`, `iterateOffers()` | `GET /offers` | `offers:read` |
| `getOffer(id)` | `GET /offers/{offerId}` | `offers:read` |
| `acceptOffer(id)`, `declineOffer(id)` | `POST /offers/{offerId}/accept`, `/decline` | `offers:write` |

Python uses the same names in snake_case: `get_me()`, `iter_orders()`, `change_order_status()` and so on.

**Price feed** (`https://api.sc-market.space/api/public/prices`). No token needed:

| Method | Endpoint |
| --- | --- |
| `index()` | `GET /index.json`: every priced item in the latest daily snapshot |
| `indexCsv()` / `index_csv()` | `GET /index.csv` |
| `indexMarkdown()` / `index_markdown()` | `GET /index.md` |
| `item(slug)` | `GET /{slug}.json`: one item's current asks, 30-day trend and recent sales |

The item document types are generated from the site API spec, which describes the same document (`PriceOracleItem`). The index has no published schema, so its types are written by hand from the live envelope (`src/prices.ts`, `python/src/sc_market_sdk/prices.py`).

## Quick start: TypeScript / JavaScript

Node 18 or later, or any runtime with `fetch` (Deno, Bun, Cloudflare Workers). The package has no runtime dependencies, and it ships both ESM and CommonJS builds.

```sh
npm install @sc-market/sdk   # once it's published; until then, see "Use it before it's on npm"
```

```ts
import { ScMarketClient, PricesFeed, ApiError } from "@sc-market/sdk"

// Create a token on sc-market.space under Settings → API tokens. Keep it on a server.
const sc = new ScMarketClient({ token: process.env.SC_MARKET_TOKEN! })

const me = await sc.getMe()
console.log(`Hi ${me.user.display_name}, this token can: ${me.token.scopes.join(", ")}`)

// Pagination: iterate… methods fetch page after page (100 items per request).
for await (const order of sc.iterateOrders({ role: "seller", status: "not-started" })) {
  console.log(order.order_id, order.title, order.total_price)
}

try {
  await sc.changeOrderStatus(orderId, { status: "in-progress" })
} catch (e) {
  if (e instanceof ApiError) console.error(e.status, e.code, e.message, e.requestId)
}

// The price feed: no token.
const prices = new PricesFeed()
const index = await prices.index()
const doc = await prices.item(index.items[0].slug)
console.log(doc.summary)
```

CommonJS works the same way: `const { ScMarketClient } = require("@sc-market/sdk")`.

**Bearer auth helper.** If you use your own HTTP client, `bearer(token)` returns the `Authorization` header value and `authHeaders(token)` returns the headers object. Both throw on anything that isn't an `scmp_` token. Legacy `scm_` tokens are refused by the public API.

**Options:** `new ScMarketClient({ token, baseUrl, fetch, maxRetries, maxRetryDelay, timeout, headers, onRetry })`. Setting a `User-Agent` in `headers` that names your tool helps if anything goes wrong.

## Quick start: Python

Python 3.8 or later. The package uses only the standard library (`urllib`).

```sh
pip install sc-market-sdk   # once it's published; until then: pip install ./python
```

```python
import os
from sc_market_sdk import ScMarketClient, PricesFeed, ApiError

sc = ScMarketClient(os.environ["SC_MARKET_TOKEN"])
print(sc.get_me()["user"]["display_name"])

for order in sc.iter_orders(role="seller", status="not-started"):
    print(order["order_id"], order["title"], order["total_price"])

doc = PricesFeed().item("dff0ce09")  # a slug, its 8-hex prefix or the item UUID
print(doc["summary"])
```

Responses are plain dicts, typed with `TypedDict`s generated from the spec, so editors and type checkers know their fields. `bearer()` and `auth_headers()` work the same way as in TypeScript.

## Rate limits and retries

Public API v1, as documented by the API:

| Bucket | Limit |
| --- | --- |
| Per token, reads | 120 a minute, bursts of 30 per 10 seconds |
| Per token, writes | 30 a minute |
| Per account (all its tokens) | 300 a minute |
| Invalid tokens, per IP address | 20 per 15 minutes, then 429 |

When the API is busy it answers `503 SERVICE_UNAVAILABLE` with `Retry-After: 5`.

Price feed: 60 requests a minute per IP address. Responses are cached at the edge for 15 minutes, and the numbers change once a day (a daily UTC snapshot), so cache them on your side as well.

On a `429` or `503`, the clients wait the number of seconds in `Retry-After` and retry, up to `maxRetries` times (3 by default). If `Retry-After` is longer than `maxRetryDelay` (60 seconds by default), they don't sleep: they throw a `RateLimitError` (`retryAfter` is in seconds), so a script never hangs. A 429 is sent before the request does anything, and a 503 means the API was too busy to run it. Retrying a write is harmless: once an offer is answered or an order is closed, a repeated accept, decline or status change answers `409 CONFLICT` instead of acting twice. Other errors throw `ApiError` with the API's `code` (`INSUFFICIENT_SCOPE`, `NOT_FOUND`, `CONFLICT`…), `message`, `details` and the `X-Request-Id` as `requestId`.

## Examples

Build once first (`npm install && npm run build`). After that, the examples import `@sc-market/sdk` from this checkout.

- [`examples/discord-new-orders.mjs`](examples/discord-new-orders.mjs) posts your shop's new orders to a Discord channel webhook. Scope: `orders:read`.
- [`examples/sync-stock-from-csv.mjs`](examples/sync-stock-from-csv.mjs) compares a stock CSV (`listing_id,quantity`) with your listings' stock. Scope: `stock:read`. The public API can read stock but not change it yet, so the script lists what differs, with a link to each listing's stock manager.
- [`examples/price-check.mjs`](examples/price-check.mjs) is a price-check CLI that uses the public feed: `node examples/price-check.mjs canuto`.
- [`python/examples/price_check.py`](python/examples/price_check.py) and [`python/examples/new_orders.py`](python/examples/new_orders.py) are the same ideas in Python.

## Data licence for the feeds

The price feed's data is published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). You can use it, including commercially, as long as you credit it:

> Data: SC Market (sc-market.space)

Game data © Cloud Imperium Games. SC Market is an unofficial fan site, not affiliated with the Cloud Imperium group of companies. The prices are asking prices of SC Market player listings (aUEC per unit), not in-game terminal prices. Each document's `methodology` explains what is counted.

The SDK code is MIT-licensed (see [LICENSE](LICENSE)).

## Regenerating when the API changes

```sh
npm run generate:check   # exit 1 if the live specs differ from openapi/
npm run generate         # fetch the live specs, update openapi/ and regenerate
npm test                 # build + TypeScript tests
cd python && python3 -m unittest discover -s tests   # Python tests
```

`npm run generate` fetches `https://api.sc-market.space/api/public/v1/openapi.json`, plus the price document schemas from `https://api.sc-market.space/api/v2/openapi.json`, and saves them in `openapi/`. It then rewrites `src/generated/*` and `python/src/sc_market_sdk/_types.py`, `_operations.py` and `_prices_types.py`. Don't edit generated files by hand. `npm run generate:offline` regenerates from the saved specs. The generator is `scripts/lib/codegen.mjs` (no dependencies), shared with [sc-orgs-sdk](https://github.com/SC-Market/sc-orgs-sdk).

Tests replay fixtures from `test/fixtures/` and never call the live API.

## Publishing (maintainers)

Nothing is published automatically, and there is no CI. To release:

1. Bump the version in `package.json`, `python/pyproject.toml` and `python/src/sc_market_sdk/_version.py`.
2. `npm run generate:check`, then `npm test` and the Python tests.
3. **npm:** log in with `npm login`, as an account in the `@sc-market` npm organization (create the org first if it doesn't exist). Check the contents with `npm pack --dry-run`, then run `npm publish --access public`. `prepublishOnly` runs the build and the tests.
4. **PyPI:** `cd python && python3 -m pip install --upgrade build twine && python3 -m build && python3 -m twine upload dist/*`. Twine asks for a PyPI API token; the username is `__token__`.
5. Tag the release: `git tag v0.1.0 && git push --tags`.

### Use it before it's on npm

`npm install github:SC-Market/sc-market-sdk` doesn't build `dist/`. Instead, clone this repo, run `npm install && npm run build && npm pack`, then run `npm install /path/to/sc-market-sdk-0.1.0.tgz` in your project. For Python: `pip install ./python`.

---

[SC Market](https://sc-market.space) · [Developers](https://sc-market.space/developers) · [Help & Guides](https://sc-market.space/guides) · Sister site: [SC Orgs](https://sc-orgs.space)
