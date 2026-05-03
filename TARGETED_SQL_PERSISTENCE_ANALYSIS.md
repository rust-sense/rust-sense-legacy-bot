# Targeted SQL Persistence Analysis

## Summary

The current `feat/relational-persistence` branch has moved persistence to `json`, `sqlite`, and `postgres` adapters, with SQLite as the active target. Several older analysis notes are now stale because transaction safety, schema version checks, Postgres on-demand reads, and legacy JSON migration state/logging have already been addressed.

The remaining architectural risk is the compatibility write model:

1. Call sites read a full guild snapshot with `readGuildState()`.
2. They mutate the snapshot.
3. They persist with `saveGuildStateChanges()`.
4. `saveGuildStateChanges()` compares the stale snapshot to the current DB state and writes whole domains such as `servers` or `collections`.

This can lose concurrent updates. The desired direction is direct-to-DB operations with targeted SQL writes, not an in-memory cache or shared object layer.

## Current Live Risks

### 1. Whole-domain replacement can lose concurrent updates

`PersistenceService.saveGuildStateChanges()` still re-reads the full guild state and then calls `writeGuildDomains()` for broad domains. For `servers` and `collections`, both SQL adapters delete and reinsert many rows.

Example failure mode:

1. Handler A reads guild state and toggles switch `1`.
2. Handler B reads the same old guild state and updates switch `2`.
3. Handler A writes the `servers` domain.
4. Handler B writes its old `servers` snapshot and erases Handler A's switch `1` change.

This is the main issue to fix before merging to `develop`.

Relevant code:
- `src/persistence/PersistenceService.ts`: `readGuildState()`, `saveGuildStateChanges()`
- `src/persistence/SqliteAdapter.ts`: `replaceServers()`, `replaceGuildCollections()`, `writeGuildDomains()`
- `src/persistence/PostgresAdapter.ts`: `replaceServers()`, `replaceGuildCollections()`, `writeGuildDomains()`

### 2. Async Rust+ message handlers are not awaited

`src/rustplusEvents/message.ts` still dispatches async handlers from synchronous functions without `await`. Errors can become unhandled rejections, and event handling has no sequencing/backpressure where the code appears to expect it.

Action:
- Make `execute`, `messageBroadcast`, `messageBroadcastTeamChanged`, and `messageBroadcastEntityChanged` async where needed.
- Await `TeamHandler.processTeamUpdate()` if it returns a promise.
- Await entity changed handlers and message handlers.
- Either await follow-up Discord message sends or explicitly detach them with `.catch(...)` and a log.

### 3. Embed builders still persist side effects

`src/discordTools/discordEmbeds.ts` still mutates and saves persistence while rendering embeds:

- storage monitor upkeep is calculated and persisted inside `getStorageMonitorEmbed()`
- switch group cleanup is performed inside `getSmartSwitchGroupEmbed()`

Embed builders should be read-only. These writes should move into services or targeted persistence methods called before rendering.

### 4. Long async workflows hold stale snapshots

Several services and Discord helpers read a snapshot, perform external work, then save broad state. Examples include:

- `src/services/storageMonitorService.ts`
- `src/services/battlemetricsService.ts`
- `src/services/smartSwitchService.ts`
- `src/discordTools/discordMessages.ts`
- `src/handlers/buttonHandler.ts`
- `src/handlers/modalHandler.ts`

The fix is not a cache. The fix is to replace snapshot mutation with targeted operations close to the business action.

## Desired Persistence Direction

Use direct database operations for writes. Avoid whole-guild or whole-domain replacement in runtime workflows.

Keep compatibility snapshot reads only where a full read is genuinely needed to render UI or make decisions. Once a workflow decides to persist a change, call a targeted method that updates only the relevant row or set of child rows.

Examples:

```ts
await persistence.updateSmartSwitch(guildId, serverId, switchId, {
    active,
    reachable: true,
});
```

```ts
await persistence.setSmartSwitchMessageId(guildId, serverId, switchId, message.id);
```

```ts
await persistence.replaceStorageMonitorItems(guildId, serverId, monitorId, items);
await persistence.updateStorageMonitor(guildId, serverId, monitorId, {
    reachable,
    type,
    decaying,
    upkeep,
});
```

