// Post your shop's new orders to a Discord channel (through a channel webhook).
//
//   SC_MARKET_TOKEN=scmp_live_…  DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/…  node examples/discord-new-orders.mjs
//
// Token scope: orders:read. Optional: SC_MARKET_SHOP (a shop slug or id) to watch only one shop.
// Run it every few minutes (cron, a systemd timer, a scheduled task). It remembers what it
// already posted in examples/.state-orders.json, so each order is posted once.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { ScMarketClient } from "@sc-market/sdk"

const STATE_FILE = new URL("./.state-orders.json", import.meta.url)
const webhook = process.env.DISCORD_WEBHOOK_URL
if (!webhook) throw new Error("Set DISCORD_WEBHOOK_URL (Channel settings → Integrations → Webhooks)")

const sc = new ScMarketClient({
  token: process.env.SC_MARKET_TOKEN,
  headers: { "User-Agent": "discord-new-orders-example (+https://github.com/SC-Market/sc-market-sdk)" },
})

// First run: look back one day. Later runs: since the previous run.
const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, "utf8"))
  : { since: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), posted: [] }
const startedAt = new Date().toISOString()

const fresh = []
for await (const order of sc.iterateOrders({
  role: "seller",
  status: "not-started",
  shop: process.env.SC_MARKET_SHOP,
  updated_since: state.since,
  sort_by: "created_at",
  sort_order: "asc",
})) {
  if (!state.posted.includes(order.order_id)) fresh.push(order)
}

for (const order of fresh) {
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: `New order: ${order.title}`.slice(0, 256),
          url: `https://sc-market.space/order/${order.order_id}`,
          fields: [
            { name: "Buyer", value: order.buyer_username, inline: true },
            { name: "Total", value: `${order.total_price.toLocaleString("en-US")} aUEC`, inline: true },
            { name: "Items", value: String(order.item_count), inline: true },
            { name: "Shop", value: order.shop_name, inline: true },
          ],
          timestamp: order.created_at,
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Discord webhook: HTTP ${res.status} ${await res.text()}`)
  state.posted.push(order.order_id)
  // Discord allows about 5 webhook messages per 2 seconds per channel.
  await new Promise((r) => setTimeout(r, 500))
}

state.since = startedAt
state.posted = state.posted.slice(-500)
writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
console.log(`Posted ${fresh.length} new order(s).`)
