/**
 * BreakerBot Repository - SQL operations mirroring former JSON file operations
 * Migrated from: users.json, daily_bonus.json, mentions_preferences.json,
 * deleted_users.json, auth_codes.json, pending_messages.json, sessions.json,
 * amigo_secreto (participantes.json), praised.json
 */

const { query, getClient } = require('./db');

// =============================================================================
// USERS (levels_info/users.json) + AURA + DAILY_MISSIONS
// =============================================================================

function rowToUser(row, auraRow, dmRow, badges = [], levelHistory = []) {
    if (!row) return null;
    const user = {
        xp: row.xp ?? 0,
        level: row.level ?? 1,
        prestige: row.prestige ?? 0,
        prestigeAvailable: row.prestige_available ?? 0,
        totalMessages: row.total_messages ?? 0,
        lastMessageTime: row.last_message_time ? new Date(row.last_message_time).toISOString() : null,
        badges: Array.isArray(badges) ? badges : [],
        lastPrestigeLevel: row.last_prestige_level ?? 0,
        levelHistory: Array.isArray(levelHistory) ? levelHistory : [],
        dailyBonusMultiplier: row.daily_bonus_multiplier ?? 0,
        dailyBonusExpiry: row.daily_bonus_expiry ? new Date(row.daily_bonus_expiry).toISOString() : null,
        allowMentions: row.allow_mentions ?? false,
        pushName: row.push_name ?? null,
        customName: row.custom_name ?? null,
        customNameEnabled: row.custom_name_enabled ?? false,
        jid: row.jid ?? row.user_id,
        profilePicture: row.profile_picture ?? null,
        profilePictureUpdatedAt: row.profile_picture_updated_at ? new Date(row.profile_picture_updated_at).toISOString() : null,
        emoji: row.emoji ?? null,
        emojiReaction: row.emoji_reaction ?? false
    };
    if (auraRow) {
        user.aura = {
            auraPoints: auraRow.aura_points ?? 0,
            stickerHash: auraRow.sticker_hash ?? null,
            stickerDataUrl: auraRow.sticker_data_url ?? null,
            character: auraRow.character ?? null,
            dailyMissions: dmRow ? {
                lastResetDate: dmRow.last_reset_date,
                drawnMissions: dmRow.drawn_missions ?? [],
                completedMissionIds: dmRow.completed_mission_ids ?? [],
                progress: {
                    messages: dmRow.progress_messages ?? 0,
                    reactions: dmRow.progress_reactions ?? 0,
                    duelWin: dmRow.progress_duel_win ?? 0,
                    surviveAttack: dmRow.progress_survive_attack ?? 0,
                    media: dmRow.progress_media ?? 0,
                    helpSomeone: dmRow.progress_help_someone ?? 0
                }
            } : {
                lastResetDate: null,
                drawnMissions: [],
                completedMissionIds: [],
                progress: { messages: 0, reactions: 0, duelWin: 0, surviveAttack: 0, media: 0, helpSomeone: 0 }
            },
            lastRitualDate: auraRow.last_ritual_date ?? null,
            lastTreinarAt: auraRow.last_treinar_at ?? null,
            lastDominarAt: auraRow.last_dominar_at ?? null,
            negativeFarmPunished: auraRow.negative_farm_punished ?? false
        };
    }
    return user;
}

async function getBadgesByUserIds(userIds) {
    if (userIds.length === 0) return {};
    const r = await query(
        `SELECT user_id, badge FROM user_badges WHERE user_id = ANY($1) ORDER BY created_at`,
        [userIds]
    );
    const byUser = {};
    for (const row of r.rows) {
        if (!byUser[row.user_id]) byUser[row.user_id] = [];
        byUser[row.user_id].push(row.badge);
    }
    return byUser;
}

async function getLevelHistoryByUserIds(userIds) {
    if (userIds.length === 0) return {};
    const r = await query(
        `SELECT user_id, action, old_level, old_xp, old_prestige_available, old_prestige, new_level, new_xp, created_at
         FROM user_level_history WHERE user_id = ANY($1) ORDER BY user_id, created_at`,
        [userIds]
    );
    const byUser = {};
    for (const row of r.rows) {
        if (!byUser[row.user_id]) byUser[row.user_id] = [];
        byUser[row.user_id].push({
            action: row.action,
            timestamp: row.created_at ? new Date(row.created_at).toISOString() : null,
            oldLevel: row.old_level ?? 0,
            oldXP: row.old_xp ?? 0,
            oldPrestigeAvailable: row.old_prestige_available ?? 0,
            oldPrestige: row.old_prestige ?? 0,
            newLevel: row.new_level ?? 0,
            newXP: row.new_xp ?? 0
        });
    }
    for (const uid of userIds) {
        if (byUser[uid]) byUser[uid].reverse();
    }
    return byUser;
}