These should compile to `UPDATE`, `INSERT ... ON CONFLICT DO UPDATE`, or scoped child-table replacement for one parent entity, not `DELETE FROM servers WHERE guild_id = ?`.

## Proposed API Additions

Add targeted methods to `PersistenceService`, then implement adapter methods behind them. Keep names use-case oriented and narrow.

### Guild core and Discord IDs

- `setActiveServer(guildId, serverId | null)`
- `setGuildRole(guildId, roleId | null)`
- `setGuildAdminRole(guildId, roleId | null)`
- `setChannelId(guildId, key, channelId | null)`
- `setInformationMessageId(guildId, key, messageId | null)`
- `markFirstTimeComplete(guildId)`

### Settings

- Keep `setGeneralSetting()` and `setNotificationSettings()`, but preferably make single-setting writes update one row instead of rewriting all settings.
- Add `setNotificationSetting(guildId, key, value)` if common call sites only change one value.

### Server metadata

- `upsertServer(guildId, serverId, server)` can remain broad for server pairing/setup.
- `deleteServer(guildId, serverId)` can remain scoped to one server and rely on cascade or explicit child deletes.
- `updateServerMetadata(guildId, serverId, patch)`
- `setServerMessageId(guildId, serverId, messageId | null)`

### Smart switches

- `upsertSmartSwitch(guildId, serverId, switchId, smartSwitch)`
- `updateSmartSwitch(guildId, serverId, switchId, patch)`
- `setSmartSwitchActive(guildId, serverId, switchId, active)`
- `setSmartSwitchReachable(guildId, serverId, switchId, reachable)`
- `setSmartSwitchMessageId(guildId, serverId, switchId, messageId | null)`

### Smart alarms

- `upsertSmartAlarm(guildId, serverId, alarmId, alarm)`
- `updateSmartAlarm(guildId, serverId, alarmId, patch)`
- `setSmartAlarmActive(guildId, serverId, alarmId, active)`
- `setSmartAlarmLastTrigger(guildId, serverId, alarmId, timestamp)`
- `setSmartAlarmMessageId(guildId, serverId, alarmId, messageId | null)`

### Storage monitors

- `upsertStorageMonitor(guildId, serverId, monitorId, monitor)`
- `updateStorageMonitor(guildId, serverId, monitorId, patch)`
- `replaceStorageMonitorItems(guildId, serverId, monitorId, items)`
- `setStorageMonitorMessageId(guildId, serverId, monitorId, messageId | null)`
- `setStorageMonitorUpkeep(guildId, serverId, monitorId, upkeep | null)`

Replacing storage monitor items is acceptable if scoped to one monitor:

```sql
DELETE FROM storage_monitor_items
WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?;
```

### Switch groups

- `upsertSwitchGroup(guildId, serverId, groupId, group)`
- `updateSwitchGroup(guildId, serverId, groupId, patch)`
- `replaceSwitchGroupMembers(guildId, serverId, groupId, switchIds)`
- `removeSwitchFromGroups(guildId, serverId, switchId)`
- `setSwitchGroupMessageId(guildId, serverId, groupId, messageId | null)`

### Trackers and BattleMetrics

- `upsertTracker(guildId, trackerId, tracker)`
- `updateTracker(guildId, trackerId, patch)`
- `replaceTrackerPlayers(guildId, trackerId, players)`
- `updateTrackerPlayer(guildId, trackerId, playerIndex, patch)`
- `setTrackerMessageId(guildId, trackerId, messageId | null)`

Replacing players is acceptable if scoped to one tracker, not the whole `collections` domain.

### Collections

- `addAlias`, `removeAlias`, `replaceAlias`
- `addBlacklistEntry`, `removeBlacklistEntry`
- `addWhitelistEntry`, `removeWhitelistEntry`
- `addMarketSubscription`, `removeMarketSubscription`
- `addMarketBlacklistItem`, `removeMarketBlacklistItem`
- `setCustomIntlMessage`, `deleteCustomIntlMessage`
- `setTeamChatColor`, `deleteTeamChatColor`

