import { bearer } from "./auth.js"
import { GeneratedScMarketClient } from "./generated/client.js"
import type { ClientOptions } from "./http.js"

export const DEFAULT_BASE_URL = "https://api.sc-market.space/api/public/v1"

export interface ScMarketClientOptions extends ClientOptions {
  /** Your public API token, `scmp_live_…`. Required: every public API operation needs one. */
  token: string
}

/**
 * The SC Market public API (shops, listings, stock, orders, offers).
 *
 * ```ts
 * const sc = new ScMarketClient({ token: process.env.SC_MARKET_TOKEN! })
 * const me = await sc.getMe()
 * for await (const order of sc.iterateOrders({ role: "seller", status: "not-started" })) { … }
 * ```
 */
export class ScMarketClient extends GeneratedScMarketClient {
  constructor(options: ScMarketClientOptions) {
    bearer(options?.token) // validates the prefix, throws a helpful TypeError
    super(options, { baseUrl: DEFAULT_BASE_URL })
  }
}
