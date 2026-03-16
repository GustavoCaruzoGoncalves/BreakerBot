const { query, getClient } = require('./db');

// Card helpers ---------------------------------------------------------------

const COLORS = ['R', 'Y', 'G', 'B']; // red, yellow, green, blue

function buildUnoDeck() {
    const deck = [];
    for (const color of COLORS) {
        deck.push(`${color}-0`);
        for (let i = 1; i <= 9; i++) {
            deck.push(`${color}-${i}`);
            deck.push(`${color}-${i}`);
        }
        const specials = ['SKIP', 'REVERSE', '+2'];
        for (const s of specials) {
            deck.push(`${color}-${s}`);
            deck.push(`${color}-${s}`);
        }
    }
    for (let i = 0; i < 4; i++) {
        deck.push('W');
        deck.push('W+4');
    }
    return deck;
}

function shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function getCardColor(card) {
    if (card === 'W' || card === 'W+4') return 'wild';
    const [prefix] = card.split('-');
    switch (prefix) {
        case 'R': return 'red';
        case 'Y': return 'yellow';
        case 'G': return 'green';
        case 'B': return 'blue';
        default: return 'wild';
    }
}

// Room & match persistence ---------------------------------------------------

async function createRoom(hostUserId, isPublic = false) {
    const r = await query(
        `INSERT INTO skullcards_rooms (host_user_id, status, is_public)
         VALUES ($1, 'lobby', $2)
         RETURNING room_id, host_user_id, status, is_public, created_at`,
        [hostUserId, !!isPublic]
    );
    const room = r.rows[0];
    await query(
        `INSERT INTO skullcards_room_players (room_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (room_id, user_id) DO NOTHING`,
        [room.room_id, hostUserId]
    );
    return room;
}

async function getRoom(roomId) {
    const roomResult = await query(
        `SELECT room_id, host_user_id, status, is_public, created_at
         FROM skullcards_rooms WHERE room_id = $1`,
        [roomId]
    );
    const room = roomResult.rows[0];
    if (!room) return null;
    const playersResult = await query(
        `SELECT user_id, joined_at
         FROM skullcards_room_players
         WHERE room_id = $1
         ORDER BY joined_at ASC`,
        [roomId]
    );
    return {
        ...room,
        players: playersResult.rows
    };
}

async function joinRoom(roomId, userId) {
    const roomRes = await query(
        `SELECT room_id, status FROM skullcards_rooms WHERE room_id = $1`,
        [roomId]
    );
    const room = roomRes.rows[0];
    if (!room) {
        throw new Error('room_not_found');
    }
    if (room.status !== 'lobby') {
        throw new Error('room_not_in_lobby');
    }
    await query(
        `INSERT INTO skullcards_room_players (room_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (room_id, user_id) DO NOTHING`,
        [roomId, userId]
    );
    return getRoom(roomId);
}

async function listRoomPlayers(roomId) {
    const r = await query(
        `SELECT user_id
         FROM skullcards_room_players
         WHERE room_id = $1
         ORDER BY joined_at ASC`,
        [roomId]
    );
    return r.rows.map(row => row.user_id);
}