async function syncUserBadges(userId, badges) {
    await query('DELETE FROM user_badges WHERE user_id = $1', [userId]);
    if (Array.isArray(badges) && badges.length > 0) {
        for (const badge of badges) {
            if (badge && String(badge).trim()) {
                await query(
                    'INSERT INTO user_badges (user_id, badge) VALUES ($1, $2) ON CONFLICT (user_id, badge) DO NOTHING',
                    [userId, String(badge).trim()]
                );
            }
        }
    }
}

async function syncUserLevelHistory(userId, levelHistory) {
    await query('DELETE FROM user_level_history WHERE user_id = $1', [userId]);
    const entries = Array.isArray(levelHistory) ? levelHistory.slice(-10) : [];
    for (const e of entries) {
        await query(
            `INSERT INTO user_level_history (user_id, action, old_level, old_xp, old_prestige_available, old_prestige, new_level, new_xp, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)`,
            [
                userId,
                e.action || 'setlevel',
                e.oldLevel ?? 0,
                e.oldXP ?? 0,
                e.oldPrestigeAvailable ?? 0,
                e.oldPrestige ?? 0,
                e.newLevel ?? 0,
                e.newXP ?? 0,
                e.timestamp || new Date().toISOString()
            ]
        );
    }
}

async function getAllUsers() {
    const usersResult = await query(
        `SELECT * FROM users ORDER BY user_id`
    );
    const userIds = usersResult.rows.map(r => r.user_id);
    if (userIds.length === 0) return {};
    const [auraResult, badgesByUser, levelHistoryByUser] = await Promise.all([
        query(
            `SELECT a.*, dm.last_reset_date, dm.drawn_missions, dm.completed_mission_ids,
                    dm.progress_messages, dm.progress_reactions, dm.progress_duel_win,
                    dm.progress_survive_attack, dm.progress_media, dm.progress_help_someone
             FROM aura a
             LEFT JOIN daily_missions dm ON dm.aura_id = a.id
             WHERE a.user_id = ANY($1)`,
            [userIds]
        ),
        getBadgesByUserIds(userIds),
        getLevelHistoryByUserIds(userIds)
    ]);
    const auraByUser = {};
    for (const r of auraResult.rows) {
        auraByUser[r.user_id] = { aura: r, dm: r };
    }
    const result = {};
    for (const row of usersResult.rows) {
        const ar = auraByUser[row.user_id];
        const badges = badgesByUser[row.user_id] || [];
        const levelHistory = levelHistoryByUser[row.user_id] || [];
        result[row.user_id] = rowToUser(row, ar?.aura, ar?.dm, badges, levelHistory);
    }
    return result;
}

/**
 * Ranking de nível: prestige DESC, level DESC, xp DESC. Exclui grupos (g.us).
 */
async function getLevelRanking(limit = 10) {
    const r = await query(
        `SELECT u.user_id AS "userId", u.xp, u.level, u.prestige, u.jid
         FROM users u
         WHERE u.user_id NOT LIKE '%@g.us'
         ORDER BY u.prestige DESC, u.level DESC, u.xp DESC
         LIMIT $1`,
        [limit]
    );
    return r.rows.map(row => ({
        userId: row.userId,
        xp: row.xp ?? 0,
        level: row.level ?? 1,
        prestige: row.prestige ?? 0,
        jid: row.jid ?? row.userId
    }));
}

/**
 * Ranking de aura: aura_points DESC. Exclui grupos (g.us).
 */
async function getAuraRanking(limit = 10) {
    const r = await query(
        `SELECT u.user_id AS "userId", COALESCE(a.aura_points, 0) AS "auraPoints", u.jid
         FROM users u
         LEFT JOIN aura a ON a.user_id = u.user_id
         WHERE u.user_id NOT LIKE '%@g.us'
         ORDER BY COALESCE(a.aura_points, 0) DESC
         LIMIT $1`,
        [limit]
    );
    return r.rows.map(row => ({
        userId: row.userId,
        auraPoints: Number(row.auraPoints) ?? 0,
        jid: row.jid ?? row.userId
    }));
}

