const skullRepo = require('../../database/skullcardsRepository');
const engine = require('./skullcardsEngine');

async function createRoomForUser(userId, isPublic = false) {
    return skullRepo.createRoom(userId, isPublic);
}

async function joinRoom(roomId, userId) {
    return skullRepo.joinRoom(roomId, userId);
}

async function getRoom(roomId) {
    return skullRepo.getRoom(roomId);
}

async function startMatch(roomId) {
    const info = await skullRepo.createMatchForRoom(roomId);
    const state = await skullRepo.getMatchState(info.match.match_id);
    return { info, state };
}

async function getMatchState(matchId) {
    return skullRepo.getMatchState(matchId);
}

async function listPublicRooms() {
    return skullRepo.listPublicRooms();
}

async function resolveRoomIdFromCodeOrId(roomKey) {
    if (!roomKey) return null;
    const trimmed = String(roomKey).trim();
    if (trimmed.includes('-') && !trimmed.startsWith('#')) {
        return trimmed;
    }
    const resolved = await skullRepo.findRoomIdByCode(trimmed);
    return resolved;
}

async function getLatestActiveMatchForRoom(roomId) {
    const matchId = await skullRepo.getLatestActiveMatchForRoom(roomId);
    if (!matchId) return null;
    return skullRepo.getMatchState(matchId);
}

async function handlePlayCard(matchId, playerId, card, chosenColor) {
    const state = await skullRepo.getMatchState(matchId);
    if (!state) {
        return { ok: false, reason: 'match_not_found' };
    }
    const players = await skullRepo.listRoomPlayers(state.roomId);

    const res = engine.canPlayCard(card, state, playerId);
    if (!res.ok) {
        return { ok: false, reason: res.reason || 'invalid_play', state };
    }

    const applyRes = engine.applyPlay(state, players, playerId, card, chosenColor);
    if (!applyRes.ok) {
        return { ok: false, reason: applyRes.reason || 'apply_failed', state };
    }

    await skullRepo.saveMatchState(matchId, state);
    const newState = await skullRepo.getMatchState(matchId);

    return {
        ok: true,
        state: newState,
        event: {
            type: 'card_played',
            playerId,
            card,
            chosenColor: chosenColor || null
        }
    };
}

async function handleDrawCard(matchId, playerId) {
    const state = await skullRepo.getMatchState(matchId);
    if (!state) {
        return { ok: false, reason: 'match_not_found' };
    }
    const players = await skullRepo.listRoomPlayers(state.roomId);

    const applyRes = engine.applyDraw(state, players, playerId);
    if (!applyRes.ok) {
        return { ok: false, reason: applyRes.reason || 'draw_failed', state };
    }

    await skullRepo.saveMatchState(matchId, state);
    const newState = await skullRepo.getMatchState(matchId);

    return {
        ok: true,
        state: newState,
        event: {
            type: 'card_drawn',
            playerId,
            drawn: applyRes.drawn || []
        }
    };
}

async function handlePassTurn(matchId, playerId) {
    const state = await skullRepo.getMatchState(matchId);
    if (!state) {
        return { ok: false, reason: 'match_not_found' };
    }
    const players = await skullRepo.listRoomPlayers(state.roomId);

    const applyRes = engine.applyPass(state, players, playerId);
    if (!applyRes.ok) {
        return { ok: false, reason: applyRes.reason || 'pass_failed', state };
    }

    await skullRepo.saveMatchState(matchId, state);
    const newState = await skullRepo.getMatchState(matchId);

    return {
        ok: true,
        state: newState,
        event: {
            type: 'turn_changed',
            playerId: newState.currentTurnUserId
        }
    };
}

module.exports = {
    createRoomForUser,
    joinRoom,
    getRoom,
    startMatch,
    getMatchState,
    listPublicRooms,
    resolveRoomIdFromCodeOrId,
    getLatestActiveMatchForRoom,
    handlePlayCard,
    handleDrawCard,
    handlePassTurn
};

