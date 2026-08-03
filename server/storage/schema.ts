export const SQLITE_APPLICATION_ID = 0x444c5632
export const SQLITE_USER_VERSION = 2
export const STORAGE_SCHEMA_VERSION = '2.0.0'

const OPAQUE_IDENTIFIER =
  "length(%COLUMN%) BETWEEN 1 AND 128 AND %COLUMN% NOT GLOB '*[^A-Za-z0-9:._-]*'"
const opaqueIdentifier = (column: string) => OPAQUE_IDENTIFIER.replaceAll('%COLUMN%', column)
const FEATURE_TYPES = "'feat', 'fix', 'docs', 'test', 'refactor', 'chore', 'perf', 'build', 'ci', 'revert', 'other'"
const COVERAGE_STATUSES = "'never_authorized', 'refused', 'unavailable', 'restricted', 'truncated', 'stale', 'failed', 'deleted', 'censored', 'complete'"

export const STORAGE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS import_run (
    source_checksum TEXT PRIMARY KEY NOT NULL,
    schema_version TEXT NOT NULL CHECK (schema_version = '${STORAGE_SCHEMA_VERSION}')
  ) STRICT;

  CREATE TABLE IF NOT EXISTS repository_identity (
    provider_id TEXT PRIMARY KEY NOT NULL CHECK (${opaqueIdentifier('provider_id')}),
    analytical_key TEXT NOT NULL UNIQUE CHECK (${opaqueIdentifier('analytical_key')}),
    is_private INTEGER NOT NULL CHECK (is_private IN (0, 1)),
    is_archived INTEGER NOT NULL CHECK (is_archived IN (0, 1)),
    is_fork INTEGER NOT NULL CHECK (is_fork IN (0, 1))
  ) STRICT;

  CREATE TABLE IF NOT EXISTS commit_observation (
    repository_provider_id TEXT NOT NULL REFERENCES repository_identity(provider_id),
    sha TEXT NOT NULL CHECK (${opaqueIdentifier('sha')}),
    occurred_at TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('github', 'local-git')),
    additions INTEGER,
    deletions INTEGER,
    files INTEGER,
    parent_count INTEGER,
    feature_type TEXT NOT NULL CHECK (feature_type IN (${FEATURE_TYPES})),
    is_revert INTEGER NOT NULL CHECK (is_revert IN (0, 1)),
    is_fixup INTEGER NOT NULL CHECK (is_fixup IN (0, 1)),
    message_length INTEGER NOT NULL,
    PRIMARY KEY (repository_provider_id, sha)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS pull_request_fact (
    provider_id TEXT PRIMARY KEY NOT NULL CHECK (${opaqueIdentifier('provider_id')}),
    repository_provider_id TEXT NOT NULL REFERENCES repository_identity(provider_id),
    number INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    merged_at TEXT,
    closed_at TEXT,
    state TEXT NOT NULL CHECK (state IN ('OPEN', 'CLOSED', 'MERGED')),
    is_draft INTEGER NOT NULL CHECK (is_draft IN (0, 1)),
    additions INTEGER,
    deletions INTEGER,
    changed_files INTEGER,
    comments INTEGER NOT NULL,
    reviews INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS coverage_observation (
    capability_id TEXT PRIMARY KEY NOT NULL CHECK (capability_id IN ('github.core', 'cap.local.git')),
    status TEXT NOT NULL CHECK (status IN (${COVERAGE_STATUSES})),
    limitation_code TEXT NOT NULL CHECK (length(limitation_code) BETWEEN 1 AND 64 AND limitation_code NOT GLOB '*[^A-Z0-9_]*'),
    observed_units INTEGER NOT NULL CHECK (observed_units >= 0)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS dated_event_observation (
    provider_id TEXT PRIMARY KEY NOT NULL CHECK (${opaqueIdentifier('provider_id')}),
    repository_provider_id TEXT NOT NULL REFERENCES repository_identity(provider_id),
    occurred_at TEXT NOT NULL,
    event_kind TEXT NOT NULL CHECK (event_kind IN ('review', 'issue'))
  ) STRICT;
`