async function getUserById(userId) {
    const userResult = await query('SELECT * FROM users WHERE user_id = $1', [userId]);
    const row = userResult.rows[0];
    if (!row) return null;
    const [auraResult, badges, levelHistory] = await Promise.all([
        query(
            `SELECT a.*, dm.last_reset_date, dm.drawn_missions, dm.completed_mission_ids,
                    dm.progress_messages, dm.progress_reactions, dm.progress_duel_win,
                    dm.progress_survive_attack, dm.progress_media, dm.progress_help_someone
             FROM aura a
             LEFT JOIN daily_missions dm ON dm.aura_id = a.id
             WHERE a.user_id = $1`,
            [userId]
        ),
        getBadgesByUserIds([userId]).then(m => m[userId] || []),
        getLevelHistoryByUserIds([userId]).then(m => m[userId] || [])
    ]);
    const ar = auraResult.rows[0];
    return rowToUser(row, ar, ar, badges, levelHistory);
}

function camelToDb(obj) {
    const map = {
        pushName: 'push_name', customName: 'custom_name', customNameEnabled: 'custom_name_enabled',
        profilePicture: 'profile_picture', profilePictureUpdatedAt: 'profile_picture_updated_at',
        lastMessageTime: 'last_message_time', totalMessages: 'total_messages', prestigeAvailable: 'prestige_available',
        lastPrestigeLevel: 'last_prestige_level', levelHistory: 'level_history',
        dailyBonusMultiplier: 'daily_bonus_multiplier', dailyBonusExpiry: 'daily_bonus_expiry',
        allowMentions: 'allow_mentions', emoji: 'emoji', emojiReaction: 'emoji_reaction'
    };
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        const dbKey = map[k] ?? k.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
        out[dbKey] = v;
    }
    return out;
}

async function createUser(userId, userData) {
    const d = camelToDb(userData);
    await query(
        `INSERT INTO users (user_id, xp, level, prestige, prestige_available, total_messages, last_message_time,
         last_prestige_level, daily_bonus_multiplier, daily_bonus_expiry,
         allow_mentions, push_name, custom_name, custom_name_enabled, jid, profile_picture, profile_picture_updated_at,
         emoji, emoji_reaction)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10::timestamptz,
         $11, $12, $13, $14, $15, $16, $17::timestamptz, $18, $19)`,
        [userId, d.xp ?? 0, d.level ?? 1, d.prestige ?? 0, d.prestige_available ?? 0,
            d.total_messages ?? 0, d.last_message_time ?? new Date().toISOString(),
            d.last_prestige_level ?? 0,
            d.daily_bonus_multiplier ?? 0, d.daily_bonus_expiry ?? null, d.allow_mentions ?? false,
            d.push_name ?? userData.pushName ?? null, d.custom_name ?? userData.customName ?? null,
            d.custom_name_enabled ?? userData.customNameEnabled ?? false, d.jid ?? userData.jid ?? userId,
            d.profile_picture ?? userData.profilePicture ?? null, d.profile_picture_updated_at ?? userData.profilePictureUpdatedAt ?? null,
            d.emoji ?? userData.emoji ?? null, d.emoji_reaction ?? userData.emojiReaction ?? false]
    );
    const auraIns = await query(
        `INSERT INTO aura (user_id) VALUES ($1) RETURNING id`,
        [userId]
    );
    const auraId = auraIns.rows[0].id;
    const today = new Date().toISOString().slice(0, 10);
    await query(
        `INSERT INTO daily_missions (aura_id, last_reset_date) VALUES ($1, $2)`,
        [auraId, today]
    );
    await syncUserBadges(userId, userData.badges ?? []);
    await syncUserLevelHistory(userId, userData.levelHistory ?? []);
    return getUserById(userId);
}

