create table if not exists players (
  player_id text primary key,
  display_name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists rooms (
  room_id uuid primary key,
  invite_code text not null unique,
  owner_player_id text not null references players(player_id),
  created_at timestamptz not null default now()
);

create table if not exists room_members (
  room_id uuid not null references rooms(room_id) on delete cascade,
  player_id text not null references players(player_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

create table if not exists worlds (
  world_id text primary key,
  coordinate_x integer not null,
  coordinate_y integer not null,
  seed bigint not null,
  generation_schema_version integer not null,
  generation_fingerprint integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists world_shards (
  room_id uuid not null references rooms(room_id) on delete cascade,
  world_id text not null references worlds(world_id) on delete cascade,
  seq bigint not null default 0,
  world_time_ms bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, world_id)
);

create table if not exists world_commands (
  room_id uuid not null,
  world_id text not null,
  command_id text not null,
  actor_player_id text not null references players(player_id),
  command_type text not null,
  payload jsonb not null,
  first_seq bigint,
  event_count integer not null default 0 check (event_count >= 0),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, world_id, command_id),
  foreign key (room_id, world_id) references world_shards(room_id, world_id) on delete cascade
);

create table if not exists world_events (
  room_id uuid not null,
  world_id text not null references worlds(world_id) on delete cascade,
  seq bigint not null,
  event_id text not null,
  command_id text,
  actor_player_id text not null references players(player_id),
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (room_id, world_id, seq),
  unique (room_id, world_id, event_id),
  foreign key (room_id, world_id) references world_shards(room_id, world_id) on delete cascade
);

create index if not exists world_events_actor_idx on world_events(actor_player_id);
create index if not exists world_events_command_idx on world_events(room_id, world_id, command_id);
create index if not exists world_events_replay_idx on world_events(room_id, world_id, seq);

create table if not exists world_voxel_edits (
  room_id uuid not null,
  world_id text not null references worlds(world_id) on delete cascade,
  x integer not null,
  y integer not null,
  z integer not null,
  removed boolean not null default true,
  generation_schema_version integer not null,
  generation_fingerprint integer not null,
  event_seq bigint,
  updated_at timestamptz not null default now(),
  primary key (room_id, world_id, x, y, z),
  foreign key (room_id, world_id) references world_shards(room_id, world_id) on delete cascade
);

create table if not exists world_structures (
  room_id uuid not null,
  world_id text not null references worlds(world_id) on delete cascade,
  structure_id text not null,
  owner_player_id text references players(player_id),
  placed_by_player_id text references players(player_id),
  cell integer[] not null,
  face integer not null,
  type text not null,
  material text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (room_id, world_id, structure_id),
  foreign key (room_id, world_id) references world_shards(room_id, world_id) on delete cascade
);

create table if not exists world_collectibles (
  room_id uuid not null,
  world_id text not null references worlds(world_id) on delete cascade,
  collectible_type text not null,
  coord integer[] not null,
  taken_by_player_id text references players(player_id),
  event_seq bigint,
  taken_at timestamptz not null default now(),
  primary key (room_id, world_id, collectible_type, coord),
  foreign key (room_id, world_id) references world_shards(room_id, world_id) on delete cascade
);

create table if not exists world_campfires (
  room_id uuid not null,
  world_id text not null references worlds(world_id) on delete cascade,
  campfire_id text not null,
  owner_player_id text references players(player_id),
  placed_by_player_id text references players(player_id),
  position double precision[] not null,
  up double precision[] not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (room_id, world_id, campfire_id),
  foreign key (room_id, world_id) references world_shards(room_id, world_id) on delete cascade
);

create table if not exists player_state (
  player_id text primary key references players(player_id) on delete cascade,
  vitals jsonb not null default '{}'::jsonb,
  maw jsonb not null default '{}'::jsonb,
  waterskin jsonb not null default '{}'::jsonb,
  jetpack jsonb not null default '{}'::jsonb,
  progression jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists player_inventory (
  player_id text not null references players(player_id) on delete cascade,
  item_id text not null,
  qty integer not null check (qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id, item_id)
);

create table if not exists player_world_pose (
  player_id text not null references players(player_id) on delete cascade,
  world_id text not null references worlds(world_id) on delete cascade,
  seq bigint not null default 0,
  pose jsonb not null,
  flight jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_id, world_id)
);
