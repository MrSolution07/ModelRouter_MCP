---
name: ModelRouter MCP Master Plan
overview: v4 — Phase 0 approved. Contracts first. Advisory MCP. Guidance-only Cursor. Optional maintainer probe for GET /v1/models.
todos:
  - id: phase-0-contracts
    content: "Phase 0: Schemas, response contracts, privacy threat model, golden dataset spec, calibration files (all provisional)"
    status: pending
  - id: phase-1-mcp
    content: "Phase 1: MCP transport only — stubs return not_implemented, never fake model data"
    status: pending
  - id: phase-2-registry
    content: "Phase 2: Full registry schema with per-field provenance + seed models (cursorAvailability documented minimum)"
    status: pending
  - id: phase-3-analysis
    content: "Phase 3: Repo analyzer + task/complexity heuristics (Layer A, calibrated)"
    status: pending
  - id: phase-4-scoring
    content: "Phase 4: Scoring engine — fixed bounds, weight redistribution, zero-eligible, no model IDs in code"
    status: pending
  - id: phase-5-e2e-static
    content: "Phase 5: recommend_model E2E — static_seed registry only; perf targets split"
    status: pending
  - id: phase-6-sync
    content: "Phase 6: Per-source sync adapters with provenance + PrivacyGuard"
    status: pending
  - id: phase-7-validation-bench
    content: "Phase 7: Benchmark ingest + alias matching + regression confidence policy"
    status: pending
  - id: phase-8-validation-internal
    content: "Phase 8: Opt-in internal eval — NOT v1 marketing claim"
    status: pending
  - id: phase-9-release
    content: "Phase 9: Local telemetry, generate_cursor_guidance (advisory), docs, release"
    status: pending
isProject: false
---

# ModelRouter MCP — Implementation Spec (v4)

> **Status:** Approved for **Phase 0 only** (contracts/schemas). Full impl gated on Phase 0 acceptance + tickets below closed.

## Phase 0 approval tickets (from strict review v4)

| ID | Item | Resolution in this doc |
|----|------|------------------------|
| T-01 | `GET /v1/models` verify | §2 — documented Cloud Agents API, public beta, auth cited |
| T-02 | `requirementVector` privacy wording | §3 — local MCP response OK; never outbound network |
| T-03 | Fake `cursorModelId` examples | §5 — `example-cursor-model-id` only in schemas |
| T-04 | Weak static registry ranking | §5–6 — capability fallback + Phase 2 seed requirements |
| T-05 | `costUsd.max` clipping | §6 — `normalizationBoundClipped` + `NORMALIZATION_CLIPPED` warning |
| T-06 | Relax order ambiguity | §6 — exact 3-pass algorithm spelled |
| T-07 | Phase 6 acceptance | §10 Phase 6 |
| T-08 | Phase 8 acceptance | §10 Phase 8 |
| T-09 | `sync_metadata` stub pre-Phase 6 | §14 tool gating |

## Reviewer delta (v1 → v3)

| Blocker | v3 fix | Section |
|---------|--------|---------|
| `Cursor.models.list()` invented | **Removed.** Explicit denylist. Only `GET https://api.cursor.com/v1/models` (maintainer script) + docs + picker UI | §2 |
| `generate_cursor_rule` "applies" model | Renamed **`generate_cursor_guidance`**. Output = advisory snippet + disclaimer. Never "apply/enforce" | §2, §8, Phase 9 |
| No `recommend_model` JSON schema | Full input + output schema; Phase 0 deliverable file path | §8 |
| Registry lacks provenance | `ProvenanceField<T>` wrapper required on every mutable value | §6 |
| Arbitrary scoring (25% cap, unstable normalize) | Fixed global bounds; no benchmark cap; weight redistribution; all weights `provisional` until calibration | §7 |
| Phase 9 `<2s` vs repo `<5s` | Split SLA table | §7, Phase 5 |
| SWE-bench without alias rules | 4-step alias matcher + quarantine | §10 |
| Privacy vague | Class A–E + **NEVER LEAVES MACHINE** list + CI matrix | §5 |
| Continuous validation overclaim | Honest capability table; internal eval Phase 8 opt-in only | top, §10 |
| Phase 14 "applies model" | **Deleted.** Guidance acceptance in Phase 9 only | Phase 9 |