async function updateUser(userId, userData) {
    const d = camelToDb(userData);
    const keys = ['xp', 'level', 'prestige', 'prestige_available', 'total_messages', 'last_message_time',
        'last_prestige_level', 'daily_bonus_multiplier', 'daily_bonus_expiry',
        'allow_mentions', 'push_name', 'custom_name', 'custom_name_enabled', 'jid', 'profile_picture', 'profile_picture_updated_at',
        'emoji', 'emoji_reaction'];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const k of keys) {
        if (d[k] !== undefined) {
            sets.push(`${k} = $${i}`);
            vals.push(d[k]);
            i++;
        }
    }
    if (sets.length > 0) {
        vals.push(userId);
        await query(
            `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE user_id = $${i}`,
            vals
        );
    }
    if (userData.badges !== undefined) await syncUserBadges(userId, userData.badges);
    if (userData.levelHistory !== undefined) await syncUserLevelHistory(userId, userData.levelHistory);
    return getUserById(userId);
}

async function patchUser(userId, updates) {
    const existing = await getUserById(userId);
    if (!existing) return null;
    const d = camelToDb(updates);
    if (Object.keys(d).length === 0) return existing;
    return updateUser(userId, d);
}

async function deleteUser(userId) {
    const user = await getUserById(userId);
    if (!user) return null;
    await query('DELETE FROM users WHERE user_id = $1', [userId]);
    return user;
}

