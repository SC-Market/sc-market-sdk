# Test fixtures

Tests never call the live API; they replay these files through a fake `fetch`.

- `prices-*.json`, `v1-unauthorized.json`: recorded from the live API on 2026-11-01
  (the index trimmed to 3 items).
- Other `v1-*.json`: built by hand from the OpenAPI schemas in `openapi/public-v1.json`
  (there is no public sandbox token for SC Market), with made-up ids and names.
