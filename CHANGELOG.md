# Changelog

## 0.1.0 — 2026-07-10

### Added
- User-writable data directory (`~/.modelrouter`, overridable via `MODELROUTER_DATA_DIR`)
- Async live metadata sync via `HttpPort` (OpenRouter, Ollama, SWE-bench)
- Background startup sync with 24h TTL (`sync-state.json`)
- Strict fixture policy: `MODELROUTER_USE_FIXTURES=1` for CI; no silent prod downgrade
- Real Cursor model IDs in cloud seed profiles
- Benchmark ingest writes `benchmarks[]` and `capabilities.coding`
- Golden scoring test suite
- npm publish metadata, LICENSE, SECURITY.md

### Changed
- Registry mutations write to user dir only (packaged seeds remain read-only)
- `sync_metadata` is async; honors `sync.enabled` and `sync.sources`
- README privacy wording aligned with PRIVACY.md Class D inbound fetch

### Deferred to v1.1
- Real LLM internal validation (`InternalTaskRunner`)
