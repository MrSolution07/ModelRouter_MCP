# Golden Dataset Specification

Version: 1.0.0  
Calibration status: provisional  
Minimum fixtures: 30

## Purpose

Evaluate Layer A heuristic analysis (task type classification and complexity scoring) without routing to specific model IDs.

## Directory Structure

```
data/golden/
  trivial_docs/
    01/plan.md + expected.json [+ optional repo/]
  crud/
    01/ ...
  multi_file_feature/
    01/ ...
  refactoring/
    01/ ...
  architecture/
    01/ ...
  security/
    01/ ...
  ambiguous/
    01/ ...
  monorepo/
    01/ ...
```

## Categories and Counts

| Category | Minimum fixtures |
|----------|------------------|
| Trivial docs | 4 |
| CRUD | 4 |
| Multi-file feature | 4 |
| Refactoring | 4 |
| Architecture | 4 |
| Security | 4 |
| Ambiguous/mixed | 3 |
| Monorepo context | 3 |
| **Total** | **30** |

## expected.json Schema

```json
{
  "taskType": "string — one of task-signals.json taskTypes",
  "complexityRange": { "min": 1, "max": 10 },
  "acceptableRequirementVector": {
    "dimension": { "min": 0, "max": 10 }
  },
  "acceptableModelIds": ["string — for scoring fixtures only, not single hardcoded winner"],
  "notes": "optional string"
}
```

## Acceptance Criteria

- Task type classification: ≥85% accuracy on golden set
- Complexity scoring: ±1 of expected for ≥80% of fixtures
- Scoring fixtures use `acceptableModelIds[]` — winner must be in set, not a single hardcoded ID

## Scoring Fixtures (separate)

Located in `data/golden/scoring/` — each fixture provides:
- `requirementVector.json`
- `config.json` (optional filters)
- `expected.json` with `acceptableModelIds[]` and optional `rejectedModelIds[]`
