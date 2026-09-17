import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// src/db.ts creates its SQLite file (and src/services/epgChannelsService.ts
// its output directory) at import time, from these env vars -- set them to
// a fresh scratch directory before any test file's imports run, so tests
// never touch a real DATA_DIR/EPG_SHARED_DIR and each test file gets its
// own isolated database.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "iptv-catalog-test-data-"));
process.env.EPG_SHARED_DIR = mkdtempSync(join(tmpdir(), "iptv-catalog-test-epg-"));
