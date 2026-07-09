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

Seed models live in `data/models/`. Registry uses static seeds until Phase 6 sync is enabled.

## License

MIT