---

## v1 Honest Capability Statement

**v1 ships:**
- Advisory `recommend_model` with schema-validated JSON
- Heuristic task analysis (Layer A) + metadata scoring (Layer B)
- Static seed registry (`registrySnapshot.mode: static_seed`)
- Benchmark ingest (Phase 7) — metadata refresh, not live model eval
- Guidance snippets for Cursor — **user manually picks model**

**v1 does NOT ship:**
- Force Composer/Auto model selection
- Continuous validation against representative engineering tasks (requirements2 cornerstone → Phase 8 opt-in)
- Fully dynamic pricing without unknown/stale flags
- `Cursor.models.list()` or any IDE runtime model API

---

## 1. Executive Summary

ModelRouter MCP = **advisory** TypeScript MCP server. Reads local plan + repo **metadata**, scores models from provenance-tracked registry, returns structured JSON. Developer switches model picker manually.

Two layers (non-negotiable):
- **Layer A — Heuristic analysis:** task type, complexity → `RequirementVector`. Config-driven signals. **Not routing.**
- **Layer B — Data-driven routing:** score models from registry metadata only. **No model names in code/config.**

---

## 2. Verified Cursor Integration (no invented APIs)

### `GET https://api.cursor.com/v1/models` — verified, optional maintainer probe

**Docs:** [Cloud Agents API — List Models](https://cursor.com/docs/cloud-agent/api/endpoints)  
**Status:** Public beta (API may change before GA)  
**Auth:** Basic or Bearer — user API key from Cursor Dashboard → API Keys. Example: `curl -u YOUR_API_KEY: https://api.cursor.com/v1/models`  
**Returns:** `items[].id`, `displayName`, `aliases`, `parameters`, `variants` — IDs for Cloud Agents `model.id`, same family as subagent frontmatter per docs.

**ModelRouter usage policy:**
- **Not called by MCP runtime** — ever
- **Optional** maintainer script `scripts/verify-cursor-ids.ts` — best-effort seed check when `CURSOR_API_KEY` set
- Script failure → non-blocking; seeds keep `cursorAvailability: documented` from docs/picker
- Script success → may set `cursorAvailability: verified` + update `provenance.source: cursor_api`
- IDE Composer picker IDs may differ from Cloud Agents list — docs + manual picker remain primary

### Allowed sources for `cursorModelId`

| Source | URL / mechanism | Runtime MCP? | Purpose |
|--------|-----------------|--------------|---------|
| Cloud Agents API | `GET https://api.cursor.com/v1/models` | **No** — optional maintainer script only | Best-effort seed validation |
| Cursor docs | https://cursor.com/docs/models-and-pricing | No | Seed `cursorAvailability: documented` |
| Subagents docs | https://cursor.com/docs/subagents | No | Frontmatter template format |
| Model picker UI | Manual | No | Human verification in CONTRIBUTING |

### Explicit denylist — do not reference in design or code

- `Cursor.models.list()` — **does not exist** for MCP/IDE
- Any `vscode.cursor.setModel` — **not documented**
- MCP tool that sets Composer picker — **not possible**
- Cursor Rules that bind model picker — **not possible**; rules guide agent text only

### `generate_cursor_guidance` tool (NOT `generate_cursor_rule`)

**Purpose:** Suggest model + emit copy-paste advisory snippets.

**Output schema:** `schemas/generate-cursor-guidance-response.schema.json`

```json
{
  "recommendedCursorModelId": "string | null",
  "cursorAvailability": "verified | documented | unverified",
  "disclaimer": "Cursor may ignore subagent model field. Rules do not control model picker. User must confirm model switch.",
  "ruleSnippet": "string — asks agent to call recommend_model and present result to user",
  "subagentTemplate": "string — optional YAML frontmatter with model: field",
  "manualSteps": [
    "Read recommendation",
    "Open model picker (Cmd+/)",
    "Select recommended model",
    "Optionally paste subagent template"
  ]
}
```

**Forbidden wording in tool description, docs, acceptance tests:** apply, enforce, bind, automatically select.

---

## 3. Privacy contract — never outbound network

**Inbound OK:** public model metadata fetch (Class D) when privacy mode off.

**Local MCP tool response OK:** `recommend_model` returns `analysis.requirementVector`, `analysis.taskType`, `estimates.*` to Cursor over stdio — stays on machine, same process boundary. Privacy rule = **never sent outbound via HTTP/sync/export/logs**.

### Never outbound (HTTP, sync, telemetry export, logs)

1. Plan document text (full or partial)
2. Source file contents
3. Git diff hunks or patch text
4. Selected file paths (basename only in logs if `logPaths: true`; default false)
5. Repo directory absolute path
6. `RequirementVector` dimension values — **allowed in local MCP JSON response**; **forbidden** in outbound payloads, telemetry export, logs
7. Token count estimates (allowed in local MCP response; forbidden outbound)
8. Class A/B data in error strings sent to external services (MCP local errors may include safe summaries only)

**May leave machine (inbound fetch only, Class D):**
- Public model pricing, context limits, benchmark leaderboard rows
- OpenRouter `/api/v1/models` public metadata
- Ollama `localhost` tags when user enables local discovery

**PrivacyGuard:** single port; all `HttpPort`, sync, benchmark ingest, telemetry export call `PrivacyGuard.assertOutboundAllowed(payloadClass)` before I/O.

### CI privacy tests (Phase 0 stubs, Phase 5 required pass)

```
tests/privacy/no-plan-leak.test.ts       — HTTP mock, plan substring absent
tests/privacy/no-repo-path-leak.test.ts  — HTTP mock, repo path absent
tests/privacy/privacy-mode-blocks.test.ts — sync, benchmark, export blocked
tests/privacy/log-redaction.test.ts      — Class A absent from pino output
```

---

## 4. Heuristic Analysis vs Data-Driven Routing

### Layer A (heuristic — allowed)

- Input: `data/calibration/task-signals.json` (versioned, `calibrationStatus: provisional`)
- Output: `TaskProfile`, `ComplexityScore`, `RequirementVector`
- Calibration: golden dataset §12; ≥85% task type; complexity ±1 for 80%
- **Prohibited:** `taskType → modelId` anywhere

### Layer B (routing — strict)

- Input: registry `ModelProfile[]` with provenance
- Output: ranked scores
- Weights: `data/calibration/scoring-weights.json` — **provisional until Phase 7 correlation**
- **Prohibited:** model names, provider names, benchmark caps hardcoded in TS

### Telemetry guardrail

`TelemetryPort` → write-only local store. **No import edge** to `ScoringEngine` or `ModelRegistry`. CI: `tests/architecture/no-telemetry-scoring-import.test.ts`

---

## 5. Model Registry — Complete Schema

**File:** `schemas/model-profile.schema.json`  
**Instance:** `data/models/{provider}/{id}.json`

### `ProvenanceField<T>` (required wrapper)

```json
{
  "value": "<T>",
  "provenance": {
    "source": "openrouter_api | cursor_api | provider_docs | benchmark_ingest | internal_validation | manual_curated",
    "sourceUrl": "string | null",
    "retrievedAt": "ISO8601",
    "lastVerified": "ISO8601",
    "confidence": 0.0,
    "license": "string | null"
  }
}
```

**Loader rejects** bare numbers/strings for: pricing, context, capabilities, latency, features.

### Full profile shape

```json
{
  "id": "example-internal-model-id",
  "cursorModelId": { "value": "example-cursor-model-id", "provenance": {} },
  "cursorAvailability": "verified | documented | unverified | not_applicable",
  "provider": "example-provider",
  "displayName": "Example Model (schema illustration only)",
  "status": "preview | active | deprecated | unavailable",
  "statusChangedAt": "ISO8601",
  "version": "string",
  "releaseDate": "ISO8601 | null",
  "deprecatedAt": "ISO8601 | null",
  "availability": {
    "regions": ["global"],
    "requiresMaxMode": false,
    "tier": "free | standard | premium"
  },
  "pricing": {
    "inputPerMillion": { "value": 3.0, "provenance": {} },
    "outputPerMillion": { "value": 15.0, "provenance": {} },
    "currency": "USD",
    "unknown": false
  },
  "context": {
    "maxInputTokens": { "value": 200000, "provenance": {} },
    "maxOutputTokens": { "value": 8192, "provenance": {} }
  },
  "features": {
    "vision": { "value": true, "provenance": {} },
    "functionCalling": { "value": true, "provenance": {} },
    "toolUse": { "value": true, "provenance": {} },
    "structuredOutput": { "value": true, "provenance": {} },
    "streaming": { "value": true, "provenance": {} },
    "reasoningMode": { "value": false, "provenance": {} }
  },
  "capabilities": {
    "coding": { "value": 8.2, "provenance": { "source": "benchmark_ingest", "confidence": 0.85 } }
  },
  "benchmarks": [{
    "name": "swe-bench-verified",
    "rawScore": 72.5,
    "normalizedScore": 8.2,
    "mappedDimensions": ["coding"],
    "benchmarkModelAlias": "example-benchmark-model-alias",
    "provenance": {}
  }],
  "latency": {
    "p50Ms": { "value": 7000, "provenance": {} }
  },
  "aliases": ["example-model-alias"],
  "validationStatus": "ok | degraded",
  "limitations": ["string"],
  "strengths": ["string"]
}
```

**Seed rule:** no `capabilities.*.provenance.confidence > 0.5` unless `source` is `benchmark_ingest`, `internal_validation`, or `cursor_api`. Manual seeds: `confidence: 0.0–0.4`.

### Phase 2 seed requirements (avoid null/weak ranking)

Each seed model in `data/models/` must have **≥3 capability dimensions** populated (value may be manual, confidence ≤0.4).

**Scoring fallback when all dims for a model have confidence < 0.5:**
1. Include dims with confidence 0.1–0.49 in cosine **at 50% weight** (multiply vector component by 0.5)
2. Set `warnings: ["LOW_CAPABILITY_EVIDENCE"]` on response
3. Force `confidence.evidenceCoverage` cap at 0.6 max
4. If **zero** dims across **all** models → `status: "error"`, code `INSUFFICIENT_REGISTRY_EVIDENCE`, no fake winner

**Preferred:** at least 2 seed models per major provider family have ≥1 benchmark-backed dim (confidence ≥0.85) before Phase 5 E2E — may use static benchmark fixture in `data/benchmarks/fixtures/` until Phase 7 live ingest.

---

## 6. Scoring Engine

### Performance SLA (no contradiction)

| Scenario | Target | Measured at |
|----------|--------|-------------|
| `recommend_model`, shallow repo, warm cache | **< 2000ms** | Phase 5 E2E |
| `recommend_model`, medium repo, cold scan | **< 7000ms** | Phase 5 E2E |
| Repo scan alone, shallow, medium fixture | **< 5000ms** | Phase 3 |
| Registry load (cached) | **< 100ms** | Phase 2 |

### Fixed normalization bounds

File: `data/calibration/normalization-bounds.json`

```json
{
  "costUsd": { "min": 0, "max": 5.0, "rationale": "provisional per-request ceiling — recalibrate in Phase 7" },
  "latencyMs": { "min": 200, "max": 120000, "rationale": "provisional" },
  "calibrationStatus": "provisional"
}
```

`normalize(v) = clamp((v - min) / (max - min), 0, 1)` — bounds fixed per release; adding model does not change other models' normalized values.

**Clipping acceptance:** when raw value > max before clamp → `evidence[].normalizationBoundClipped: true` for that component + `warnings` includes `NORMALIZATION_CLIPPED`. Test: `tests/scoring/normalization-clip.test.ts` with `estimatedCost = 9.99` USD.

**Stability acceptance:** `tests/scoring/stability.test.ts` — add 10 decoy models, winner score unchanged ±0.001.

### Components

```
capabilityMatch     — cosine similarity; see §5 fallback for confidence 0.1–0.49; omit <0.1
costEfficiency      — 1 - normalize(estimatedCost); null if pricing.unknown
contextFitness      — headroom bands (ratio <1 → filter; 1–1.2 → 0.5; 1.2–2 → 0.8; >2 → 1.0)
latencyScore        — 1 - normalize(p50Ms)
reliability         — provenance field or default 5.0/10
benchmarkSignal     — weighted avg; NO hardcoded % cap
preferenceAlignment — user config bonuses
```

### Score aggregation

```
effectiveWeight_i = baseWeight_i / Σ(baseWeight_j for non-null component_j)
score = Σ effectiveWeight_i × component_i
```

Base weights: `data/calibration/scoring-weights.json` — all keys include `"calibrationStatus": "provisional"`.

### Confidence

Weights in `data/calibration/confidence-weights.json` (provisional). Factors: evidenceCoverage, scoreMargin, dataFreshness, validationRecency, contextHeadroom. Formula documented in schema `$comment`, not magic constants in code without config file.

### Zero eligible / filter conflict

**Pass 1 — strict:** apply all active filters (`excludedProviders`, `freeOnlyMode`, `localOnlyMode`, `maxBudget`, `status`, `contextFitness === 0`). If any models remain → rank, `status: "ok"`.

**Pass 2 — relax budget only:** if Pass 1 empty and `maxBudget` set → rerun without `maxBudget`. Candidates get `nearestOptions[].relaxationApplied: "budget"`. If models remain → `status: "no_eligible_models"` with those as `nearestOptions`, **no** `recommended` unless user config `allowBudgetRelaxation: true` (default false).

**Pass 3 — relax freeOnly:** if still empty and `freeOnlyMode` → rerun without `freeOnlyMode`. `relaxationApplied: "freeOnly"`.

**Pass 4 — relax localOnly:** if still empty and `localOnlyMode` → rerun without `localOnlyMode`. `relaxationApplied: "localOnly"`.

**Never relaxed:** `excludedProviders`, `privacyMode` blocks, `contextFitness === 0`.

If Pass 4 still empty → `status: "filter_conflict"` if conflicting flags caused impossibility (e.g. `freeOnly + localOnly` intersection empty on Pass 1); else `status: "no_eligible_models"` with `nearestOptions` from last non-empty pass.

`filter_conflict` example: `freeOnlyMode: true` + `localOnlyMode: true` + zero local free models on Pass 1, no relaxation helps.

### Regression (single policy)

Regression detected → `validationStatus: degraded` → lower confidence factors + `MODEL_DEGRADED` warning. **Do not** auto-mutate capability values. **Do not** auto-rollback snapshots.

---

## 7. Response Contracts (Phase 0 — block all other phases)

### Mandatory schema files

```
schemas/recommend-model-response.schema.json   ← canonical output
schemas/recommend-model-input.schema.json
schemas/analyze-task-response.schema.json
schemas/analyze-repository-response.schema.json
schemas/list-models-response.schema.json
schemas/sync-metadata-response.schema.json
schemas/generate-cursor-guidance-response.schema.json
schemas/model-profile.schema.json
schemas/provenance-field.schema.json
schemas/modelrouter-config.schema.json
```

### `recommend_model` output (canonical)

```json
{
  "$schema": "./schemas/recommend-model-response.schema.json",
  "status": "ok | no_eligible_models | filter_conflict | blocked_by_privacy_mode | error",
  "recommended": {
    "modelId": "string",
    "cursorModelId": "string | null",
    "cursorAvailability": "verified | documented | unverified | not_applicable",
    "displayName": "string",
    "provider": "string",
    "score": 0.0,
    "rank": 1
  },
  "alternatives": [
    { "modelId": "string", "cursorModelId": "string | null", "score": 0.0, "rank": 2, "summary": "string" }
  ],
  "confidence": {
    "value": 0,
    "factors": {
      "evidenceCoverage": 0.0,
      "scoreMargin": 0.0,
      "dataFreshness": 0.0,
      "validationRecency": 0.0,
      "contextHeadroom": 0.0
    },
    "calibrationStatus": "provisional | validated"
  },
  "estimates": {
    "inputTokens": 0,
    "outputTokens": 0,
    "totalTokens": 0,
    "costUsd": { "value": null, "unknown": true },
    "latencyMs": { "value": null, "unknown": true }
  },
  "analysis": {
    "taskType": "string",
    "complexity": 0,
    "requirementVector": {},
    "repoSummary": {
      "fileCount": 0,
      "languages": ["string"],
      "frameworks": ["string"],
      "diffStatLines": { "added": 0, "removed": 0 }
    }
  },
  "evidence": [
    {
      "component": "capabilityMatch | costEfficiency | contextFitness | latencyScore | benchmarkSignal | preferenceAlignment",
      "contribution": 0.0,
      "effectiveWeight": 0.0,
      "summary": "string",
      "provenanceSources": ["string"],
      "normalizationBoundClipped": false
    }
  ],
  "warnings": ["LOW_CONFIDENCE | PRICING_UNKNOWN | MODEL_DEGRADED | STALE_METADATA | CURSOR_ID_UNVERIFIED | LOW_CAPABILITY_EVIDENCE | NORMALIZATION_CLIPPED"],
  "staleFields": [{ "modelId": "string", "field": "string", "lastVerified": "ISO8601", "ageDays": 0 }],
  "rejectedModels": [{ "modelId": "string", "reason": "budget_exceeded | provider_excluded | context_insufficient | deprecated | pricing_unknown_under_budget" }],
  "nearestOptions": [{ "modelId": "string", "reason": "string", "relaxationApplied": "budget | freeOnly | localOnly" }],
  "filterConflicts": ["string"],
  "resolutionSuggestions": ["string"],
  "registrySnapshot": {
    "id": "sha256-of-files",
    "loadedAt": "ISO8601",
    "mode": "static_seed | synced"
  },
  "timingMs": 0,
  "guidance": {
    "note": "Advisory only. User must manually select model in Cursor picker."
  }
}
```

### Unknown pricing acceptance

When `pricing.unknown: true`:
- `estimates.costUsd.unknown: true`, `value: null`
- `warnings` includes `PRICING_UNKNOWN`
- Model **rankable** unless `maxBudget` set → then `rejectedModels` reason `pricing_unknown_under_budget`
- `costEfficiency` component omitted; weights redistributed

### Stub policy (Phase 1)

```json
{ "status": "not_implemented", "_fixture": true }
```

Never return fake `recommended.modelId` from stubs.

---

## 8. External Metadata Sync — Per-Source Contracts

| sourceId | endpoint | trust | onFailure | license note |
|----------|----------|-------|-----------|--------------|
| openrouter_models | `GET openrouter.ai/api/v1/models` | high | keep cache, staleFields | API ToS |
| cursor_models_api | `GET api.cursor.com/v1/models` (public beta; Basic/Bearer API key) | high | keep `cursorAvailability: documented`; script logs warning | maintainer only; optional |
| swe_bench_leaderboard | GitHub release artifact | medium | skip ingest, log | research license |
| anthropic_docs | manual curated JSON | medium | pricing.unknown | provider ToS |
| ollama_local | `GET localhost:11434/api/tags` | high | empty local list | N/A |

Every synced field writes full `provenance` block. Failed fetch **never** deletes existing values.

---

## 9. Continuous Validation — Honest Scope

### Phase 7 (benchmark metadata only)

- Ingest public snapshots
- Alias match → update benchmark entries on model profile (provenance `benchmark_ingest`)
- Unmatched → `data/benchmarks/unmatched/` — **no capability score write**
- Regression → confidence + `MODEL_DEGRADED` only

### Alias matching (required before SWE-bench acceptance)

```
1. exact: benchmarkModelAlias === profile.id
2. alias: benchmarkModelAlias ∈ profile.aliases
3. fuzzy: normalize + Levenshtein ≤ 2 + same provider family → confidence 0.7
4. no match: quarantine
```

Capability dimension update from benchmark **only** when match confidence ≥ 0.85.

### Phase 8 (opt-in internal eval)

- `validation.enabled: false` default
- User API keys required
- Updates capabilities with `provenance.source: internal_validation`
- **Not** marketed as v1 continuous validation

---

## 10. Implementation Roadmap

### Phase 0 — Contracts (BLOCKING)

Deliverables: all schema files §7, `normalization-bounds.json`, `scoring-weights.json`, `confidence-weights.json`, `task-signals.json` (provisional), `PRIVACY.md`, golden spec §11, 2 example model profiles with provenance.

Acceptance:
- `npm run validate-schemas` green
- Privacy test files exist
- **No domain implementation**

### Phase 1 — MCP transport

Acceptance: Cursor connects; stubs return `not_implemented` only.

### Phase 2 — Registry

Acceptance: provenance wrapper enforced; 8+ seeds; `scripts/verify-cursor-ids.ts` documented; grep CI fails on `Cursor.models.list`

### Phase 3 — Analysis (repo before scoring)

Acceptance: golden §11; zero HTTP; diff stat only default.

### Phase 4 — Scoring

Acceptance: stability test; zero-eligible; filter_conflict; no model IDs in `src/`

### Phase 5 — E2E static

Acceptance: response validates against schema; `mode: static_seed`; perf SLA §6; privacy tests pass; README says static seed until Phase 6.

### Phase 6 — Sync

**Deliverables:** per-source adapters §8, `sync_metadata` implementation, `PrivacyGuard` on all outbound, provenance write path.

**Acceptance:**
- `sync_metadata` returns `SyncReport` matching schema (not stub)
- `PrivacyGuard.assertOutboundAllowed()` called in every adapter — unit test mocks verify call count
- Every field written by sync has full `provenance` block (`source`, `sourceUrl`, `retrievedAt`, `lastVerified`, `confidence`, `license`)
- Simulated fetch failure → existing registry cache unchanged; `staleFields` populated; `syncStatus: failed` on touched profiles
- `privacyMode: true` → `status: "blocked_by_privacy_mode"`; zero HTTP (mock)
- OpenRouter adapter CI test uses recorded fixture only (no live network)
- Phases 1–5: `sync_metadata` still returned stub `{ "status": "not_implemented", "_fixture": true }`

### Phase 7 — Benchmark ingest + alias rules

Acceptance: fixture match ≥1 model; unmatched quarantined; **does not** claim engineering-task validation

### Phase 8 — Internal eval opt-in

**Deliverables:** `InternalTaskRunner`, `data/validation-tasks/*.yaml`, config gate.

**Acceptance:**
- Default config `validation.enabled: false` → `validate()` returns `{ "status": "disabled" }` without API calls
- `validation.enabled: true` + missing API keys → `{ "status": "error", "code": "MISSING_API_KEYS" }`; no partial runs; no registry writes
- `validation.enabled: true` + keys present → single fixture task runs; capability updated with `provenance.source: internal_validation`
- Documented cost warning in README + config schema description
- Does not run on MCP server startup

### Phase 9 — Telemetry + guidance + release

Acceptance for `generate_cursor_guidance`:
- Output validates schema
- Contains disclaimer string verbatim
- **Does not** claim model was applied
- Manual steps array present

---

## 11. Golden Dataset (30+ fixtures)

| Category | n |
|----------|---|
| Trivial docs | 4 |
| CRUD | 4 |
| Multi-file feature | 4 |
| Refactoring | 4 |
| Architecture | 4 |
| Security | 4 |
| Ambiguous/mixed | 3 |
| Monorepo context | 3 |

Each: `plan.md` + `expected.json` + optional `repo/`. Scoring fixtures use `acceptableModelIds[]`, not single hardcoded winner.

---

## 12. Testing Strategy

- Schema validation every tool response
- Privacy matrix §3 — Phase 5 gate
- Scoring stability §6
- `freeOnly + localOnly` empty → `filter_conflict`
- Stale `lastVerified > 30d` → `staleFields`
- Telemetry isolation architecture test
- Sync: recorded fixtures only in CI
- Guidance: disclaimer present

---

## 13. Pre-Implementation Checklist

- [x] Approve v4 plan for **Phase 0 only**
- [ ] Phase 0 acceptance complete
- [ ] Accept all calibration files as `provisional`
- [ ] Confirm v1 marketing does not claim continuous internal validation
- [ ] Confirm guidance-only Cursor integration
- [ ] Optional: maintainer runs `verify-cursor-ids.ts` when `CURSOR_API_KEY` available

---

## 14. MCP Tool Surface + phase gating

| Tool | Phase available | Pre-availability behavior |
|------|-----------------|---------------------------|
| `analyze_task` | 3+ | `{ "status": "not_implemented", "_fixture": true }` |
| `analyze_repository` | 3+ | stub |
| `recommend_model` | 5+ | stub |
| `estimate_cost` | 5+ | stub |
| `list_models` | 2+ | stub |
| `get_model_profile` | 2+ | stub |
| `sync_metadata` | **6+** | stub (same policy as Phase 1) |
| `get_telemetry_summary` | 9+ | stub |
| `generate_cursor_guidance` | 9+ | stub |

All stubs: `{ "status": "not_implemented", "_fixture": true }` — never fake model IDs or recommendations.

`sync_metadata` in privacy mode (Phase 6+): `{ "status": "blocked_by_privacy_mode" }`.
