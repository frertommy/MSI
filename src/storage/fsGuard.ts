/**
 * Filesystem guardrails for v1 layered storage.
 *
 * Rules:
 * - L1 raw: append-only — new timestamped files only, never overwrite.
 * - L1 canonical: allowed writes but must be rebuildable from raw.
 * - L2 derived: written under a run_id folder and never edited after.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { L1_RAW_DIR, L2_RUNS_DIR } from "./paths";

/**
 * Generate an ISO timestamp safe for filenames.
 * e.g. "2026-02-18T14-30-00Z"
 */
export function timestampTag(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Write an immutable file. Throws if the file already exists.
 * Used for L1 raw — append-only, never overwrite.
 *
 * @param filePath Absolute path under L1_RAW_DIR
 * @param data     Serializable object
 */
export function writeImmutable(filePath: string, data: unknown): void {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(L1_RAW_DIR))) {
    throw new Error(
      `writeImmutable: path must be under L1 raw dir. Got: ${resolved}`
    );
  }
  if (fs.existsSync(resolved)) {
    throw new Error(
      `writeImmutable: file already exists — append-only violation: ${resolved}`
    );
  }
  atomicWrite(resolved, data);
}

/**
 * Write a file under a specific run_id directory inside L2 derived.
 * Ensures the run folder exists but won't overwrite an existing file
 * within the same run (a run is a one-shot write).
 *
 * @param runId    The run identifier (e.g. "20260218T143000Z_abc1234")
 * @param relPath  Relative path inside the run folder (e.g. "msi_ratings.json")
 * @param data     Serializable object
 */
export function writeVersioned(
  runId: string,
  relPath: string,
  data: unknown
): void {
  const runDir = path.join(L2_RUNS_DIR, runId);
  const filePath = path.join(runDir, relPath);
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(path.resolve(L2_RUNS_DIR))) {
    throw new Error(
      `writeVersioned: path must be under L2 runs dir. Got: ${resolved}`
    );
  }

  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  if (fs.existsSync(resolved)) {
    throw new Error(
      `writeVersioned: file already exists in run ${runId} — runs are write-once: ${resolved}`
    );
  }
  atomicWrite(resolved, data);
}

/**
 * Atomic write: write to a temp file then rename.
 * Prevents partial/corrupt writes. Works for any path.
 *
 * @param filePath Absolute file path
 * @param data     Serializable object (will be JSON.stringify'd with 2-space indent)
 */
export function atomicWrite(filePath: string, data: unknown): void {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const tmpPath = `${resolved}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmpPath, json, "utf-8");
  fs.renameSync(tmpPath, resolved);
}

/**
 * Compute a stable content hash (sha256) for dedup purposes.
 */
export function contentHash(data: unknown): string {
  const json = JSON.stringify(data);
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 16);
}

/**
 * Generate a run_id in the format: <ISO_timestamp>_<git_short_hash>
 */
export function generateRunId(): string {
  const ts = timestampTag();
  let gitShort = "nogit";
  try {
    const { execSync } = require("child_process");
    gitShort = execSync("git rev-parse --short HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    // not in a git repo or git unavailable
  }
  return `${ts}_${gitShort}`;
}