async function createMatchForRoom(roomId) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        const roomRes = await client.query(
            `SELECT room_id, host_user_id, status
             FROM skullcards_rooms WHERE room_id = $1 FOR UPDATE`,
            [roomId]
        );
        const room = roomRes.rows[0];
        if (!room) {
            throw new Error('room_not_found');
        }
        if (room.status !== 'lobby') {
            throw new Error('room_not_in_lobby');
        }

        const playersRes = await client.query(
            `SELECT user_id
             FROM skullcards_room_players
             WHERE room_id = $1
             ORDER BY joined_at ASC`,
            [roomId]
        );
        const players = playersRes.rows.map(r => r.user_id);
        if (players.length < 2) {
            throw new Error('not_enough_players');
        }

        let deck = shuffle(buildUnoDeck());

        const hands = {};
        const handSize = 7;
        for (const uid of players) {
            hands[uid] = [];
        }
        for (let i = 0; i < handSize; i++) {
            for (const uid of players) {
                const card = deck.shift();
                if (card) hands[uid].push(card);
            }
        }

        let firstCard = null;
        while (deck.length > 0 && !firstCard) {
            const c = deck.shift();
            if (!c) break;
            if (c === 'W' || c === 'W+4' || c.endsWith('+2') || c.endsWith('SKIP') || c.endsWith('REVERSE')) {
                continue;
            }
            firstCard = c;
        }
        if (!firstCard) {
            deck = shuffle(buildUnoDeck());
            firstCard = deck.shift();
        }

        const currentColor = getCardColor(firstCard);
        const currentTurnUserId = players[0];

        const matchRes = await client.query(
            `INSERT INTO skullcards_matches
             (room_id, status, current_turn_user_id, direction, current_color, pending_draw, discard_top)
             VALUES ($1, 'active', $2, 1, $3, 0, $4)
             RETURNING match_id, room_id, status, current_turn_user_id, direction, current_color, pending_draw, discard_top`,
            [roomId, currentTurnUserId, currentColor, firstCard]
        );
        const match = matchRes.rows[0];

        const handValues = [];
        for (const [uid, cards] of Object.entries(hands)) {
            for (const card of cards) {
                handValues.push({ uid, card });
            }
        }

        for (const row of handValues) {
            await client.query(
                `INSERT INTO skullcards_hands (match_id, user_id, card)
                 VALUES ($1, $2, $3)`,
                [match.match_id, row.uid, row.card]
            );
        }

        const discardRows = [];
        discardRows.push({ order: 1, card: firstCard });

        for (const row of discardRows) {
            await client.query(
                `INSERT INTO skullcards_discard_pile (match_id, card_order, card)
                 VALUES ($1, $2, $3)`,
                [match.match_id, row.order, row.card]
            );
        }

        let order = 1;
        for (const card of deck) {
            await client.query(
                `INSERT INTO skullcards_draw_pile (match_id, card_order, card)
                 VALUES ($1, $2, $3)`,
                [match.match_id, order++, card]
            );
        }

        await client.query(
            `UPDATE skullcards_rooms
             SET status = 'in_progress'
             WHERE room_id = $1`,
            [roomId]
        );

        await client.query('COMMIT');

        return {
            match,
            players,
            hands,
            drawPileSize: deck.length,
            discardTop: firstCard,
            currentColor,
            direction: 1,
            pendingDraw: 0
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function getMatchState(matchId) {
    const matchRes = await query(
        `SELECT match_id, room_id, status, current_turn_user_id, direction,
                current_color, pending_draw, discard_top, winner_user_id
         FROM skullcards_matches
         WHERE match_id = $1`,
        [matchId]
    );
    const match = matchRes.rows[0];
    if (!match) return null;

    const handsRes = await query(
        `SELECT user_id, card
         FROM skullcards_hands
         WHERE match_id = $1`,
        [matchId]
    );
    const hands = {};
    for (const row of handsRes.rows) {
        if (!hands[row.user_id]) hands[row.user_id] = [];
        hands[row.user_id].push(row.card);
    }

    const drawRes = await query(
        `SELECT card_order, card
         FROM skullcards_draw_pile
         WHERE match_id = $1
         ORDER BY card_order ASC`,
        [matchId]
    );
    const drawPile = drawRes.rows.map(r => r.card);

    const discardRes = await query(
        `SELECT card_order, card
         FROM skullcards_discard_pile
         WHERE match_id = $1
         ORDER BY card_order ASC`,
        [matchId]
    );
    const discardPile = discardRes.rows.map(r => r.card);

    return {
        matchId: match.match_id,
        roomId: match.room_id,
        status: match.status,
        currentTurnUserId: match.current_turn_user_id,
        direction: match.direction,
        currentColor: match.current_color,
        pendingDraw: match.pending_draw,
        discardTop: match.discard_top,
        winnerUserId: match.winner_user_id,
        hands,
        drawPile,
        discardPile
    };
}

async function getLatestActiveMatchForRoom(roomId) {
    const r = await query(
        `SELECT match_id
         FROM skullcards_matches
         WHERE room_id = $1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [roomId]
    );
    return r.rows[0]?.match_id || null;
}

async function saveMatchState(matchId, state) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE skullcards_matches
             SET current_turn_user_id = $2,
                 direction = $3,
                 current_color = $4,
                 pending_draw = $5,
                 discard_top = $6,
                 status = $7,
                 winner_user_id = $8,
                 finished_at = CASE WHEN status = 'finished' AND finished_at IS NULL THEN NOW() ELSE finished_at END
             WHERE match_id = $1`,
            [
                matchId,
                state.currentTurnUserId,
                state.direction,
                state.currentColor,
                state.pendingDraw,
                state.discardTop,
                state.status || 'active',
                state.winnerUserId || null
            ]
        );

        await client.query(
            `DELETE FROM skullcards_hands WHERE match_id = $1`,
            [matchId]
        );
        for (const [userId, cards] of Object.entries(state.hands || {})) {
            for (const card of cards) {
                await client.query(
                    `INSERT INTO skullcards_hands (match_id, user_id, card)
                     VALUES ($1, $2, $3)`,
                    [matchId, userId, card]
                );
            }
        }

        await client.query(
            `DELETE FROM skullcards_draw_pile WHERE match_id = $1`,
            [matchId]
        );
        let drawOrder = 1;
        for (const card of state.drawPile || []) {
            await client.query(
                `INSERT INTO skullcards_draw_pile (match_id, card_order, card)
                 VALUES ($1, $2, $3)`,
                [matchId, drawOrder++, card]
            );
        }

        await client.query(
            `DELETE FROM skullcards_discard_pile WHERE match_id = $1`,
            [matchId]
        );
        let discOrder = 1;
        for (const card of state.discardPile || []) {
            await client.query(
                `INSERT INTO skullcards_discard_pile (match_id, card_order, card)
                 VALUES ($1, $2, $3)`,
                [matchId, discOrder++, card]
            );
        }

        if (state.status === 'finished' && state.winnerUserId) {
            await client.query(
                `UPDATE skullcards_rooms
                 SET status = 'finished'
                 WHERE room_id = (SELECT room_id FROM skullcards_matches WHERE match_id = $1)`,
                [matchId]
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function listPublicRooms() {
    const roomsRes = await query(
        `SELECT room_id, host_user_id, status, is_public, created_at
         FROM skullcards_rooms
         WHERE is_public = true AND status = 'lobby'
         ORDER BY created_at DESC
         LIMIT 20`
    );
    const roomIds = roomsRes.rows.map(r => r.room_id);
    if (roomIds.length === 0) return [];
    const playersRes = await query(
        `SELECT room_id, user_id, joined_at
         FROM skullcards_room_players
         WHERE room_id = ANY($1)
         ORDER BY joined_at ASC`,
        [roomIds]
    );
    const playersByRoom = {};
    for (const row of playersRes.rows) {
        if (!playersByRoom[row.room_id]) playersByRoom[row.room_id] = [];
        playersByRoom[row.room_id].push({ user_id: row.user_id, joined_at: row.joined_at });
    }
    return roomsRes.rows.map(r => ({
        ...r,
        players: playersByRoom[r.room_id] || []
    }));
}

async function findRoomIdByCode(code) {
    if (!code) return null;
    const trimmed = String(code).trim();
    const clean = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
    if (!clean) return null;
    const likePattern = clean.replace(/[^a-fA-F0-9-]/g, '');
    const res = await query(
        `SELECT room_id
         FROM skullcards_rooms
         WHERE room_id::text ILIKE $1 || '%'
         ORDER BY created_at DESC
         LIMIT 1`,
        [likePattern]
    );
    return res.rows[0]?.room_id || null;
}

module.exports = {
    COLORS,
    buildUnoDeck,
    shuffle,
    getCardColor,
    createRoom,
    getRoom,
    joinRoom,
    listRoomPlayers,
    createMatchForRoom,
    getMatchState,
    getLatestActiveMatchForRoom,
    saveMatchState,
    listPublicRooms,
    findRoomIdByCode
};