async function restoreUser(userId, userData) {
    const d = camelToDb(userData);
    await query(
        `INSERT INTO users (user_id, xp, level, prestige, prestige_available, total_messages, last_message_time,
         last_prestige_level, daily_bonus_multiplier, daily_bonus_expiry,
         allow_mentions, push_name, custom_name, custom_name_enabled, jid, profile_picture, profile_picture_updated_at,
         emoji, emoji_reaction)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10::timestamptz,
         $11, $12, $13, $14, $15, $16, $17::timestamptz, $18, $19)`,
        [userId, d.xp ?? 0, d.level ?? 1, d.prestige ?? 0, d.prestige_available ?? 0,
            d.total_messages ?? 0, d.last_message_time ?? new Date().toISOString(),
            d.last_prestige_level ?? 0,
            d.daily_bonus_multiplier ?? 0, d.daily_bonus_expiry ?? null, d.allow_mentions ?? false,
            d.push_name ?? userData.pushName ?? null, d.custom_name ?? userData.customName ?? null,
            d.custom_name_enabled ?? userData.customNameEnabled ?? false, d.jid ?? userData.jid ?? userId,
            d.profile_picture ?? userData.profilePicture ?? null, d.profile_picture_updated_at ?? userData.profilePictureUpdatedAt ?? null,
            d.emoji ?? userData.emoji ?? null, d.emoji_reaction ?? userData.emojiReaction ?? false]
    );
    await syncUserBadges(userId, userData.badges ?? []);
    await syncUserLevelHistory(userId, userData.levelHistory ?? []);
    const aura = userData.aura || {};
    const auraIns = await query(
        `INSERT INTO aura (user_id, aura_points, sticker_hash, sticker_data_url, character, last_ritual_date,
         last_treinar_at, last_dominar_at, negative_farm_punished)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9) RETURNING id`,
        [userId, aura.auraPoints ?? 0, aura.stickerHash ?? null, aura.stickerDataUrl ?? null, aura.character ?? null,
            aura.lastRitualDate ?? null, aura.lastTreinarAt ?? null, aura.lastDominarAt ?? null, aura.negativeFarmPunished ?? false]
    );
    const auraId = auraIns.rows[0].id;
    const dm = aura.dailyMissions || {};
    const today = dm.lastResetDate || new Date().toISOString().slice(0, 10);
    const drawn = Array.isArray(dm.drawnMissions) ? dm.drawnMissions : [];
    const completed = Array.isArray(dm.completedMissionIds) ? dm.completedMissionIds : [];
    const prog = dm.progress || {};
    await query(
        `INSERT INTO daily_missions (aura_id, last_reset_date, drawn_missions, completed_mission_ids,
         progress_messages, progress_reactions, progress_duel_win, progress_survive_attack, progress_media, progress_help_someone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [auraId, today, drawn, completed,
            prog.messages ?? 0, prog.reactions ?? 0, prog.duelWin ?? 0,
            prog.surviveAttack ?? 0, prog.media ?? 0, prog.helpSomeone ?? 0]
    );
    return getUserById(userId);
}

async function findUserByJid(jid) {
    const r = await query('SELECT user_id FROM users WHERE user_id = $1 OR jid = $1', [jid]);
    return r.rows[0]?.user_id ?? null;
}

/** Incremento atômico de aura_points (evita conflito com cache do level) */
async function incrementAuraPoints(jidOrUserId, amount) {
    const userId = await findUserByJid(jidOrUserId) || jidOrUserId;
    const amt = Number(amount) || 0;
    const r = await query(
        `UPDATE aura SET aura_points = GREATEST(0, COALESCE(aura_points, 0) + $2::int)
         WHERE user_id = $1 RETURNING aura_points`,
        [userId, amt]
    );
    return r.rows[0]?.aura_points ?? null;
}

async function updateAura(userId, auraData) {
    const aura = auraData || {};
    const dm = aura.dailyMissions || {};
    const drawn = Array.isArray(dm.drawnMissions) ? dm.drawnMissions : [];
    const completed = Array.isArray(dm.completedMissionIds) ? dm.completedMissionIds : [];
    const prog = dm.progress || {};
    await query(
        `UPDATE aura SET aura_points = COALESCE($2, aura_points), sticker_hash = COALESCE($3, sticker_hash),
         sticker_data_url = COALESCE($4, sticker_data_url), character = COALESCE($5, character),
         last_ritual_date = COALESCE($6::date, last_ritual_date), last_treinar_at = COALESCE($7, last_treinar_at),
         last_dominar_at = COALESCE($8, last_dominar_at), negative_farm_punished = COALESCE($9, negative_farm_punished),
         updated_at = NOW() WHERE user_id = $1`,
        [userId, aura.auraPoints ?? null, aura.stickerHash ?? null, aura.stickerDataUrl ?? null, aura.character ?? null,
            aura.lastRitualDate ?? null, aura.lastTreinarAt ?? null, aura.lastDominarAt ?? null, aura.negativeFarmPunished ?? null]
    );
    const auraRow = await query('SELECT id FROM aura WHERE user_id = $1', [userId]);
    if (auraRow.rows[0]) {
        const auraId = auraRow.rows[0].id;
        const today = dm.lastResetDate || new Date().toISOString().slice(0, 10);
        await query(
            `INSERT INTO daily_missions (aura_id, last_reset_date, drawn_missions, completed_mission_ids,
             progress_messages, progress_reactions, progress_duel_win, progress_survive_attack, progress_media, progress_help_someone)
             VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (aura_id) DO UPDATE SET
             last_reset_date = EXCLUDED.last_reset_date,
             drawn_missions = EXCLUDED.drawn_missions,
             completed_mission_ids = EXCLUDED.completed_mission_ids,
             progress_messages = EXCLUDED.progress_messages,
             progress_reactions = EXCLUDED.progress_reactions,
             progress_duel_win = EXCLUDED.progress_duel_win,
             progress_survive_attack = EXCLUDED.progress_survive_attack,
             progress_media = EXCLUDED.progress_media,
             progress_help_someone = EXCLUDED.progress_help_someone,
             updated_at = NOW()`,
            [auraId, today, drawn, completed,
                prog.messages ?? 0, prog.reactions ?? 0, prog.duelWin ?? 0,
                prog.surviveAttack ?? 0, prog.media ?? 0, prog.helpSomeone ?? 0]
        );
    }
}

async function saveAllUsers(usersData) {
    for (const [userId, userData] of Object.entries(usersData)) {
        if (typeof userId !== 'string' || !userId.includes('@')) continue;
        const existing = await getUserById(userId);
        if (existing) {
            await updateUser(userId, userData);
            if (userData && userData.aura) {
                await updateAura(userId, userData.aura);
            }
        } else {
            await createUser(userId, userData);
        }
    }
}

// =============================================================================
// DAILY BONUS (levels_info/daily_bonus.json)
// =============================================================================

async function getDailyBonus() {
    const r = await query(
        `SELECT last_bonus_date, last_bonus_user_id FROM daily_bonus ORDER BY updated_at DESC LIMIT 1`
    );
    const row = r.rows[0];
    if (!row) return { lastBonusDate: null, lastBonusUser: null };
    return {
        lastBonusDate: row.last_bonus_date,
        lastBonusUser: row.last_bonus_user_id
    };
}

async function setDailyBonus(lastBonusDate, lastBonusUser) {
    await query(
        `INSERT INTO daily_bonus (last_bonus_date, last_bonus_user_id) VALUES ($1, $2)`,
        [lastBonusDate, lastBonusUser]
    );
}

// =============================================================================
// MENTIONS PREFERENCES (mentions_preferences.json)
// =============================================================================

async function getMentionsPreferences() {
    const r = await query(
        `SELECT global_enabled FROM mentions_preferences ORDER BY id DESC LIMIT 1`
    );
    const row = r.rows[0];
    return { globalEnabled: row ? row.global_enabled : true };
}

async function updateMentionsPreferences(data) {
    const enabled = data.globalEnabled !== false;
    const r = await query(
        `UPDATE mentions_preferences SET global_enabled = $1, updated_at = NOW() WHERE id = (SELECT id FROM mentions_preferences ORDER BY id DESC LIMIT 1) RETURNING id`,
        [enabled]
    );
    if (r.rowCount === 0) {
        await query(`INSERT INTO mentions_preferences (global_enabled) VALUES ($1)`, [enabled]);
    }
    return getMentionsPreferences();
}

// =============================================================================
// DELETED USERS / BACKUP (deleted_users.json)
// =============================================================================

async function getDeletedUsers() {
    const r = await query(
        `SELECT user_id, deleted_at, metadata FROM deleted_users ORDER BY deleted_at DESC`
    );
    return r.rows.map(row => ({
        id: row.user_id,
        data: row.metadata?.data ?? row.metadata,
        deletedAt: new Date(row.deleted_at).toISOString(),
        expiresAt: row.metadata?.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }));
}

async function addDeletedUser(userId, userData) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const deletedAt = new Date().toISOString();
    await query(
        `INSERT INTO deleted_users (user_id, metadata) VALUES ($1, $2::jsonb)`,
        [userId, JSON.stringify({ data: userData, expiresAt })]
    );
    return { id: userId, data: userData, deletedAt, expiresAt };
}

async function removeDeletedUser(userId) {
    await query('DELETE FROM deleted_users WHERE user_id = $1', [userId]);
}

async function cleanOldDeletedUsers(daysToKeep = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const r = await query(
        `DELETE FROM deleted_users WHERE deleted_at < $1 RETURNING id`,
        [cutoff]
    );
    return r.rowCount;
}

// =============================================================================
// AUTH CODES (auth_codes.json)
// =============================================================================

async function getAuthCode(userId) {
    const r = await query(
        `SELECT code, expires_at, attempts, created_at FROM auth_codes WHERE user_id = $1`,
        [userId]
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
        code: row.code,
        expiresAt: new Date(row.expires_at).toISOString(),
        attempts: row.attempts,
        createdAt: new Date(row.created_at).toISOString()
    };
}

async function setAuthCode(userId, data) {
    await query(
        `INSERT INTO auth_codes (user_id, code, expires_at, attempts)
         VALUES ($1, $2, $3::timestamptz, $4)
         ON CONFLICT (user_id) DO UPDATE SET code = $2, expires_at = $3::timestamptz, attempts = $4, created_at = NOW()`,
        [userId, data.code, data.expiresAt, data.attempts ?? 0]
    );
}

async function deleteAuthCode(userId) {
    await query('DELETE FROM auth_codes WHERE user_id = $1', [userId]);
}

async function incrementAuthCodeAttempts(userId) {
    await query(
        `UPDATE auth_codes SET attempts = attempts + 1 WHERE user_id = $1`,
        [userId]
    );
    return getAuthCode(userId);
}

async function cleanExpiredAuthCodes() {
    const r = await query(`DELETE FROM auth_codes WHERE expires_at < NOW() RETURNING user_id`);
    return r.rowCount;
}

// =============================================================================
// PENDING MESSAGES (pending_messages.json)
// =============================================================================

async function getPendingMessages() {
    const r = await query(
        `SELECT id, "to", message, retries, last_error, last_attempt, created_at FROM pending_messages ORDER BY id ASC`
    );
    return r.rows.map(row => ({
        id: row.id,
        to: row.to,
        message: row.message,
        retries: row.retries ?? 0,
        lastError: row.last_error ?? null,
        lastAttempt: row.last_attempt ? new Date(row.last_attempt).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString()
    }));
}

async function addPendingMessage(to, message) {
    const r = await query(
        `INSERT INTO pending_messages ("to", message) VALUES ($1, $2) RETURNING id`,
        [to, message]
    );
    return r.rows[0].id;
}

async function setPendingMessages(messages) {
    const client = await getClient();
    try {
        await client.query('DELETE FROM pending_messages');
        for (const m of messages) {
            await client.query(
                `INSERT INTO pending_messages ("to", message, retries, last_error, last_attempt)
                 VALUES ($1, $2, $3, $4, $5::timestamptz)`,
                [m.to, m.message, m.retries ?? 0, m.lastError ?? null, m.lastAttempt ?? null]
            );
        }
    } finally {
        client.release();
    }
}

// =============================================================================
// AUTH SESSIONS (sessions.json)
// =============================================================================

async function getSession(token) {
    const r = await query(
        `SELECT user_id, created_at, expires_at FROM auth_sessions WHERE token = $1`,
        [token]
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
        userId: row.user_id,
        createdAt: new Date(row.created_at).toISOString(),
        expiresAt: new Date(row.expires_at).toISOString()
    };
}

async function setSession(token, data) {
    await query(
        `INSERT INTO auth_sessions (token, user_id, expires_at)
         VALUES ($1, $2, $3::timestamptz)
         ON CONFLICT (token) DO UPDATE SET user_id = $2, expires_at = $3::timestamptz`,
        [token, data.userId, data.expiresAt]
    );
}

async function deleteSession(token) {
    await query('DELETE FROM auth_sessions WHERE token = $1', [token]);
}

// =============================================================================
// AMIGO SECRETO (participantes.json)
// =============================================================================

async function getAmigoSecretoAll() {
    const groupsResult = await query(
        `SELECT group_id, group_name, sorteio_data FROM amigo_secreto_groups ORDER BY group_id`
    );
    const result = {};
    for (const g of groupsResult.rows) {
        result[g.group_id] = {
            groupName: g.group_name,
            participantes: [],
            presentes: {},
            nomes: {},
            sorteio: null,
            sorteioData: g.sorteio_data ? new Date(g.sorteio_data).toISOString() : null
        };
    }
    if (groupsResult.rows.length === 0) return result;
    const groupIds = groupsResult.rows.map(r => r.group_id);
    const partResult = await query(
        `SELECT group_id, user_id, nome FROM amigo_secreto_participantes WHERE group_id = ANY($1)`,
        [groupIds]
    );
    for (const p of partResult.rows) {
        if (result[p.group_id]) {
            result[p.group_id].participantes.push(p.user_id);
            if (p.nome) result[p.group_id].nomes[p.user_id] = p.nome;
        }
    }
    const presResult = await query(
        `SELECT group_id, user_id, presente FROM amigo_secreto_presentes WHERE group_id = ANY($1)`,
        [groupIds]
    );
    for (const p of presResult.rows) {
        if (result[p.group_id]) result[p.group_id].presentes[p.user_id] = p.presente;
    }
    const sortResult = await query(
        `SELECT group_id, giver_user_id, receiver_user_id FROM amigo_secreto_sorteio WHERE group_id = ANY($1)`,
        [groupIds]
    );
    for (const s of sortResult.rows) {
        if (result[s.group_id]) {
            if (!result[s.group_id].sorteio) result[s.group_id].sorteio = {};
            result[s.group_id].sorteio[s.giver_user_id] = s.receiver_user_id;
        }
    }
    return result;
}

async function updateAmigoSecretoPresente(groupId, userId, presente) {
    if (presente === '' || presente === null || presente === undefined) {
        await query(
            `DELETE FROM amigo_secreto_presentes WHERE group_id = $1 AND user_id = $2`,
            [groupId, userId]
        );
    } else {
        await query(
            `INSERT INTO amigo_secreto_presentes (group_id, user_id, presente)
             VALUES ($1, $2, $3)
             ON CONFLICT (group_id, user_id) DO UPDATE SET presente = $3`,
            [groupId, userId, presente]
        );
    }
}

async function saveAmigoSecretoGroup(groupId, data) {
    const client = await getClient();
    try {
        await client.query(
            `INSERT INTO amigo_secreto_groups (group_id, group_name, sorteio_data)
             VALUES ($1, $2, $3::timestamptz)
             ON CONFLICT (group_id) DO UPDATE SET group_name = $2, sorteio_data = $3::timestamptz, updated_at = NOW()`,
            [groupId, data.groupName || 'Grupo', data.sorteioData || null]
        );
        await client.query('DELETE FROM amigo_secreto_participantes WHERE group_id = $1', [groupId]);
        for (const uid of data.participantes || []) {
            const nome = (data.nomes || {})[uid] || null;
            await client.query(
                `INSERT INTO amigo_secreto_participantes (group_id, user_id, nome) VALUES ($1, $2, $3)`,
                [groupId, uid, nome]
            );
        }
        await client.query('DELETE FROM amigo_secreto_presentes WHERE group_id = $1', [groupId]);
        for (const [uid, presente] of Object.entries(data.presentes || {})) {
            if (presente) {
                await client.query(
                    `INSERT INTO amigo_secreto_presentes (group_id, user_id, presente) VALUES ($1, $2, $3)`,
                    [groupId, uid, presente]
                );
            }
        }
        await client.query('DELETE FROM amigo_secreto_sorteio WHERE group_id = $1', [groupId]);
        for (const [giver, receiver] of Object.entries(data.sorteio || {})) {
            await client.query(
                `INSERT INTO amigo_secreto_sorteio (group_id, giver_user_id, receiver_user_id) VALUES ($1, $2, $3)`,
                [groupId, giver, receiver]
            );
        }
    } finally {
        client.release();
    }
}

// =============================================================================
// FEATURES (data/features.json)
// =============================================================================

async function getFeatures() {
    const r = await query(
        `SELECT id, description, status, created_at, created_by FROM features ORDER BY id ASC`
    );
    return r.rows.map(row => ({
        id: row.id,
        description: row.description,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        createdBy: row.created_by
    }));
}

async function addFeature(description, createdBy) {
    const r = await query(
        `INSERT INTO features (description, status, created_by) VALUES ($1, 'pending', $2) RETURNING id, description, status, created_at, created_by`,
        [description, createdBy]
    );
    const row = r.rows[0];
    return {
        id: row.id,
        description: row.description,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        createdBy: row.created_by
    };
}

async function updateFeatureStatus(id, status) {
    await query(
        `UPDATE features SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, id]
    );
}

