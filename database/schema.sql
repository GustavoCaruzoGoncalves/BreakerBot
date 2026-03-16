-- =============================================================================
-- BreakerBot - PostgreSQL Schema
-- Migration from data/*.json and levels_info/*.json to relational database
-- Compatible with PostgreSQL 16+
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. AUTHENTICATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS auth_sessions (
    token VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_codes (
    user_id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_expires_at ON auth_codes(expires_at);

CREATE TABLE IF NOT EXISTS pending_messages (
    id SERIAL PRIMARY KEY,
    "to" VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    retries INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_attempt TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_messages_created_at ON pending_messages(created_at);

-- =============================================================================
-- 2. FEATURES AND PREFERENCES
-- =============================================================================

CREATE TABLE IF NOT EXISTS features (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_features_status ON features(status);

CREATE TABLE IF NOT EXISTS mentions_preferences (
    id SERIAL PRIMARY KEY,
    global_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO mentions_preferences (global_enabled)
SELECT true WHERE NOT EXISTS (SELECT 1 FROM mentions_preferences LIMIT 1);

-- =============================================================================
-- 3. PRAISED
-- =============================================================================

CREATE TABLE IF NOT EXISTS praised (
    id SERIAL PRIMARY KEY,
    praised_user_id VARCHAR(100) NOT NULL,
    praised_by_user_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(praised_user_id, praised_by_user_id)
);

CREATE INDEX IF NOT EXISTS idx_praised_praised_user ON praised(praised_user_id);
CREATE INDEX IF NOT EXISTS idx_praised_praised_by ON praised(praised_by_user_id);

-- =============================================================================
-- 4. DELETED USERS BACKUP
-- =============================================================================

CREATE TABLE IF NOT EXISTS deleted_users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_deleted_users_user_id ON deleted_users(user_id);

-- =============================================================================
-- 5. USERS AND LEVELS
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(100) PRIMARY KEY,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    prestige INTEGER NOT NULL DEFAULT 0,
    prestige_available INTEGER NOT NULL DEFAULT 0,
    total_messages INTEGER NOT NULL DEFAULT 0,
    last_message_time TIMESTAMPTZ,
    last_prestige_level INTEGER NOT NULL DEFAULT 0,
    daily_bonus_multiplier INTEGER NOT NULL DEFAULT 0,
    daily_bonus_expiry TIMESTAMPTZ,
    allow_mentions BOOLEAN NOT NULL DEFAULT false,
    push_name VARCHAR(255),
    custom_name VARCHAR(255),
    custom_name_enabled BOOLEAN NOT NULL DEFAULT false,
    jid VARCHAR(100),
    profile_picture TEXT,
    profile_picture_updated_at TIMESTAMPTZ,
    emoji VARCHAR(50),
    emoji_reaction BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    badge VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, badge)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);

CREATE TABLE IF NOT EXISTS user_level_history (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    old_level INTEGER NOT NULL DEFAULT 0,
    old_xp INTEGER NOT NULL DEFAULT 0,
    old_prestige_available INTEGER NOT NULL DEFAULT 0,
    old_prestige INTEGER NOT NULL DEFAULT 0,
    new_level INTEGER NOT NULL DEFAULT 0,
    new_xp INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_level_history_user_id ON user_level_history(user_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS emoji VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emoji_reaction BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp);
CREATE INDEX IF NOT EXISTS idx_users_last_message ON users(last_message_time);

-- =============================================================================
-- 5b. AURA
-- =============================================================================

CREATE TABLE IF NOT EXISTS aura (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
    aura_points BIGINT NOT NULL DEFAULT 0,
    sticker_hash VARCHAR(255),
    sticker_data_url TEXT,
    character VARCHAR(255),
    last_ritual_date DATE,
    last_treinar_at BIGINT,
    last_dominar_at BIGINT,
    negative_farm_punished BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aura_user_id ON aura(user_id);
CREATE INDEX IF NOT EXISTS idx_aura_points ON aura(aura_points);

-- =============================================================================
-- AUTO-MIGRATION: corrige bancos antigos onde aura_points ainda é INTEGER
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'aura'
          AND column_name = 'aura_points'
          AND data_type <> 'bigint'
    ) THEN
        ALTER TABLE aura
        ALTER COLUMN aura_points TYPE BIGINT
        USING aura_points::bigint;
    END IF;
END $$;

-- =============================================================================
-- 5c. DAILY MISSIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS daily_missions (
    id SERIAL PRIMARY KEY,
    aura_id INTEGER NOT NULL REFERENCES aura(id) ON DELETE CASCADE UNIQUE,
    last_reset_date DATE NOT NULL,
    drawn_missions TEXT[] NOT NULL DEFAULT '{}',
    completed_mission_ids TEXT[] NOT NULL DEFAULT '{}',
    progress_messages INTEGER NOT NULL DEFAULT 0,
    progress_reactions INTEGER NOT NULL DEFAULT 0,
    progress_duel_win INTEGER NOT NULL DEFAULT 0,
    progress_survive_attack INTEGER NOT NULL DEFAULT 0,
    progress_media INTEGER NOT NULL DEFAULT 0,
    progress_help_someone INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_missions_aura_id ON daily_missions(aura_id);

-- =============================================================================
-- 6. DAILY BONUS
-- =============================================================================

CREATE TABLE IF NOT EXISTS daily_bonus (
    id SERIAL PRIMARY KEY,
    last_bonus_date DATE NOT NULL,
    last_bonus_user_id VARCHAR(100) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 7. SECRET SANTA
-- =============================================================================

CREATE TABLE IF NOT EXISTS amigo_secreto_groups (
    group_id VARCHAR(100) PRIMARY KEY,
    group_name VARCHAR(255) NOT NULL,
    sorteio_data TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS amigo_secreto_participantes (
    id SERIAL PRIMARY KEY,
    group_id VARCHAR(100) NOT NULL REFERENCES amigo_secreto_groups(group_id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    nome VARCHAR(255),
    UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_amigo_participantes_group ON amigo_secreto_participantes(group_id);

CREATE TABLE IF NOT EXISTS amigo_secreto_presentes (
    id SERIAL PRIMARY KEY,
    group_id VARCHAR(100) NOT NULL REFERENCES amigo_secreto_groups(group_id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    presente TEXT NOT NULL,
    UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS amigo_secreto_sorteio (
    id SERIAL PRIMARY KEY,
    group_id VARCHAR(100) NOT NULL REFERENCES amigo_secreto_groups(group_id) ON DELETE CASCADE,
    giver_user_id VARCHAR(100) NOT NULL,
    receiver_user_id VARCHAR(100) NOT NULL,
    UNIQUE(group_id, giver_user_id)
);

CREATE INDEX IF NOT EXISTS idx_amigo_sorteio_group ON amigo_secreto_sorteio(group_id);

ALTER TABLE amigo_secreto_participantes ADD COLUMN IF NOT EXISTS nome VARCHAR(255);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'amigo_secreto_nomes'
    ) THEN
        UPDATE amigo_secreto_participantes p
        SET nome = n.nome
        FROM amigo_secreto_nomes n
        WHERE p.group_id = n.group_id
          AND p.user_id = n.user_id;

        DROP TABLE amigo_secreto_nomes;
    END IF;
END $$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE auth_sessions IS 'Auth sessions - migrated from data/auth/sessions.json';
COMMENT ON TABLE auth_codes IS 'Verification codes - migrated from data/auth/auth_codes.json';
COMMENT ON TABLE pending_messages IS 'Pending messages to send - migrated from data/auth/pending_messages.json';
COMMENT ON TABLE features IS 'Requested features - migrated from data/features.json';
COMMENT ON TABLE mentions_preferences IS 'Global mentions preferences - migrated from data/mentions/mentions_preferences.json';
COMMENT ON TABLE praised IS 'User praise records - migrated from data/praised.json';
COMMENT ON TABLE deleted_users IS 'Deleted users backup - migrated from data/backups/deleted_users.json';
COMMENT ON TABLE users IS 'Users and level system - migrated from levels_info/users.json';
COMMENT ON TABLE aura IS 'Aura system - extracted from users.aura, linked via user_id';
COMMENT ON TABLE daily_missions IS 'Daily missions progress - extracted from aura.dailyMissions, 1:1 with aura';
COMMENT ON TABLE daily_bonus IS 'Daily bonus control - migrated from levels_info/daily_bonus.json';
COMMENT ON TABLE amigo_secreto_groups IS 'Secret Santa groups - migrated from data/amigoSecreto/participantes.json';
COMMENT ON TABLE user_badges IS 'User badges - extracted from users.badges';
COMMENT ON TABLE user_level_history IS 'User level change history - extracted from users.level_history';

-- =============================================================================
-- 8. SKULLCARDS (UNO-LIKE MULTIPLAYER CARD GAME)
-- =============================================================================

CREATE TABLE IF NOT EXISTS skullcards_rooms (
    room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_user_id VARCHAR(100) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'lobby', -- lobby | in_progress | finished
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill para bancos onde skullcards_rooms já existia sem a coluna is_public
ALTER TABLE skullcards_rooms
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS skullcards_room_players (
    room_id UUID NOT NULL REFERENCES skullcards_rooms(room_id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_skullcards_room_players_room ON skullcards_room_players(room_id);

CREATE TABLE IF NOT EXISTS skullcards_matches (
    match_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES skullcards_rooms(room_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | finished | cancelled
    current_turn_user_id VARCHAR(100) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    direction SMALLINT NOT NULL DEFAULT 1, -- 1 = clockwise, -1 = counter-clockwise
    current_color VARCHAR(10) NOT NULL, -- red | yellow | green | blue | wild
    pending_draw INTEGER NOT NULL DEFAULT 0,
    discard_top VARCHAR(20) NOT NULL, -- e.g. "R-5", "B-SKIP", "W", "W+4"
    winner_user_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_skullcards_matches_room ON skullcards_matches(room_id);
CREATE INDEX IF NOT EXISTS idx_skullcards_matches_status ON skullcards_matches(status);

-- Each row in skullcards_hands represents a single card in a player's hand.
-- Allow duplicate cards for the same player by using a surrogate primary key.
CREATE TABLE IF NOT EXISTS skullcards_hands (
    id SERIAL PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES skullcards_matches(match_id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    card VARCHAR(20) NOT NULL
);

-- Backfill for databases where skullcards_hands already existed with a composite PK
ALTER TABLE skullcards_hands
    DROP CONSTRAINT IF EXISTS skullcards_hands_pkey;

ALTER TABLE skullcards_hands
    ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY;

CREATE INDEX IF NOT EXISTS idx_skullcards_hands_match ON skullcards_hands(match_id);

-- Draw pile and discard pile store card order explicitly (1 = top of pile)
CREATE TABLE IF NOT EXISTS skullcards_draw_pile (
    match_id UUID NOT NULL REFERENCES skullcards_matches(match_id) ON DELETE CASCADE,
    card_order INTEGER NOT NULL,
    card VARCHAR(20) NOT NULL,
    PRIMARY KEY (match_id, card_order)
);

CREATE INDEX IF NOT EXISTS idx_skullcards_draw_pile_match ON skullcards_draw_pile(match_id);

CREATE TABLE IF NOT EXISTS skullcards_discard_pile (
    match_id UUID NOT NULL REFERENCES skullcards_matches(match_id) ON DELETE CASCADE,
    card_order INTEGER NOT NULL,
    card VARCHAR(20) NOT NULL,
    PRIMARY KEY (match_id, card_order)
);

CREATE INDEX IF NOT EXISTS idx_skullcards_discard_pile_match ON skullcards_discard_pile(match_id);

COMMENT ON TABLE skullcards_rooms IS 'SkullCards game rooms (lobby + matches).';
COMMENT ON TABLE skullcards_room_players IS 'Players currently in a SkullCards room.';
COMMENT ON TABLE skullcards_matches IS 'SkullCards matches, UNO-like state.';
COMMENT ON TABLE skullcards_hands IS 'Per-player cards in hand for SkullCards matches.';
COMMENT ON TABLE skullcards_draw_pile IS 'Draw pile for SkullCards matches (top = lowest card_order).';
COMMENT ON TABLE skullcards_discard_pile IS 'Discard pile history for SkullCards matches (top = highest card_order).';
