-- migrate:up
CREATE TABLE IF NOT EXISTS server_lite_entries (
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  server_id TEXT NOT NULL,
  steam_id TEXT NOT NULL,
  server_ip TEXT NOT NULL,
  app_port INTEGER NOT NULL,
  player_token TEXT NOT NULL,
  PRIMARY KEY (guild_id, server_id, steam_id)
);

-- migrate:down
DROP TABLE IF EXISTS server_lite_entries;
