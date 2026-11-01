// Compare your stock spreadsheet with your SC Market listings.
//
//   SC_MARKET_TOKEN=scmp_live_…  node examples/sync-stock-from-csv.mjs examples/stock.example.csv
//
// Token scope: stock:read. The CSV has a header row and two columns: listing_id, quantity
// (export it from your own inventory sheet).
//
// The public API can read stock but can't change it yet (there is no stock write
// endpoint), so this prints what differs and a link to each listing's stock manager,
// where you make the change. When a write endpoint ships, `npm run generate` adds its
// method and this is the place to call it.
import { readFileSync } from "node:fs"
import { ApiError, ScMarketClient } from "@sc-market/sdk"

const file = process.argv[2]
if (!file) throw new Error("Usage: node examples/sync-stock-from-csv.mjs <file.csv>")

const sc = new ScMarketClient({ token: process.env.SC_MARKET_TOKEN })

// A small CSV reader: comma-separated, optional double quotes, no embedded newlines.
const rows = readFileSync(file, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim() !== "")
  .map((line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()))
const [header, ...data] = rows
const idCol = header.indexOf("listing_id")
const qtyCol = header.indexOf("quantity")
if (idCol < 0 || qtyCol < 0) throw new Error("The CSV needs listing_id and quantity columns")

let differences = 0
for (const row of data) {
  const listingId = row[idCol]
  const wanted = Number(row[qtyCol])
  if (!listingId || !Number.isFinite(wanted)) continue
  try {
    let listed = 0
    for await (const lot of sc.iterateListingStock(listingId)) {
      if (lot.listed) listed += lot.quantity_total - lot.quantity_allocated
    }
    if (listed === wanted) continue
    differences++
    console.log(`${listingId}: SC Market lists ${listed} available, your sheet says ${wanted} (${wanted > listed ? "+" : ""}${wanted - listed})`)
    console.log(`  change it at https://sc-market.space/market/stock/${listingId}`)
  } catch (e) {
    if (e instanceof ApiError && e.code === "NOT_FOUND") console.log(`${listingId}: not found, or not one of your listings`)
    else throw e
  }
}
console.log(differences ? `${differences} listing(s) differ.` : "Everything matches.")