## Adapter Contract Changes

The adapter interface should grow targeted methods or grouped repositories. Two acceptable shapes:

1. Flat adapter methods, simplest for this codebase:

```ts
updateSmartSwitch(guildId, serverId, switchId, patch): MaybePromise<void>;
replaceStorageMonitorItems(guildId, serverId, monitorId, items): MaybePromise<void>;
```

2. Repository-style fields, cleaner long-term:

```ts
adapter.smartSwitches.update(guildId, serverId, switchId, patch);
adapter.storageMonitors.replaceItems(guildId, serverId, monitorId, items);
```

Given the current code already uses `PersistenceService`, the flat service API is likely the least disruptive first step. The adapters can remain lower-level implementation details.

## Migration Plan

### Phase 1: Add targeted adapter/service methods

Add focused methods for the highest-write entities first:

1. smart switches
2. smart alarms
3. storage monitors
4. Discord message IDs
5. trackers

Implement in SQLite and Postgres. Implement in JSON by loading the JSON object, changing the targeted field, and writing it back atomically. JSON remains a compatibility backend, so it can still rewrite the JSON file internally.

### Phase 2: Fix async dispatch

Fix `src/rustplusEvents/message.ts` to await async handlers and log detached follow-up failures intentionally.

### Phase 3: Remove embed persistence side effects

Move upkeep and switch-group cleanup writes out of embed builders.

For upkeep:
- compute display string in the embed without saving, or
- update upkeep in `storageMonitorService` / `messageBroadcastEntityChangedStorageMonitor` before sending the message.

For switch groups:
- perform stale-member cleanup in the switch/group service, not during rendering.

### Phase 4: Convert high-risk runtime workflows

Prioritize workflows that currently save broad snapshots after awaits:

1. `rustplusEvents/message.ts`
2. `services/smartSwitchService.ts`
3. `services/smartAlarmService.ts`
4. `services/storageMonitorService.ts`
5. `discordTools/discordMessages.ts`
6. `services/battlemetricsService.ts`
7. `handlers/buttonHandler.ts`
8. `handlers/modalHandler.ts`

### Phase 5: Shrink or remove `saveGuildStateChanges()`

Once high-risk workflows are converted, make `saveGuildStateChanges()` hard to misuse:

- rename it to `saveCompatibilitySnapshotForMigrationOnly()`, or
- mark it deprecated and log a warning outside tests/migration, or
- remove it entirely after call sites are gone.

The goal is for normal bot workflows to never call whole-domain replacement.

## Still Useful But Lower Priority

### Legacy migration resume

Migration state now prevents repeat migrations and logs clearly, but a failed `in_progress` migration still requires manual intervention. Add one of:

- per-guild migration progress, or
- `RPP_FORCE_LEGACY_MIGRATION=true`, or
- an operator script that inspects and resets migration state.

This is lower priority than runtime data-loss prevention.

### Postgres pool and SSL config

Postgres is not the active deployment target right now, but the adapter should eventually accept:

- max connections
- idle timeout
- connection timeout
- SSL mode

### Explicit delete clarity

`deleteGuild()` currently relies on foreign-key cascade. That is acceptable if migrations and adapter initialization enforce foreign keys, but explicit child-table deletes can improve auditability.

## Stale Findings From Old Notes

These findings were valid against earlier versions of the branch but no longer need action:

- SQLite public multi-statement writes lacking transactions: fixed.
- Postgres `hasGuild()` only checking memory: fixed.
- Postgres full database mirror: no longer present.
- Postgres credentials read only from memory: fixed.
- Postgres silent write queue: no longer present.
- Hollow schema validation key: replaced with `schema_version`.
- Missing `guildDelete` handler: present.
- General utility/service directory refactor plan: already implemented separately.

## Recommended Next Step

Start with the smallest proof of the new write model:

1. Add targeted smart switch update methods to the service and adapters.
2. Convert switch active/reachable/message-id call sites.
3. Add a concurrency regression test that updates two switches concurrently and verifies neither update is lost.
4. Repeat the pattern for alarms, storage monitors, and trackers.

This gives a concrete template for the rest of the refactor while preserving the direct-to-DB architecture.
