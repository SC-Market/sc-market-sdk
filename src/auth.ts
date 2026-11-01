/** SC Market public API tokens: `scmp_live_…` (Settings → API tokens on sc-market.space). */
export const TOKEN_PREFIX = "scmp_"

/** True for a string shaped like a public API token. Doesn't check it with the server. */
export function isApiToken(token: unknown): token is string {
  return typeof token === "string" && token.startsWith(TOKEN_PREFIX) && token.length > TOKEN_PREFIX.length && !/\s/.test(token)
}

/**
 * The `Authorization` header value for a token, for use with your own HTTP
 * client: `fetch(url, { headers: { Authorization: bearer(token) } })`.
 * Throws on anything that isn't an `scmp_` token (legacy `scm_` tokens are
 * refused by the public API).
 */
export function bearer(token: string): string {
  if (!isApiToken(token)) {
    const raw: unknown = token
    const hint = typeof raw === "string" && raw.startsWith("scm_") ? " Legacy scm_ tokens don't work with the public API." : ""
    throw new TypeError(`SC Market API tokens start with ${TOKEN_PREFIX} (create one under Settings → API tokens on sc-market.space).${hint}`)
  }
  return `Bearer ${token}`
}

/** `{ Authorization: "Bearer scmp_…" }`. */
export function authHeaders(token: string): { Authorization: string } {
  return { Authorization: bearer(token) }
}
