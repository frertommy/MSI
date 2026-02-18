/**
 * Centralized path definitions for v0 (legacy) and v1 (layered) storage.
 * v0 paths must NEVER be changed — they power the current live site.
 */
import path from "path";

const ROOT = process.cwd();

// ── v0 legacy paths (DO NOT MODIFY) ──
export const V0_DATA_DIR = path.join(ROOT, "data");

// ── v1 layered paths ──
export const V1_DATA_DIR = path.join(ROOT, "data_v1");

export const L1_RAW_DIR = path.join(V1_DATA_DIR, "l1_facts", "raw");
export const L1_CANONICAL_DIR = path.join(V1_DATA_DIR, "l1_facts", "canonical");

export const L2_DERIVED_DIR = path.join(V1_DATA_DIR, "l2_derived");
export const L2_RUNS_DIR = path.join(L2_DERIVED_DIR, "runs");

export const CACHE_DIR = path.join(V1_DATA_DIR, "cache");

// Subdirectories under L1 raw
export const L1_RAW_MATCHES = path.join(L1_RAW_DIR, "matches");
export const L1_RAW_ODDS = path.join(L1_RAW_DIR, "odds");
export const L1_RAW_INJURIES = path.join(L1_RAW_DIR, "injuries");
export const L1_RAW_NEWS = path.join(L1_RAW_DIR, "news");
export const L1_RAW_SQUADS = path.join(L1_RAW_DIR, "squads");