async function removeFeature(id) {
    await query('DELETE FROM features WHERE id = $1', [id]);
}

// =============================================================================
// PRAISED (praised.json)
// =============================================================================

async function getAllPraised() {
    const r = await query(
        `SELECT praised_user_id, praised_by_user_id FROM praised`
    );
    const result = {};
    for (const row of r.rows) {
        if (!result[row.praised_user_id]) result[row.praised_user_id] = [];
        result[row.praised_user_id].push(row.praised_by_user_id);
    }
    return result;
}

async function getWhoPraised(userId) {
    const r = await query(
        `SELECT praised_by_user_id FROM praised WHERE praised_user_id = $1`,
        [userId]
    );
    return r.rows.map(row => row.praised_by_user_id);
}

async function addPraise(fromUserId, toUserId) {
    await query(
        `INSERT INTO praised (praised_user_id, praised_by_user_id) VALUES ($1, $2)
         ON CONFLICT (praised_user_id, praised_by_user_id) DO NOTHING`,
        [toUserId, fromUserId]
    );
}

// =============================================================================
// AURA GLOBAL (users.__auraGlobal - pendingMogByChat)
// =============================================================================

async function getAuraGlobal() {
    const r = await query(
        `SELECT user_id FROM users WHERE user_id = '__auraGlobal' LIMIT 1`
    );
    if (r.rows.length === 0) return { pendingMogByChat: {} };
    const meta = r.rows[0];
    const auraR = await query(
        `SELECT * FROM aura WHERE user_id = '__auraGlobal' LIMIT 1`
    );
    return { pendingMogByChat: {} };
}

module.exports = {
    getAllUsers,
    getUserById,
    getLevelRanking,
    getAuraRanking,
    createUser,
    updateUser,
    patchUser,
    deleteUser,
    restoreUser,
    findUserByJid,
    incrementAuraPoints,
    saveAllUsers,
    updateAura,
    getDailyBonus,
    setDailyBonus,
    getMentionsPreferences,
    updateMentionsPreferences,
    getDeletedUsers,
    addDeletedUser,
    removeDeletedUser,
    cleanOldDeletedUsers,
    getAuthCode,
    setAuthCode,
    deleteAuthCode,
    incrementAuthCodeAttempts,
    cleanExpiredAuthCodes,
    getPendingMessages,
    addPendingMessage,
    setPendingMessages,
    getSession,
    setSession,
    deleteSession,
    getAmigoSecretoAll,
    updateAmigoSecretoPresente,
    saveAmigoSecretoGroup,
    getFeatures,
    addFeature,
    updateFeatureStatus,
    removeFeature,
    getAllPraised,
    getWhoPraised,
    addPraise,
    getAuraGlobal,
    rowToUser
};
