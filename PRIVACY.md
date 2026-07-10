# ModelRouter MCP — Privacy Contract

## Principle

ModelRouter MCP operates locally over MCP stdio. **User plan and repository data never leave the machine via outbound HTTP.** Public model metadata (Class D) may be fetched inbound when `privacyMode: false`.

Local MCP tool responses (including `requirementVector`, task analysis, and token estimates) are permitted — they stay within the same process boundary on the user's machine.

## Data Classification

| Class | Description | Outbound allowed? |
|-------|-------------|-------------------|
| A | Plan document text (full or partial) | **Never** |
| B | Source file contents | **Never** |
| C | Git diff hunks, patch text, absolute repo paths | **Never** |
| D | Public model metadata (pricing, benchmarks, context limits) | Yes — inbound fetch only when privacy mode off |
| E | Aggregated non-identifying telemetry counters | Local store only; export blocked in privacy mode |

## Never Outbound (HTTP, sync, telemetry export, logs)

1. Plan document text (full or partial)
2. Source file contents
3. Git diff hunks or patch text
4. Selected file paths (basename only in logs if `logPaths: true`; default false)
5. Repo directory absolute path
6. `RequirementVector` dimension values — allowed in local MCP JSON response; **forbidden** in outbound payloads, telemetry export, logs
7. Token count estimates — allowed in local MCP response; forbidden outbound
8. Class A/B data in error strings sent to external services

## May Leave Machine (inbound fetch only, Class D)

- Public model pricing, context limits, benchmark leaderboard rows
- OpenRouter `/api/v1/models` public metadata
- Ollama `localhost` tags when user enables local discovery

## PrivacyGuard

All outbound I/O (`HttpPort`, sync adapters, benchmark ingest, telemetry export) must call `PrivacyGuard.assertOutboundAllowed(payloadClass)` before any network request.

When `privacyMode: true`:
- `sync_metadata` returns `{ "status": "blocked_by_privacy_mode" }`
- Zero outbound HTTP calls
- Benchmark ingest blocked
- Telemetry export blocked

## CI Privacy Tests

| Test file | Validates |
|-----------|-----------|
| `tests/privacy/no-plan-leak.test.ts` | Plan substring absent from HTTP payloads |
| `tests/privacy/no-repo-path-leak.test.ts` | Repo path absent from HTTP payloads |
| `tests/privacy/privacy-mode-blocks.test.ts` | Sync, benchmark, export blocked in privacy mode |
| `tests/privacy/log-redaction.test.ts` | Class A data absent from pino output |

## Cursor API Note

`GET https://api.cursor.com/v1/models` is **never** called by MCP runtime. Optional maintainer script `scripts/verify-cursor-ids.ts` may call it when `CURSOR_API_KEY` is set.
