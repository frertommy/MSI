# v1 Layered Storage Pipeline

## Overview

MSI v1 introduces a **layered data architecture** alongside the existing v0 filesystem:

- **L1 Facts** (`data_v1/l1_facts/`) — immutable, append-only raw source data
- **L2 Derived** (`data_v1/l2_derived/`) — versioned model outputs, each under a `run_id`

The existing v0 site (`data/*.json`) is **completely untouched** and continues to work as before.

## Directory Structure

```
data_v1/
  l1_facts/
    raw/               # Append-only raw fetch payloads
      matches/         # Timestamped match snapshots
      odds/            # Timestamped odds snapshots
      injuries/        # Timestamped injury snapshots
      news/            # Timestamped news snapshots
    canonical/         # Normalized facts (rebuildable from raw)
      teams.json
      fixtures.json
      match_results.json
      odds_snapshots.json
  l2_derived/
    model_versions.json
    latest_run.json
    runs/
      <run_id>/        # e.g. 2026-02-18T12-04-39-068Z_dcb2875
        model_version.json
        msi_ratings.json
        msi_daily.json
        msi_live.json
        oracle_prices.json
```

## Running the v1 Pipeline

### Prerequisites

- Node.js 18+
- Existing v0 data in `data/` (run `npm run pipeline` first if needed)

### Commands

```bash
# Ingest: snapshot v0 data into L1 raw (append-only)
npm run ingest:v1

# Process: build L1 canonical + L2 derived from latest raw snapshots
npm run process:v1

# Full pipeline (ingest + process)
npm run pipeline:v1
```

### What each step does

1. **`ingest:v1`** reads from `data/*.json` and writes immutable snapshots into `data_v1/l1_facts/raw/`. Each file is timestamped and content-hashed for dedup.

2. **`process:v1`** reads the latest raw snapshots, builds canonical files (`teams.json`, `fixtures.json`, etc.), computes Elo ratings (base + odds-adjusted), computes oracle prices, and writes everything under a new `run_id` in `data_v1/l2_derived/runs/`.

### v0 is NOT affected

- v0 continues reading from `data/*.json` via `lib/data.ts`
- The v1 pipeline only writes to `data_v1/`
- No existing files are modified, renamed, or deleted

## Code Organization

```
src/
  storage/        # File paths + write guardrails (fsGuard.ts)
  model/          # Pure functions (elo, odds, injuries, oracle)
  ingest/         # L1 raw writers (reads v0, writes data_v1/l1_facts/raw/)
  process/        # L1 canonical + L2 derived builders
```

### Storage Guardrails

- `writeImmutable(path, data)` — only writes new files, throws if exists (L1 raw)
- `writeVersioned(runId, path, data)` — writes under run directory, throws if exists (L2)
- `atomicWrite(path, data)` — write to temp file then rename (prevents corruption)

## Frontend Data Sources

```
lib/dataSources/
  v0.ts   # Wraps existing lib/data.ts (unchanged behavior)
  l1.ts   # Reads from data_v1/l1_facts/canonical/
  l2.ts   # Reads from data_v1/l2_derived/runs/<run_id>/
```

### Routes

| Route | Source | Status |
|-------|--------|--------|
| `/`   | v0     | Full (existing) |
| `/l1` | L1     | Stub (stats summary) |
| `/l2` | L2     | Stub (top 10 table + oracle prices) |

## Model Version & Run ID

Each `process:v1` run creates:

- **run_id**: `<ISO_timestamp>_<git_short_hash>` (e.g. `2026-02-18T12-04-39-068Z_dcb2875`)
- **model_version.json**: records K-factor, home advantage, odds weights, oracle params, git commit
- **latest_run.json**: pointer file so the FE doesn't scan directories

## Oracle Price Mapping

```
oracle_price = P0 * exp(beta * (msi_final - MSI0))
```

Default params: `P0=100, beta=0.005, MSI0=1500`

Stored in `model_version.json` → `paramsJson.oracle`.
