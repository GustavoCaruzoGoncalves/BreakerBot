const { Server } = require('socket.io');
const repo = require('../../database/repository');
const skullService = require('./skullcardsService');

function getUserIdFromToken(token) {
    if (!token) return null;
    return repo.getSession(token).then(session => {
        if (!session) return null;
        if (new Date(session.expiresAt).getTime() < Date.now()) {
            return null;
        }
        return session.userId;
    });
}

function normalizeRoomChannel(roomId) {
    return `skullcards_room_${roomId}`;
}

function normalizeMatchChannel(matchId) {
    return `skullcards_match_${matchId}`;
}

function setupSkullcardsSockets(httpServer, corsOrigins) {
    const io = new Server(httpServer, {
        cors: {
            origin: corsOrigins && corsOrigins.length ? corsOrigins : '*',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        socket.on('join_room', async (payload) => {
            try {
                const { roomId, token } = payload || {};
                const userId = await getUserIdFromToken(token);
                if (!userId) {
                    socket.emit('error', { type: 'auth', message: 'Sessão inválida' });
                    return;
                }

                const room = await skullService.getRoom(roomId);
                if (!room) {
                    socket.emit('error', { type: 'room', message: 'Sala não encontrada' });
                    return;
                }

                socket.data.userId = userId;
                socket.data.roomId = roomId;

                const roomChannel = normalizeRoomChannel(roomId);
                socket.join(roomChannel);

                io.to(roomChannel).emit('room_update', { room });

                const latestState = await skullService.getLatestActiveMatchForRoom(roomId);
                if (latestState) {
                    socket.join(normalizeMatchChannel(latestState.matchId));
                    socket.emit('game_state_update', { state: latestState });
                }
            } catch (err) {
                console.error('[SkullCards][join_room] erro:', err.message);
                socket.emit('error', { type: 'internal', message: 'Erro interno ao entrar na sala' });
            }
        });

        socket.on('play_card', async (payload) => {
            try {
                const { matchId, card, chosenColor, token } = payload || {};
                const userId = await getUserIdFromToken(token);
                if (!userId) {
                    socket.emit('error', { type: 'auth', message: 'Sessão inválida' });
                    return;
                }
                const result = await skullService.handlePlayCard(matchId, userId, card, chosenColor);
                if (!result.ok) {
                    socket.emit('error', { type: 'play', reason: result.reason });
                    return;
                }
                const state = result.state;
                const matchChannel = normalizeMatchChannel(matchId);
                const roomChannel = normalizeRoomChannel(state.roomId);

                io.to(matchChannel).emit('card_played', {
                    playerId: userId,
                    card,
                    chosenColor: chosenColor || null,
                    state
                });
                io.to(matchChannel).emit('game_state_update', { state });

                io.to(roomChannel).emit('card_played', {
                    playerId: userId,
                    card,
                    chosenColor: chosenColor || null,
                    state
                });
                io.to(roomChannel).emit('game_state_update', { state });

                if (state.winnerUserId) {
                    io.to(matchChannel).emit('player_won', {
                        winnerUserId: state.winnerUserId,
                        state
                    });
                    io.to(roomChannel).emit('player_won', {
                        winnerUserId: state.winnerUserId,
                        state
                    });
                } else {
                    io.to(matchChannel).emit('turn_changed', {
                        currentTurnUserId: state.currentTurnUserId,
                        direction: state.direction
                    });
                    io.to(roomChannel).emit('turn_changed', {
                        currentTurnUserId: state.currentTurnUserId,
                        direction: state.direction
                    });
                }
            } catch (err) {
                console.error('[SkullCards][play_card] erro:', err.message);
                socket.emit('error', { type: 'internal', message: 'Erro interno ao jogar carta' });
            }
        });

        socket.on('draw_card', async (payload) => {
            try {
                const { matchId, token } = payload || {};
                const userId = await getUserIdFromToken(token);
                if (!userId) {
                    socket.emit('error', { type: 'auth', message: 'Sessão inválida' });
                    return;
                }
                const result = await skullService.handleDrawCard(matchId, userId);
                if (!result.ok) {
                    socket.emit('error', { type: 'draw', reason: result.reason });
                    return;
                }
                const state = result.state;
                const matchChannel = normalizeMatchChannel(matchId);
                const roomChannel = normalizeRoomChannel(state.roomId);

                io.to(matchChannel).emit('card_drawn', {
                    playerId: userId,
                    drawn: result.event.drawn || [],
                    state
                });
                io.to(matchChannel).emit('game_state_update', { state });

                io.to(roomChannel).emit('card_drawn', {
                    playerId: userId,
                    drawn: result.event.drawn || [],
                    state
                });
                io.to(roomChannel).emit('game_state_update', { state });

                io.to(matchChannel).emit('turn_changed', {
                    currentTurnUserId: state.currentTurnUserId,
                    direction: state.direction
                });
                io.to(roomChannel).emit('turn_changed', {
                    currentTurnUserId: state.currentTurnUserId,
                    direction: state.direction
                });
            } catch (err) {
                console.error('[SkullCards][draw_card] erro:', err.message);
                socket.emit('error', { type: 'internal', message: 'Erro interno ao comprar carta' });
            }
        });

        socket.on('pass_turn', async (payload) => {
            try {
                const { matchId, token } = payload || {};
                const userId = await getUserIdFromToken(token);
                if (!userId) {
                    socket.emit('error', { type: 'auth', message: 'Sessão inválida' });
                    return;
                }
                const result = await skullService.handlePassTurn(matchId, userId);
                if (!result.ok) {
                    socket.emit('error', { type: 'pass', reason: result.reason });
                    return;
                }
                const state = result.state;
                const matchChannel = normalizeMatchChannel(matchId);
                const roomChannel = normalizeRoomChannel(state.roomId);

                io.to(matchChannel).emit('turn_changed', {
                    currentTurnUserId: state.currentTurnUserId,
                    direction: state.direction
                });
                io.to(matchChannel).emit('game_state_update', { state });

                io.to(roomChannel).emit('turn_changed', {
                    currentTurnUserId: state.currentTurnUserId,
                    direction: state.direction
                });
                io.to(roomChannel).emit('game_state_update', { state });
            } catch (err) {
                console.error('[SkullCards][pass_turn] erro:', err.message);
                socket.emit('error', { type: 'internal', message: 'Erro interno ao passar a vez' });
            }
        });

        socket.on('disconnect', () => {
            // For now we do not remove players from rooms on disconnect;
            // browser reconnections keep the logical room membership.
        });
    });

    return io;
}

module.exports = {
    setupSkullcardsSockets
};

