// Look up player-market prices from the public price feed. No token needed.
//
//   node examples/price-check.mjs canuto
//   node examples/price-check.mjs "p8-ar"
//
// The feed is free to use; when you publish its numbers, credit
// "Data: SC Market (sc-market.space)". Prices are asking prices of SC Market player
// listings, in aUEC (in-game currency), per unit.
import { PRICES_ATTRIBUTION, PricesFeed } from "@sc-market/sdk"

const query = process.argv.slice(2).join(" ").trim().toLowerCase()
if (!query) throw new Error('Usage: node examples/price-check.mjs <item name>')

const prices = new PricesFeed()
const index = await prices.index()
const matches = index.items.filter((i) => i.name.toLowerCase().includes(query)).slice(0, 10)
if (matches.length === 0) {
  console.log(`No priced item matches "${query}" (${index.count} items in the ${index.date} snapshot).`)
  process.exit(1)
}

const aUEC = (n) => (n == null ? "–" : `${n.toLocaleString("en-US")} aUEC`)
for (const m of matches) {
  console.log(`${m.name}${m.type ? ` (${m.type})` : ""}`)
  console.log(`  lowest ask ${aUEC(m.lowest_ask)}, median ${aUEC(m.median_ask)}, ${m.seller_count} seller(s), confidence ${m.confidence}`)
  console.log(`  ${m.page}`)
}
if (matches.length === 1) {
  const doc = await prices.item(matches[0].slug)
  console.log(`\n${doc.summary}`)
}
console.log(`\n${PRICES_ATTRIBUTION}. Snapshot ${index.date}.`)
