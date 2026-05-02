-- migrate:up
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS _persistence_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO _persistence_meta (key, value, updated_at)
VALUES ('schema_version', '1', CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS guilds (
  guild_id TEXT PRIMARY KEY,
  first_time INTEGER NOT NULL,
  role_id TEXT,
  admin_role_id TEXT,
  active_server_id TEXT,
  channel_category_id TEXT,
  channel_information_id TEXT,
  channel_servers_id TEXT,
  channel_settings_id TEXT,
  channel_commands_id TEXT,
  channel_events_id TEXT,
  channel_teamchat_id TEXT,
  channel_switches_id TEXT,
  channel_switch_groups_id TEXT,
  channel_alarms_id TEXT,
  channel_storage_monitors_id TEXT,
  channel_activity_id TEXT,
  channel_trackers_id TEXT,
  information_map_message_id TEXT,
  information_server_message_id TEXT,
  information_event_message_id TEXT,
  information_team_message_id TEXT,
  information_battlemetrics_players_message_id TEXT
);

CREATE TABLE IF NOT EXISTS guild_general_settings (
  guild_id TEXT PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  voice_gender TEXT NOT NULL,
  tts_provider TEXT NOT NULL,
  piper_voice TEXT NOT NULL,
  prefix TEXT NOT NULL,
  mute_in_game_bot_messages INTEGER NOT NULL,
  trademark TEXT NOT NULL,
  in_game_commands_enabled INTEGER NOT NULL,
  in_game_command_access_mode TEXT NOT NULL,
  fcm_alarm_notification_enabled INTEGER NOT NULL,
  fcm_alarm_notification_everyone INTEGER NOT NULL,
  smart_alarm_notify_in_game INTEGER NOT NULL,
  smart_switch_notify_in_game_when_changed_from_discord INTEGER NOT NULL,
  leader_command_enabled INTEGER NOT NULL,
  leader_command_only_for_paired INTEGER NOT NULL,
  command_delay TEXT NOT NULL,
  connection_notify INTEGER NOT NULL,
  afk_notify INTEGER NOT NULL,
  death_notify INTEGER NOT NULL,
  map_wipe_notify_everyone INTEGER NOT NULL,
  item_available_in_vending_machine_notify_in_game INTEGER NOT NULL,
  display_information_battlemetrics_all_online_players INTEGER NOT NULL,
  battlemetrics_server_name_changes INTEGER NOT NULL,
  battlemetrics_tracker_name_changes INTEGER NOT NULL,
  battlemetrics_global_name_changes INTEGER NOT NULL,
  battlemetrics_global_login INTEGER NOT NULL,
  battlemetrics_global_logout INTEGER NOT NULL,
  teammate_name_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guild_notification_settings (
  guild_id TEXT PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  cargo_ship_detected_image TEXT NOT NULL,
  cargo_ship_detected_discord INTEGER NOT NULL,
  cargo_ship_detected_in_game INTEGER NOT NULL,
  cargo_ship_detected_voice INTEGER NOT NULL,
  cargo_ship_left_image TEXT NOT NULL,
  cargo_ship_left_discord INTEGER NOT NULL,
  cargo_ship_left_in_game INTEGER NOT NULL,
  cargo_ship_left_voice INTEGER NOT NULL,
  cargo_ship_egress_image TEXT NOT NULL,
  cargo_ship_egress_discord INTEGER NOT NULL,
  cargo_ship_egress_in_game INTEGER NOT NULL,
  cargo_ship_egress_voice INTEGER NOT NULL,
  cargo_ship_docking_at_harbor_image TEXT NOT NULL,
  cargo_ship_docking_at_harbor_discord INTEGER NOT NULL,
  cargo_ship_docking_at_harbor_in_game INTEGER NOT NULL,
  cargo_ship_docking_at_harbor_voice INTEGER NOT NULL,
  patrol_helicopter_detected_image TEXT NOT NULL,
  patrol_helicopter_detected_discord INTEGER NOT NULL,
  patrol_helicopter_detected_in_game INTEGER NOT NULL,
  patrol_helicopter_detected_voice INTEGER NOT NULL,
  patrol_helicopter_left_image TEXT NOT NULL,
  patrol_helicopter_left_discord INTEGER NOT NULL,
  patrol_helicopter_left_in_game INTEGER NOT NULL,
  patrol_helicopter_left_voice INTEGER NOT NULL,
  patrol_helicopter_destroyed_image TEXT NOT NULL,
  patrol_helicopter_destroyed_discord INTEGER NOT NULL,
  patrol_helicopter_destroyed_in_game INTEGER NOT NULL,
  patrol_helicopter_destroyed_voice INTEGER NOT NULL,
  locked_crate_oil_rig_unlocked_image TEXT NOT NULL,
  locked_crate_oil_rig_unlocked_discord INTEGER NOT NULL,
  locked_crate_oil_rig_unlocked_in_game INTEGER NOT NULL,
  locked_crate_oil_rig_unlocked_voice INTEGER NOT NULL,
  heavy_scientist_called_image TEXT NOT NULL,
  heavy_scientist_called_discord INTEGER NOT NULL,
  heavy_scientist_called_in_game INTEGER NOT NULL,
  heavy_scientist_called_voice INTEGER NOT NULL,
  chinook47_detected_image TEXT NOT NULL,
  chinook47_detected_discord INTEGER NOT NULL,
  chinook47_detected_in_game INTEGER NOT NULL,
  chinook47_detected_voice INTEGER NOT NULL,
  traveling_vendor_detected_image TEXT NOT NULL,
  traveling_vendor_detected_discord INTEGER NOT NULL,
  traveling_vendor_detected_in_game INTEGER NOT NULL,
  traveling_vendor_detected_voice INTEGER NOT NULL,
  traveling_vendor_halted_image TEXT NOT NULL,
  traveling_vendor_halted_discord INTEGER NOT NULL,
  traveling_vendor_halted_in_game INTEGER NOT NULL,
  traveling_vendor_halted_voice INTEGER NOT NULL,
  traveling_vendor_left_image TEXT NOT NULL,
  traveling_vendor_left_discord INTEGER NOT NULL,
  traveling_vendor_left_in_game INTEGER NOT NULL,
  traveling_vendor_left_voice INTEGER NOT NULL,
  deep_sea_detected_image TEXT NOT NULL,
  deep_sea_detected_discord INTEGER NOT NULL,
  deep_sea_detected_in_game INTEGER NOT NULL,
  deep_sea_detected_voice INTEGER NOT NULL,
  deep_sea_left_map_image TEXT NOT NULL,
  deep_sea_left_map_discord INTEGER NOT NULL,
  deep_sea_left_map_in_game INTEGER NOT NULL,
  deep_sea_left_map_voice INTEGER NOT NULL,
  vending_machine_detected_image TEXT NOT NULL,
  vending_machine_detected_discord INTEGER NOT NULL,
  vending_machine_detected_in_game INTEGER NOT NULL,
  vending_machine_detected_voice INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS servers (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  server_id TEXT NOT NULL,
  title TEXT NOT NULL,
  server_ip TEXT NOT NULL,
  app_port INTEGER NOT NULL,
  steam_id TEXT NOT NULL,
  player_token TEXT NOT NULL,
  battlemetrics_id TEXT,
  cargo_ship_egress_time_ms INTEGER NOT NULL,
  oil_rig_locked_crate_unlock_time_ms INTEGER NOT NULL,
  deep_sea_min_wipe_cooldown_ms INTEGER NOT NULL,
  deep_sea_max_wipe_cooldown_ms INTEGER NOT NULL,
  deep_sea_wipe_duration_ms INTEGER NOT NULL,
  message_id TEXT,
  connect TEXT,
  img TEXT,
  url TEXT,
  description TEXT,
  PRIMARY KEY (guild_id, server_id)
);

CREATE TABLE IF NOT EXISTS server_time_samples (
  guild_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('day', 'night')),
  sample_key TEXT NOT NULL,
  seconds REAL NOT NULL,
  PRIMARY KEY (guild_id, server_id, phase, sample_key),
  FOREIGN KEY (guild_id, server_id) REFERENCES servers(guild_id, server_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS smart_switches (
  guild_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  switch_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL,
  reachable INTEGER NOT NULL,
  location TEXT,
  x REAL,
  y REAL,
  image TEXT,
  command TEXT NOT NULL,
  auto_day_night_on_off INTEGER NOT NULL,
  proximity INTEGER NOT NULL,
  message_id TEXT,
  everyone INTEGER,
  PRIMARY KEY (guild_id, server_id, switch_id),
  FOREIGN KEY (guild_id, server_id) REFERENCES servers(guild_id, server_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS smart_alarms (
  guild_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  alarm_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL,
  reachable INTEGER NOT NULL,
  location TEXT,
  x REAL,
  y REAL,
  image TEXT,
  message TEXT NOT NULL,
  command TEXT NOT NULL,
  last_trigger INTEGER,
  in_game INTEGER NOT NULL,
  message_id TEXT,
  everyone INTEGER NOT NULL,
  PRIMARY KEY (guild_id, server_id, alarm_id),
  FOREIGN KEY (guild_id, server_id) REFERENCES servers(guild_id, server_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS storage_monitors (
  guild_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  storage_monitor_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  image TEXT,
  reachable INTEGER NOT NULL,
  location TEXT,
  x REAL,
  y REAL,
  capacity INTEGER,
  decaying INTEGER,
  in_game INTEGER,
  message_id TEXT,
  everyone INTEGER NOT NULL,
  upkeep TEXT,
  PRIMARY KEY (guild_id, server_id, storage_monitor_id),
  FOREIGN KEY (guild_id, server_id) REFERENCES servers(guild_id, server_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS storage_monitor_items (
  guild_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  storage_monitor_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (guild_id, server_id, storage_monitor_id, item_id),
  FOREIGN KEY (guild_id, server_id, storage_monitor_id)
    REFERENCES storage_monitors(guild_id, server_id, storage_monitor_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS switch_groups (
  guild_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  group_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL,
  image TEXT,
  command TEXT NOT NULL,
  message_id TEXT,
  PRIMARY KEY (guild_id, server_id, group_id),
  FOREIGN KEY (guild_id, server_id) REFERENCES servers(guild_id, server_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS switch_group_members (
  guild_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  group_id INTEGER NOT NULL,
  switch_id INTEGER NOT NULL,
  PRIMARY KEY (guild_id, server_id, group_id, switch_id),
  FOREIGN KEY (guild_id, server_id, group_id) REFERENCES switch_groups(guild_id, server_id, group_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS custom_camera_groups (
  guild_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  group_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (guild_id, server_id, group_id),
  FOREIGN KEY (guild_id, server_id) REFERENCES servers(guild_id, server_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS custom_camera_group_members (
  guild_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  group_id INTEGER NOT NULL,
  camera TEXT NOT NULL,
  PRIMARY KEY (guild_id, server_id, group_id, camera),
  FOREIGN KEY (guild_id, server_id, group_id) REFERENCES custom_camera_groups(guild_id, server_id, group_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS markers (
  guild_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  marker_key TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  location TEXT NOT NULL,
  PRIMARY KEY (guild_id, server_id, marker_key),
  FOREIGN KEY (guild_id, server_id) REFERENCES servers(guild_id, server_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  guild_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  note_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  PRIMARY KEY (guild_id, server_id, note_id),
  FOREIGN KEY (guild_id, server_id) REFERENCES servers(guild_id, server_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trackers (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  tracker_id TEXT NOT NULL,
  id INTEGER NOT NULL,
  name TEXT NOT NULL,
  battlemetrics_id TEXT NOT NULL,
  status INTEGER NOT NULL,
  last_screenshot TEXT,
  last_online TEXT,
  last_wipe TEXT,
  message_id TEXT,
  clan_tag TEXT,
  everyone INTEGER NOT NULL,
  in_game INTEGER NOT NULL,
  img TEXT,
  title TEXT,
  server_id TEXT,
  PRIMARY KEY (guild_id, tracker_id)
);

CREATE TABLE IF NOT EXISTS tracker_players (
  guild_id TEXT NOT NULL,
  tracker_id TEXT NOT NULL,
  player_index INTEGER NOT NULL,
  name TEXT,
  steam_id TEXT,
  player_id TEXT,
  PRIMARY KEY (guild_id, tracker_id, player_index),
  FOREIGN KEY (guild_id, tracker_id) REFERENCES trackers(guild_id, tracker_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS market_subscriptions (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  list_type TEXT NOT NULL CHECK (list_type IN ('all', 'buy', 'sell')),
  item TEXT NOT NULL,
  PRIMARY KEY (guild_id, list_type, item)
);

CREATE TABLE IF NOT EXISTS market_blacklist (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  PRIMARY KEY (guild_id, item)
);

CREATE TABLE IF NOT EXISTS blacklist_entries (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('discord', 'steam')),
  entry_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, entry_type, entry_id)
);

CREATE TABLE IF NOT EXISTS whitelist_entries (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  steam_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, steam_id)
);

CREATE TABLE IF NOT EXISTS aliases (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  alias_index INTEGER NOT NULL,
  alias TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (guild_id, alias_index)
);

CREATE TABLE IF NOT EXISTS custom_intl_messages (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  message_key TEXT NOT NULL,
  message TEXT NOT NULL,
  PRIMARY KEY (guild_id, message_key)
);

CREATE TABLE IF NOT EXISTS team_chat_colors (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  steam_id TEXT NOT NULL,
  color TEXT NOT NULL,
  PRIMARY KEY (guild_id, steam_id)
);

CREATE TABLE IF NOT EXISTS fcm_credentials (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  steam_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  gcm_android_id TEXT NOT NULL,
  gcm_security_token TEXT NOT NULL,
  issued_date TEXT,
  expire_date TEXT,
  PRIMARY KEY (guild_id, steam_id)
);

CREATE TABLE IF NOT EXISTS credentials_hoster (
  guild_id TEXT PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
  steam_id TEXT
);

-- migrate:down
DROP TABLE IF EXISTS fcm_credentials;
DROP TABLE IF EXISTS credentials_hoster;
DROP TABLE IF EXISTS team_chat_colors;
DROP TABLE IF EXISTS custom_intl_messages;
DROP TABLE IF EXISTS aliases;
DROP TABLE IF EXISTS whitelist_entries;
DROP TABLE IF EXISTS blacklist_entries;
DROP TABLE IF EXISTS market_blacklist;
DROP TABLE IF EXISTS market_subscriptions;
DROP TABLE IF EXISTS tracker_players;
DROP TABLE IF EXISTS trackers;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS markers;
DROP TABLE IF EXISTS custom_camera_group_members;
DROP TABLE IF EXISTS custom_camera_groups;
DROP TABLE IF EXISTS switch_group_members;
DROP TABLE IF EXISTS switch_groups;
DROP TABLE IF EXISTS storage_monitor_items;
DROP TABLE IF EXISTS storage_monitors;
DROP TABLE IF EXISTS smart_alarms;
DROP TABLE IF EXISTS smart_switches;
DROP TABLE IF EXISTS server_time_samples;
DROP TABLE IF EXISTS servers;
DROP TABLE IF EXISTS guild_notification_settings;
DROP TABLE IF EXISTS guild_general_settings;
DROP TABLE IF EXISTS guilds;
DROP TABLE IF EXISTS _persistence_meta;
