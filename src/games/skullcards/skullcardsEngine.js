const { COLORS, getCardColor, buildUnoDeck, shuffle } = require('../../database/skullcardsRepository');

function parseCard(card) {
    if (card === 'W') return { type: 'WILD', value: null, color: 'wild' };
    if (card === 'W+4') return { type: 'WILD_DRAW_FOUR', value: null, color: 'wild' };
    const [prefix, suffix] = card.split('-');
    const color = getCardColor(card);
    if (!suffix) return { type: 'UNKNOWN', value: null, color };
    if (suffix === 'SKIP') return { type: 'SKIP', value: null, color };
    if (suffix === 'REVERSE') return { type: 'REVERSE', value: null, color };
    if (suffix === '+2') return { type: 'DRAW_TWO', value: null, color };
    const num = parseInt(suffix, 10);
    if (!Number.isNaN(num)) {
        return { type: 'NUMBER', value: num, color };
    }
    return { type: 'UNKNOWN', value: null, color };
}

function canPlayCard(card, state, playerId) {
    if (state.currentTurnUserId !== playerId) {
        return { ok: false, reason: 'not_player_turn' };
    }
    const parsed = parseCard(card);
    const topParsed = parseCard(state.discardTop);

    if (state.pendingDraw > 0) {
        const isDrawStackCard =
            parsed.type === 'DRAW_TWO' ||
            parsed.type === 'WILD_DRAW_FOUR';
        if (!isDrawStackCard) {
            return { ok: false, reason: 'must_resolve_draw_stack' };
        }
    }

    if (parsed.type === 'WILD' || parsed.type === 'WILD_DRAW_FOUR') {
        return { ok: true };
    }

    const sameColor = parsed.color === state.currentColor;
    const sameValue =
        parsed.type === topParsed.type &&
        ((parsed.type === 'NUMBER' && parsed.value === topParsed.value) ||
         parsed.type !== 'NUMBER');

    if (sameColor || sameValue) {
        return { ok: true };
    }

    return { ok: false, reason: 'card_not_match' };
}

function nextPlayer(players, currentId, direction) {
    const idx = players.indexOf(currentId);
    if (idx === -1) return players[0];
    const len = players.length;
    const nextIndex = (idx + direction + len) % len;
    return players[nextIndex];
}

function drawFromPile(state, count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
        if (state.drawPile.length === 0) {
            if (state.discardPile.length <= 1) break;
            const top = state.discardPile[state.discardPile.length - 1];
            const rest = state.discardPile.slice(0, -1);
            state.drawPile = shuffle(rest);
            state.discardPile = [top];
        }
        const card = state.drawPile.shift();
        if (card) drawn.push(card);
    }
    return drawn;
}

function applyPlay(state, players, playerId, card, chosenColor) {
    const parsed = parseCard(card);

    const hand = state.hands[playerId] || [];
    const idx = hand.indexOf(card);
    if (idx === -1) {
        return { ok: false, reason: 'card_not_in_hand' };
    }

    hand.splice(idx, 1);
    state.hands[playerId] = hand;

    state.discardPile.push(card);
    state.discardTop = card;

    if (parsed.type === 'WILD' || parsed.type === 'WILD_DRAW_FOUR') {
        if (!chosenColor || !['red', 'yellow', 'green', 'blue'].includes(chosenColor)) {
            return { ok: false, reason: 'invalid_color_choice' };
        }
        state.currentColor = chosenColor;
    } else {
        state.currentColor = parsed.color;
    }

    const victimId = nextPlayer(players, playerId, state.direction);

    if (parsed.type === 'SKIP') {
        // pula o próximo jogador
        const afterSkip = nextPlayer(players, victimId, state.direction);
        state.currentTurnUserId = afterSkip;
    } else if (parsed.type === 'REVERSE') {
        if (players.length === 2) {
            // em 2 jogadores, REVERSE age como SKIP: volta para quem jogou
            state.currentTurnUserId = playerId;
        } else {
            state.direction = state.direction === 1 ? -1 : 1;
            state.currentTurnUserId = victimId;
        }
    } else if (parsed.type === 'DRAW_TWO') {
        state.pendingDraw += 2;
        // próximo jogador (vítima) deverá comprar ou empilhar
        state.currentTurnUserId = victimId;
    } else if (parsed.type === 'WILD_DRAW_FOUR') {
        state.pendingDraw += 4;
        state.currentTurnUserId = victimId;
    } else {
        // carta numérica ou WILD simples: passa a vez para o próximo
        state.currentTurnUserId = victimId;
    }

    let winnerUserId = null;
    if (state.hands[playerId].length === 0) {
        winnerUserId = playerId;
        state.status = 'finished';
        state.winnerUserId = winnerUserId;
    }

    return {
        ok: true,
        winnerUserId,
        nextPlayerId: state.currentTurnUserId
    };
}

function applyDraw(state, players, playerId) {
    if (state.currentTurnUserId !== playerId) {
        return { ok: false, reason: 'not_player_turn' };
    }
    const drawCount = state.pendingDraw > 0 ? state.pendingDraw : 1;
    const drawnCards = drawFromPile(state, drawCount);
    if (!state.hands[playerId]) state.hands[playerId] = [];
    state.hands[playerId].push(...drawnCards);

    state.pendingDraw = 0;

    const nextId = nextPlayer(players, playerId, state.direction);
    state.currentTurnUserId = nextId;

    return {
        ok: true,
        drawn: drawnCards,
        nextPlayerId: nextId
    };
}

function applyPass(state, players, playerId) {
    if (state.currentTurnUserId !== playerId) {
        return { ok: false, reason: 'not_player_turn' };
    }
    if (state.pendingDraw > 0) {
        return { ok: false, reason: 'must_draw' };
    }
    const hand = state.hands[playerId] || [];
    const canPlay = hand.some(card => canPlayCard(card, state, playerId).ok);
    if (canPlay) {
        return { ok: false, reason: 'has_playable_cards' };
    }
    const nextId = nextPlayer(players, playerId, state.direction);
    state.currentTurnUserId = nextId;
    return {
        ok: true,
        nextPlayerId: nextId
    };
}

module.exports = {
    parseCard,
    canPlayCard,
    nextPlayer,
    drawFromPile,
    applyPlay,
    applyDraw,
    applyPass
};

