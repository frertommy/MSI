/**
 * Storage layer — single entry point.
 *
 * Re-exports guards and path constants for use by ingest/ and process/.
 */
export {
  writeImmutable,
  writeVersioned,
  atomicWrite,
  contentHash,
  timestampTag,
  generateRunId,
} from "./fsGuard";

export {
  V0_DATA_DIR,
  V1_DATA_DIR,
  L1_RAW_DIR,
  L1_CANONICAL_DIR,
  L2_DERIVED_DIR,
  L2_RUNS_DIR,
  CACHE_DIR,
  L1_RAW_MATCHES,
  L1_RAW_ODDS,
  L1_RAW_INJURIES,
  L1_RAW_NEWS,
  L1_RAW_SQUADS,
} from "./paths";
