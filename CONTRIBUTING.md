# Contributing to ModelRouter MCP

## Development setup

```bash
npm install
npm run build
MODELROUTER_USE_FIXTURES=1 npm test
npm run smoke
```

## Environment

| Variable | Purpose |
|----------|---------|
| `MODELROUTER_USE_FIXTURES=1` | Required for CI and offline dev — no live HTTP |
| `MODELROUTER_DATA_DIR` | Override user cache directory in tests/dev |

## Cursor ID verification (maintainers only)

The MCP runtime **never** calls `GET https://api.cursor.com/v1/models`.

Optional maintainer check when `CURSOR_API_KEY` is set:

```bash
export CURSOR_API_KEY=your_key
npm run verify-cursor-ids
```

Script failure is non-blocking. Seeds keep `cursorAvailability: documented` from [Cursor docs](https://cursor.com/docs/models-and-pricing).

## Manual picker verification

When adding seed models, verify `cursorModelId` against the Cursor model picker UI and document in the PR.

## Manual smoke checklist (pre-release)

- [ ] Live sync smoke with network on (`sync_metadata` without `MODELROUTER_USE_FIXTURES`)
- [ ] Cursor connects via `.cursor/mcp.json` (local) and npx config
- [ ] `recommend_model` on a real plan: pass if `scoreMargin > 0.05` + warning OR confidence > 0.6
- [ ] `npm pack` + install on second machine

## Golden dataset

Regenerate fixtures:

```bash
npx tsx scripts/generate-golden-fixtures.ts
```

## Privacy

Never send plan text, source contents, or repo paths outbound. See [PRIVACY.md](./PRIVACY.md).

## Internal validation

`run_internal_validation` is opt-in (`validation.enabled: true`). May incur API costs. Deferred to v1.1 for real LLM calls.
