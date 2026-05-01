# Persistence

Rust Sense supports three persistence adapters:

- `sqlite` is the default and stores normalized bot state in `data/state.sqlite`.
- `postgres` stores the same normalized schema in Postgres for larger deployments.
- `json` keeps the legacy `instances/*.json` and `credentials/*.json` files and is deprecated.

The bot still assumes one active process owns Discord, Rust+ side effects, reconnect timers, FCM listeners, and voice/TTS state. Postgres makes durable storage production-ready, but it does not make active-active bot runtime coordination safe.

## Configuration

```bash
RPP_PERSISTENCE_ADAPTER=sqlite
RPP_SQLITE_PATH=data/state.sqlite
```

For Postgres:

```bash
RPP_PERSISTENCE_ADAPTER=postgres
RPP_POSTGRES_URL=postgres://user:password@host:5432/database
```

For legacy fallback:

```bash
RPP_PERSISTENCE_ADAPTER=json
```

## Migrations

SQLite:

```bash
pnpm run db:migrate:sqlite
```

Postgres:

```bash
DATABASE_URL='postgres://user:password@host:5432/database?sslmode=disable' pnpm run db:migrate:postgres
```

The application assumes dbmate has already migrated the database. If required tables are missing, startup fails before Discord login. Compose and Kubernetes examples run dbmate before the bot starts.

## Legacy JSON Import

When `sqlite` or `postgres` starts, existing `instances/*.json` and `credentials/*.json` are imported into relational tables before Discord login. Migration status and source metadata are stored in `_persistence_meta`:

- `legacy_json_migration_status`
- `legacy_json_migration_source_guild_count`
- `legacy_json_migration_source_checksum`

A completed marker prevents re-import. An `in_progress` marker fails startup and requires operator inspection.

## Smoke Test

SQLite and legacy JSON migration:

```bash
pnpm run persistence:smoke
```

SQLite plus Postgres:

```bash
RPP_TEST_POSTGRES_URL='postgres://postgres:postgres@127.0.0.1:15432/rustsense' pnpm run persistence:smoke
```
