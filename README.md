# ModelRouter MCP

Advisory MCP server for intelligent LLM model recommendations in Cursor.

## v1 Capability Statement

**Ships:**
- Advisory `recommend_model` with schema-validated JSON
- Heuristic task analysis (Layer A) + metadata scoring (Layer B)
- Static seed registry (`registrySnapshot.mode: static_seed`)
- Benchmark ingest metadata (fixture-based until live sync)
- Guidance snippets for Cursor — **user manually picks model**

**Does NOT ship:**
- Force Composer/Auto model selection
- Continuous validation against engineering tasks (Phase 8 opt-in only)
- `Cursor.models.list()` or any IDE runtime model API

## Quick Start

```bash
npm install
npm run build
npm test
npm run validate-schemas
npm run smoke
```

### Cursor MCP Configuration

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

## Tools

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

## Privacy

See [PRIVACY.md](./PRIVACY.md). User data never leaves the machine via outbound HTTP.

## Maintainer Scripts

```bash
# Optional — requires CURSOR_API_KEY
npm run verify-cursor-ids

# CI denylist check
npm run lint:cursor-denylist
```

## Registry

Seed models live in `data/models/`. Run `sync_metadata` to refresh from fixture-based adapters (OpenRouter, SWE-bench, Anthropic docs, Ollama). Registry uses static seeds until first successful sync.

## Implementation status

| Phase | Status |
|-------|--------|
| 0 Contracts | Complete |
| 1 MCP transport | Complete |
| 2 Registry | Complete (8 seeds) |
| 3 Analysis + golden set | Complete (30 fixtures) |
| 4 Scoring | Complete |
| 5 E2E static_seed | Complete |
| 6 Sync | Complete (fixture-based) |
| 7 Benchmark ingest | Complete |
| 8 Internal validation | Complete (opt-in) |
| 9 Telemetry + guidance | Complete |

See [CONTRIBUTING.md](./CONTRIBUTING.md) for maintainer workflows.

## License

MIT
