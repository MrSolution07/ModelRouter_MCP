# ModelRouter MCP

Advisory MCP server for intelligent LLM model recommendations in Cursor.

## v1 Capability Statement

**Ships:**
- Advisory `recommend_model` with schema-validated JSON
- Heuristic task analysis (Layer A) + metadata scoring (Layer B)
- Static seed registry with user-writable cache (`~/.modelrouter`)
- Live metadata sync by default (Class D inbound fetch when `privacyMode: false`)
- Guidance snippets for Cursor — **user manually picks model**

**Does NOT ship:**
- Force Composer/Auto model selection
- Continuous validation against engineering tasks (Phase 8 opt-in only)
- `Cursor.models.list()` or any IDE runtime model API

## Quick Start

```bash
npm install
npm run build
MODELROUTER_USE_FIXTURES=1 npm test
npm run validate-schemas
npm run smoke
```

### Cursor MCP Configuration

**npm (after publish):**
```json
{
  "mcpServers": {
    "modelrouter": {
      "command": "npx",
      "args": ["-y", "modelrouter-mcp"]
    }
  }
}
```

**Local development:**
```json
{
  "mcpServers": {
    "modelrouter": {
      "command": "node",
      "args": ["/absolute/path/to/ModelRouter_MCP/dist/index.js"]
    }
  }
}
```

## Tools (10)

| Tool | Description |
|------|-------------|
| `recommend_model` | Advisory recommendation from plan + repo metadata |
| `analyze_task` | Task type, complexity, requirement vector |
| `analyze_repository` | File counts, languages, frameworks, diff stats |
| `list_models` | Registry model list |
| `get_model_profile` | Full profile with provenance |
| `sync_metadata` | Sync from external sources (blocked in privacy mode) |
| `generate_cursor_guidance` | Advisory snippets — does not apply model |
| `get_telemetry_summary` | Local telemetry only |
| `estimate_cost` | Cost estimate for a specific model |
| `run_internal_validation` | Opt-in stub validation (disabled by default) |

Benchmark ingest is internal-only (via `SweBenchAdapter`), not exposed as an MCP tool.

## Configuration

See [`schemas/modelrouter-config.schema.json`](schemas/modelrouter-config.schema.json).

| Setting | Default | Notes |
|---------|---------|-------|
| `privacyMode` | `false` | Blocks all outbound HTTP when `true` |
| `sync.enabled` | `true` | Disable to skip metadata sync |
| `sync.sources` | all adapters | Filter by source ID |
| `validation.enabled` | `false` | Opt-in; may incur API costs |

**Environment variables** (not in JSON schema):
- `MODELROUTER_DATA_DIR` — override user cache directory (default `~/.modelrouter`)
- `MODELROUTER_USE_FIXTURES=1` — fixtures only, no live HTTP (CI/dev offline)

## Privacy

See [PRIVACY.md](./PRIVACY.md). User plan and repository data are never sent outbound. Optional public model metadata fetch (Class D) occurs when `privacyMode: false`.

## Data directories

| Path | Purpose |
|------|---------|
| Packaged `data/models/` | Read-only seeds (npm install) |
| `~/.modelrouter/models/` | Writable user cache (sync updates) |
| `~/.modelrouter/sync-state.json` | Last sync TTL tracking |

Single-instance assumption: concurrent writes are not supported.

## Troubleshooting

- **Build errors:** Run `npm run build` before starting MCP
- **Stale metadata:** Call `sync_metadata` or wait for background TTL sync (24h)
- **Offline dev:** Set `MODELROUTER_USE_FIXTURES=1`
- **Privacy:** Set `privacyMode: true` in config to block all outbound HTTP

## Maintainer Scripts

```bash
# Optional — requires CURSOR_API_KEY
npm run verify-cursor-ids

# CI denylist check
npm run lint:cursor-denylist

# Record live sync fixtures (network required)
npx tsx scripts/record-sync-fixtures.ts
```

## Implementation status

| Phase | Status |
|-------|--------|
| Runtime foundation (user dir, async sync) | Complete |
| Live metadata sync | Complete |
| Registry quality (cursor IDs, benchmarks) | Complete |
| Calibration | Provisional (run `npx tsx scripts/calibrate-scoring.ts` to validate) |
| npm publish | Ready |

See [CONTRIBUTING.md](./CONTRIBUTING.md) for maintainer workflows.

## License

MIT — see [LICENSE](./LICENSE)
