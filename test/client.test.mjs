import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { ApiError, PricesFeed, RateLimitError, ScMarketClient, bearer, parseRetryAfter } from "../dist/esm/index.js"
import { fakeFetch } from "./helpers.mjs"

const TOKEN = "scmp_live_exampleexampleexample"

test("bearer() accepts scmp_ tokens and refuses legacy scm_ ones", () => {
  assert.equal(bearer(TOKEN), `Bearer ${TOKEN}`)
  assert.throws(() => bearer("scm_abc"), /Legacy scm_ tokens/)
  assert.throws(() => bearer(""), TypeError)
  assert.throws(() => new ScMarketClient({ token: "nope" }), TypeError)
})

test("getMe() sends the token and unwraps data", async () => {
  const fetch = fakeFetch([{ body: "v1-me.json" }])
  const sc = new ScMarketClient({ token: TOKEN, fetch })
  const me = await sc.getMe()
  assert.equal(me.user.username, "example_trader")
  assert.deepEqual(me.token.scopes, ["shops:read", "orders:read"])
  assert.equal(fetch.calls[0].url, "https://api.sc-market.space/api/public/v1/me")
  assert.equal(fetch.calls[0].headers.Authorization, `Bearer ${TOKEN}`)
})

test("iterateOrders() walks every page with the query", async () => {
  const fetch = fakeFetch([{ body: "v1-orders-page1.json" }, { body: "v1-orders-page2.json" }])
  const sc = new ScMarketClient({ token: TOKEN, fetch })
  const ids = []
  for await (const order of sc.iterateOrders({ role: "seller", status: "not-started" })) ids.push(order.order_id)
  assert.equal(ids.length, 3)
  assert.equal(fetch.calls.length, 2)
  const first = new URL(fetch.calls[0].url)
  assert.equal(first.pathname, "/api/public/v1/orders")
  assert.equal(first.searchParams.get("role"), "seller")
  assert.equal(first.searchParams.get("status"), "not-started")
  assert.equal(first.searchParams.get("page_size"), "100")
  assert.equal(first.searchParams.get("page"), "1")
  assert.equal(new URL(fetch.calls[1].url).searchParams.get("page"), "2")
})

test("changeOrderStatus() posts a JSON body and encodes the path", async () => {
  const fetch = fakeFetch([{ body: "v1-order-status.json" }])
  const sc = new ScMarketClient({ token: TOKEN, fetch })
  const res = await sc.changeOrderStatus("a/b", { status: "in-progress" })
  assert.equal(res.status, "in-progress")
  assert.equal(fetch.calls[0].method, "POST")
  assert.equal(fetch.calls[0].url, "https://api.sc-market.space/api/public/v1/orders/a%2Fb/status")
  assert.equal(fetch.calls[0].headers["Content-Type"], "application/json")
  assert.deepEqual(JSON.parse(fetch.calls[0].body), { status: "in-progress" })
})

test("a 429 is retried after Retry-After", async () => {
  const fetch = fakeFetch([
    { status: 429, body: "v1-rate-limited.json", headers: { "retry-after": "0" } },
    { body: "v1-me.json" },
  ])
  const retries = []
  const sc = new ScMarketClient({ token: TOKEN, fetch, onRetry: (i) => retries.push(i) })
  const me = await sc.getMe()
  assert.equal(me.user.user_id, "7f3c2a10-0000-4000-8000-000000000001")
  assert.equal(retries.length, 1)
  assert.equal(retries[0].status, 429)
  assert.equal(retries[0].delaySeconds, 0)
})

test("a Retry-After above maxRetryDelay fails fast with RateLimitError", async () => {
  const fetch = fakeFetch([{ status: 429, body: "v1-rate-limited.json", headers: { "retry-after": "120" } }])
  const sc = new ScMarketClient({ token: TOKEN, fetch, maxRetryDelay: 60 })
  await assert.rejects(sc.getMe(), (e) => {
    assert.ok(e instanceof RateLimitError)
    assert.equal(e.code, "RATE_LIMIT_EXCEEDED")
    assert.equal(e.retryAfter, 120)
    assert.deepEqual(e.details, { retry_after_seconds: 2 })
    return true
  })
  assert.equal(fetch.remaining(), 0)
})

test("errors carry the API's code, message and request id", async () => {
  const fetch = fakeFetch([{ status: 401, body: "v1-unauthorized.json", headers: { "x-request-id": "req-1" } }])
  const sc = new ScMarketClient({ token: TOKEN, fetch })
  await assert.rejects(sc.getOrder("x"), (e) => {
    assert.ok(e instanceof ApiError && !(e instanceof RateLimitError))
    assert.equal(e.status, 401)
    assert.equal(e.code, "UNAUTHORIZED")
    assert.equal(e.requestId, "req-1")
    assert.match(e.message, /API token is required/)
    return true
  })
})

test("the price feed never sends a token", async () => {
  const fetch = fakeFetch([{ body: "prices-index.json" }, { body: "prices-item.json" }])
  const prices = new PricesFeed({ fetch, token: TOKEN })
  const index = await prices.index()
  assert.equal(index.currency, "aUEC")
  assert.equal(index.items[0].slug, "dff0ce09--a03-canuto-sniper-rifle")
  const doc = await prices.item("DFF0CE09--A03-Canuto-Sniper-Rifle")
  assert.equal(doc.current.lowest_ask, 1000000)
  assert.equal(fetch.calls[1].url, "https://api.sc-market.space/api/public/prices/dff0ce09--a03-canuto-sniper-rifle.json")
  for (const c of fetch.calls) assert.equal(c.headers.Authorization, undefined)
})

test("an unknown item is a NOT_FOUND ApiError; CSV comes back as text", async () => {
  const fetch = fakeFetch([
    { status: 404, body: "prices-not-found.json" },
    { body: "slug,name\nx,y\n", type: "text/csv; charset=utf-8" },
  ])
  const prices = new PricesFeed({ fetch })
  await assert.rejects(prices.item("nope"), (e) => e instanceof ApiError && e.code === "NOT_FOUND")
  assert.equal(await prices.indexCsv(), "slug,name\nx,y\n")
})

test("parseRetryAfter() reads seconds and HTTP dates", () => {
  assert.equal(parseRetryAfter("5"), 5)
  assert.equal(parseRetryAfter(null), undefined)
  assert.equal(parseRetryAfter("soon"), undefined)
  const now = Date.parse("2026-11-01T00:00:00Z")
  assert.equal(parseRetryAfter("Sun, 01 Nov 2026 00:00:30 GMT", now), 30)
})

test("the CommonJS build loads with require()", () => {
  const require = createRequire(import.meta.url)
  const cjs = require("../dist/cjs/index.js")
  assert.equal(typeof cjs.ScMarketClient, "function")
  assert.equal(typeof cjs.PricesFeed, "function")
  assert.equal(cjs.bearer(TOKEN), `Bearer ${TOKEN}`)
})
