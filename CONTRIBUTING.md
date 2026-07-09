# Contributing to ModelRouter MCP

## Development setup

```bash
npm install
npm run build
npm test
npm run smoke
```

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

## Golden dataset

Regenerate fixtures:

```bash
npx tsx scripts/generate-golden-fixtures.ts
```

## Privacy

Never send plan text, source contents, or repo paths outbound. See [PRIVACY.md](./PRIVACY.md).

## Internal validation

`run_internal_validation` is opt-in (`validation.enabled: true`). May incur API costs. Not marketed as continuous engineering-task validation.
