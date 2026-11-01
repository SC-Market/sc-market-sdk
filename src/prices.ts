/**
 * The public player-market price feed: no token, free to use, attribution
 * requested. https://api.sc-market.space/api/public/prices/index.json
 *
 * Item documents are typed from the site API spec (generated/prices.ts).
 * The index has no published schema, so its types are written by hand here,
 * from the documented envelope; keep them in step with the live feed.
 */
import { BaseClient, type ClientOptions, type RequestOptions } from "./http.js"
import type { PriceOracleItem, PriceOracleMethodology, PublicFeedInfo } from "./generated/prices.js"

export type * from "./generated/prices.js"

export const PRICES_BASE_URL = "https://api.sc-market.space/api/public/prices"

/** The attribution line the README asks for when you publish the data. */
export const PRICES_ATTRIBUTION = "Data: SC Market (sc-market.space)"

export type PriceConfidence = "none" | "low" | "medium" | "high"

/** One row of the index: an item with asks in the latest daily snapshot. All prices in aUEC per unit. */
export interface PriceIndexItem {
  /** Short slug, `<8 hex>--<name>`: pass it to `item()`. */
  slug: string
  name: string
  type: string | null
  /** The item's price comparison page on sc-market.space. */
  page: string
  /** This item's JSON document. */
  json: string
  ask_count: number
  seller_count: number
  confidence: PriceConfidence
  lowest_ask: number | null
  /** Null below 3 sellers. */
  median_ask: number | null
  /** Null below 7 days of daily medians. */
  median_30d: number | null
  change_pct_30d: number | null
}

/** GET /api/public/prices/index.json */
export interface PriceIndex {
  feed: PublicFeedInfo
  /** UTC day of the snapshot (YYYY-MM-DD); null before the first snapshot. */
  date: string | null
  /** When the snapshot was computed (ISO 8601). */
  as_of: string | null
  currency: "aUEC"
  unit_note: string
  count: number
  /** Priced items per confidence level. */
  coverage: Record<PriceConfidence, number>
  items: PriceIndexItem[]
  methodology: PriceOracleMethodology
  attribution: string
}

export type PricesFeedOptions = Omit<ClientOptions, "token">

/**
 * ```ts
 * const prices = new PricesFeed()
 * const index = await prices.index()
 * const doc = await prices.item(index.items[0].slug)
 * ```
 * Never sends a token. 60 requests a minute per IP; responses are cached at
 * the edge for 15 minutes and the numbers change once a day, so cache them.
 */
export class PricesFeed extends BaseClient {
  constructor(options: PricesFeedOptions = {}) {
    super({ ...options, token: undefined }, { baseUrl: PRICES_BASE_URL })
  }

  /** Every priced item of the latest daily snapshot. */
  index(options?: RequestOptions): Promise<PriceIndex> {
    return this.send("GET", "/index.json", { ...options }) as Promise<PriceIndex>
  }

  /** The same index as CSV text. */
  async indexCsv(options?: RequestOptions): Promise<string> {
    return String(await this.send("GET", "/index.csv", { ...options, headers: { Accept: "text/csv", ...options?.headers } }))
  }

  /** The same index as a Markdown table. */
  async indexMarkdown(options?: RequestOptions): Promise<string> {
    return String(await this.send("GET", "/index.md", { ...options, headers: { Accept: "text/markdown", ...options?.headers } }))
  }

  /**
   * One game item's document: current asks, the 30-day trend and recent
   * sales. `id` is the short slug, its 8-hex prefix or the item UUID.
   * Unknown items throw an ApiError with code NOT_FOUND.
   */
  item(id: string, options?: RequestOptions): Promise<PriceOracleItem> {
    return this.send("GET", `/${encodeURIComponent(id.toLowerCase())}.json`, { ...options }) as Promise<PriceOracleItem>
  }
}
