const fs = require('fs');
const path = require('path');
const mentionsController = require('../../controllers/mentionsController');

const USERS_LEVELS_PATH = path.resolve(__dirname, '..', '..', '..', 'levels_info', 'users.json');

const MISSION_IDS = ['messages_500', 'reactions_500', 'duel_win', 'survive_attack', 'send_media', 'help_someone'];
const MISSION_CONFIG = {
    messages_500:   { target: 500, reward: 1000, label: 'Mande 500 mensagens' },
    reactions_500:  { target: 500, reward: 2000, label: 'Reaja 500x com 💀 ou ☠️' },
    duel_win:       { target: 1,   reward: 1000, label: 'Vença 1 duelo (!mog)' },
    survive_attack: { target: 1,   reward: 2000, label: 'Sobreviva a um ataque (!mognow)' },
    send_media:     { target: 1,   reward: 200,  label: 'Envie mídia (figurinha/vídeo/imagem/doc)' },
    help_someone:   { target: 1,   reward: 100,  label: 'Ajude alguém (!respeito)' }
};

const AURA_TIERS = [
    { minPoints: 50000, name: 'Deus do chat' },
    { minPoints: 10000, name: 'Entidade' },
    { minPoints: 5000,  name: 'Sigma' },
    { minPoints: 2000,  name: 'Dominante' },
    { minPoints: 500,   name: 'Presença' },
    { minPoints: 0,     name: 'NPC' }
];

function getAuraTier(auraPoints) {
    const points = Number(auraPoints) || 0;
    for (const tier of AURA_TIERS) {
        if (points >= tier.minPoints) return tier;
    }
    return AURA_TIERS[AURA_TIERS.length - 1];
}

function formatNameWithTitle(displayName, auraPoints, isGroup = true) {
    const tier = getAuraTier(auraPoints);
    const suffix = isGroup ? 'do Grupo' : 'do Chat';
    return `🔥 ${displayName} — ${tier.name} ${suffix}`;
}

const activeMogDuel = new Map();
const mognowActive = new Map();

const MOG_DURATION_MS = 15000;
const MOGNOW_COUNTDOWN_SEC = 5;
const MOGNOW_WINDOW_MS = 15000;

const EVENT_COOLDOWN_MS = 2 * 60 * 1000;
const EVENT_SPAWN_CHANCE = 0.012;
const EVENT_CHANCE_MAX = 0.30;
const activeRandomEvents = new Map();
const lastRandomEventAt = new Map();

const RANDOM_EVENTS = [
    { id: 'energia_rara', chance: 0.30, message: '💠 *Uma energia rara apareceu no chat!* Primeiro a digitar *!absorver* ganha *200* de aura.', command: '!absorver', type: 'first', durationMs: 60000, effect: { type: 'aura', amount: 200 } },
    { id: 'fenda', chance: 0.14, message: '⚡ *Uma fenda dimensional abriu!* Todos que digitarem *!entrar* nos próximos 45 segundos ganham *50* de aura.', command: '!entrar', type: 'all', durationMs: 45000, effect: { type: 'aura', amount: 50 } },
    { id: 'cristal', chance: 0.11, message: '💎 *Um cristal de aura surgiu!* O primeiro a digitar *!pegar* recebe *150* de aura.', command: '!pegar', type: 'first', durationMs: 50000, effect: { type: 'aura', amount: 150 } },
    { id: 'vento', chance: 0.10, message: '🌬️ *Um vento favorável passa pelo grupo!* Primeiro a digitar *!aproveitar* ganha *100* de aura.', command: '!aproveitar', type: 'first', durationMs: 55000, effect: { type: 'aura', amount: 100 } },
    { id: 'oferenda', chance: 0.08, message: '👑 *Os deuses deixaram uma oferenda!* Quem digitar *!aceitar* primeiro ganha *300* de aura.', command: '!aceitar', type: 'first', durationMs: 60000, effect: { type: 'aura', amount: 300 } },
    { id: 'pocao', chance: 0.06, message: '🧪 *Uma poção brilhante apareceu!* Primeiro a digitar *!beber* ganha *80* de aura.', command: '!beber', type: 'first', durationMs: 40000, effect: { type: 'aura', amount: 80 } },
    { id: 'espirito', chance: 0.05, message: '👻 *O espírito do grupo se manifesta!* Todos que digitarem *!invocar* em 1 minuto ganham *30* de aura.', command: '!invocar', type: 'all', durationMs: 60000, effect: { type: 'aura', amount: 30 } },
    { id: 'armadilha', chance: 0.04, message: '🕳️ *Uma armadilha sombria está ativa!* O primeiro a digitar *!tocar* *perde* *100* de aura. Cuidado!', command: '!tocar', type: 'first', durationMs: 50000, effect: { type: 'aura', amount: -100 } },
    { id: 'fenda_maldita', chance: 0.03, message: '💀 *Uma fenda maldita se abre!* Quem digitar *!entrar* primeiro *perde* *150* de aura.', command: '!entrar', type: 'first', durationMs: 45000, effect: { type: 'aura', amount: -150 } },
    { id: 'caixa', chance: 0.03, message: '📦 *Uma caixa misteriosa apareceu!* O primeiro a digitar *!abrir* pode ganhar ou perder aura… (sorte ou azar!)', command: '!abrir', type: 'first', durationMs: 50000, effect: { type: 'aura_random', options: [100, 100, -80, -80, 200] } },
    { id: 'ruina', chance: 0.02, message: '🏛️ *Ruínas antigas emanam energia!* O primeiro a digitar *!explorar* arrisca: *+200* ou *-100* de aura.', command: '!explorar', type: 'first', durationMs: 55000, effect: { type: 'aura_random', options: [200, -100] } },
    { id: 'nuvem', chance: 0.02, message: '☁️ *Uma nuvem de aura pairou no chat!* Todos que digitarem *!respirar* em 40 segundos ganham *40* de aura.', command: '!respirar', type: 'all', durationMs: 40000, effect: { type: 'aura', amount: 40 } },
    { id: 'meteoro', chance: 0.01, message: '☄️ *Um meteoro de aura está caindo!* Primeiro a digitar *!pegar* ganha *250* de aura.', command: '!pegar', type: 'first', durationMs: 45000, effect: { type: 'aura', amount: 250 } },
    { id: 'ilusao', chance: 0.01, message: '🪞 *Uma ilusão perigosa apareceu!* Quem digitar *!tocar* *perde* *50* de aura. Só o primeiro é afetado.', command: '!tocar', type: 'first', durationMs: 40000, effect: { type: 'aura', amount: -50 } },
    { id: 'emanar', chance: 0.01, message: '🌟 *Uma aura poderosa está emanando no chat!* O primeiro a digitar *!emanar* canaliza *180* de aura.', command: '!emanar', type: 'first', durationMs: 55000, effect: { type: 'aura', amount: 180 } },
    { id: 'manifestar', chance: 0.01, message: '👁️ *Uma presença quer se manifestar no grupo!* Todos que digitarem *!manifestar* nos próximos 50 segundos recebem *60* de aura.', command: '!manifestar', type: 'all', durationMs: 50000, effect: { type: 'aura', amount: 60 } },
];

function getRandomEvent() {
    const totalChance = RANDOM_EVENTS.reduce((s, e) => s + (e.chance ?? 0), 0);
    if (totalChance <= 0) return RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    let r = Math.random() * totalChance;
    for (const event of RANDOM_EVENTS) {
        const p = event.chance ?? 0;
        if (r < p) return event;
        r -= p;
    }
    return RANDOM_EVENTS[RANDOM_EVENTS.length - 1];
}

function clearEventTimer(chatId) {
    const state = activeRandomEvents.get(chatId);
    if (state && state.timeoutId) clearTimeout(state.timeoutId);
    activeRandomEvents.delete(chatId);
}

async function trySpawnRandomEvent(sock, chatId) {
    if (!chatId.endsWith('@g.us')) return;
    const now = Date.now();
    if (activeRandomEvents.has(chatId)) return;
    const last = lastRandomEventAt.get(chatId) || 0;
    if (now - last < EVENT_COOLDOWN_MS) return;
    if (Math.random() >= EVENT_SPAWN_CHANCE) return;
    const event = getRandomEvent();
    lastRandomEventAt.set(chatId, now);
    const state = {
        ...event,
        endsAt: now + event.durationMs,
        winnerKey: null,
        participants: event.type === 'all' ? new Set() : null,
        timeoutId: setTimeout(() => {
            clearEventTimer(chatId);
        }, event.durationMs + 500)
    };
    activeRandomEvents.set(chatId, state);
    await sock.sendMessage(chatId, { text: event.message });
}

function applyEventEffect(effect, senderAuraKey) {
    if (effect.type === 'aura') {
        return { type: 'aura', amount: effect.amount, newTotal: auraSystem.addAuraPoints(senderAuraKey, effect.amount) };
    }
    if (effect.type === 'aura_random') {
        const amount = effect.options[Math.floor(Math.random() * effect.options.length)];
        return { type: 'aura', amount, newTotal: auraSystem.addAuraPoints(senderAuraKey, amount) };
    }
    return null;
}

function getUserIdNumber(jid) {
    if (!jid) return null;
    return jid.split('@')[0].split(':')[0];
}

function getJidFromNumber(number) {
    if (!number) return null;
    return `${number}@s.whatsapp.net`;
}

function getLevelUserData(number) {
    try {
        const jid = getJidFromNumber(number);
        if (!jid || !fs.existsSync(USERS_LEVELS_PATH)) return null;
        const data = JSON.parse(fs.readFileSync(USERS_LEVELS_PATH, 'utf8'));
        return data[jid] || null;
    } catch (e) {
        return null;
    }
}

function getCanonicalUserKey(jid) {
    if (!jid || !fs.existsSync(USERS_LEVELS_PATH)) return null;
    try {
        const usersData = JSON.parse(fs.readFileSync(USERS_LEVELS_PATH, 'utf8'));
        if (usersData[jid]) {
            for (const [savedJid, userData] of Object.entries(usersData)) {
                if (savedJid === jid) continue;
                if (typeof savedJid === 'string' && savedJid.includes('@') && userData && userData.jid === jid)
                    return savedJid;
            }
            return jid;
        }
        for (const [savedJid, userData] of Object.entries(usersData)) {
            if (userData.jid === jid) return savedJid;
        }
        const phoneNumber = jid.split('@')[0].split(':')[0];
        const possibleJid = `${phoneNumber}@s.whatsapp.net`;
        if (usersData[possibleJid]) return possibleJid;
        return null;
    } catch (e) {
        return null;
    }
}

function getJidForMention(jid) {
    const canonical = getCanonicalUserKey(jid) || jid;
    try {
        if (!fs.existsSync(USERS_LEVELS_PATH)) return canonical;
        const usersData = JSON.parse(fs.readFileSync(USERS_LEVELS_PATH, 'utf8'));
        const user = usersData[canonical];
        return (user && user.jid) ? user.jid : canonical;
    } catch (e) {
        return canonical;
    }
}

function getAuraKey(jidOrNumber) {
    if (!jidOrNumber) return null;
    const jid = typeof jidOrNumber === 'string' && jidOrNumber.includes('@') ? jidOrNumber : getJidFromNumber(jidOrNumber);
    const canonical = getCanonicalUserKey(jid);
    if (canonical) return canonical;
    const num = getUserIdNumber(jid);
    return num ? getJidFromNumber(num) : jid;
}

const AURA_GLOBAL_KEY = '__auraGlobal';

function readUsersDataForAura() {
    try {
        if (fs.existsSync(USERS_LEVELS_PATH)) {
            return JSON.parse(fs.readFileSync(USERS_LEVELS_PATH, 'utf8'));
        }
    } catch (error) {
        console.error('[AURA] Erro ao ler users.json:', error);
    }
    return {};
}

function writeUsersDataForAura(usersData) {
    try {
        fs.writeFileSync(USERS_LEVELS_PATH, JSON.stringify(usersData, null, 2));
    } catch (error) {
        console.error('[AURA] Erro ao salvar users.json:', error);
        throw error;
    }
}

function defaultAuraData() {
    return {
        auraPoints: 0,
        stickerHash: null,
        character: null,
        dailyMissions: {
            lastResetDate: null,
            drawnMissions: [],
            completedMissionIds: [],
            progress: { messages: 0, reactions: 0, duelWin: 0, surviveAttack: 0, media: 0, helpSomeone: 0 }
        },
        lastRitualDate: null,
        lastTreinarAt: null,
        lastDominarAt: null
    };
}

class AuraSystem {
    constructor() {}

    getTodayDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    drawDailyMissions() {
        const shuffled = [...MISSION_IDS].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3);
    }

    maybeResetDailyMissions(auraObj) {
        const today = this.getTodayDateString();
        const dm = auraObj.dailyMissions;
        const needsReset = !dm || dm.lastResetDate !== today || !Array.isArray(dm.drawnMissions) || dm.drawnMissions.length !== 3;
        if (needsReset) {
            auraObj.dailyMissions = {
                lastResetDate: today,
                drawnMissions: this.drawDailyMissions(),
                completedMissionIds: [],
                progress: { messages: 0, reactions: 0, duelWin: 0, surviveAttack: 0, media: 0, helpSomeone: 0 }
            };
        }
        return auraObj;
    }

    initUser(usersData, number) {
        if (number === AURA_GLOBAL_KEY || !number || !number.includes('@')) return null;
        if (!usersData[number]) {
            usersData[number] = {
                xp: 0,
                level: 1,
                prestige: 0,
                prestigeAvailable: 0,
                totalMessages: 0,
                lastMessageTime: null,
                badges: [],
                lastPrestigeLevel: 0,
                levelHistory: [],
                dailyBonusMultiplier: 0,
                dailyBonusExpiry: null,
                allowMentions: false,
                pushName: null,
                customName: null,
                customNameEnabled: false,
                jid: number,
                profilePicture: null,
                profilePictureUpdatedAt: null,
                aura: defaultAuraData()
            };
            const today = this.getTodayDateString();
            usersData[number].aura.dailyMissions.lastResetDate = today;
            usersData[number].aura.dailyMissions.drawnMissions = this.drawDailyMissions();
        } else if (!usersData[number].aura) {
            usersData[number].aura = defaultAuraData();
            usersData[number].aura.dailyMissions.lastResetDate = this.getTodayDateString();
            usersData[number].aura.dailyMissions.drawnMissions = this.drawDailyMissions();
        }
        const aura = usersData[number].aura;
        this.maybeResetDailyMissions(aura);
        return aura;
    }

    getUserAura(number) {
        const usersData = readUsersDataForAura();
        const before = usersData[number]?.aura?.dailyMissions?.lastResetDate;
        const aura = this.initUser(usersData, number);
        if (!aura) return null;
        const after = aura.dailyMissions.lastResetDate;
        if (before !== after) writeUsersDataForAura(usersData);
        return aura;
    }

    hasMission(number, missionId) {
        const user = this.getUserAura(number);
        if (!user) return false;
        const drawn = user.dailyMissions?.drawnMissions || [];
        const completed = user.dailyMissions?.completedMissionIds || [];
        return drawn.includes(missionId) && !completed.includes(missionId);
    }

    getProgress(number, missionId) {
        const user = this.getUserAura(number);
        if (!user) return 0;
        const progKey = missionId === 'messages_500' ? 'messages' : missionId === 'reactions_500' ? 'reactions' : missionId === 'duel_win' ? 'duelWin' : missionId === 'survive_attack' ? 'surviveAttack' : missionId === 'send_media' ? 'media' : 'helpSomeone';
        return (user.dailyMissions?.progress?.[progKey] ?? 0);
    }

    incrementProgress(number, missionId, amount = 1) {
        const usersData = readUsersDataForAura();
        this.initUser(usersData, number);
        const aura = usersData[number]?.aura;
        if (!aura) return null;
        const progKey = missionId === 'messages_500' ? 'messages' : missionId === 'reactions_500' ? 'reactions' : missionId === 'duel_win' ? 'duelWin' : missionId === 'survive_attack' ? 'surviveAttack' : missionId === 'send_media' ? 'media' : 'helpSomeone';
        const progress = aura.dailyMissions.progress;
        progress[progKey] = (progress[progKey] || 0) + amount;
        const target = MISSION_CONFIG[missionId]?.target ?? 1;
        let completed = null;
        if (progress[progKey] >= target) {
            completed = missionId;
            this.completeMissionInData(usersData, number, missionId);
        }
        writeUsersDataForAura(usersData);
        return completed ? { completed: missionId, reward: MISSION_CONFIG[missionId]?.reward ?? 0 } : null;
    }

    completeMissionInData(usersData, number, missionId) {
        this.initUser(usersData, number);
        const aura = usersData[number]?.aura;
        if (!aura) return;
        const completed = aura.dailyMissions.completedMissionIds || [];
        if (completed.includes(missionId)) return;
        completed.push(missionId);
        aura.dailyMissions.completedMissionIds = completed;
        const reward = MISSION_CONFIG[missionId]?.reward ?? 0;
        aura.auraPoints = (aura.auraPoints || 0) + reward;
    }

    completeMission(number, missionId) {
        const usersData = readUsersDataForAura();
        this.completeMissionInData(usersData, number, missionId);
        writeUsersDataForAura(usersData);
        return MISSION_CONFIG[missionId]?.reward ?? 0;
    }

    setStickerHash(number, hash) {
        const usersData = readUsersDataForAura();
        this.initUser(usersData, number);
        if (usersData[number]?.aura) usersData[number].aura.stickerHash = hash;
        writeUsersDataForAura(usersData);
    }

    setCharacter(number, character) {
        const usersData = readUsersDataForAura();
        this.initUser(usersData, number);
        if (usersData[number]?.aura) usersData[number].aura.character = character;
        writeUsersDataForAura(usersData);
    }

    addAuraPoints(number, amount) {
        const usersData = readUsersDataForAura();
        this.initUser(usersData, number);
        const aura = usersData[number]?.aura;
        if (!aura) return 0;
        aura.auraPoints = (aura.auraPoints || 0) + amount;
        writeUsersDataForAura(usersData);
        return aura.auraPoints;
    }

    transferAura(fromNumber, toNumber, amount) {
        const usersData = readUsersDataForAura();
        this.initUser(usersData, fromNumber);
        this.initUser(usersData, toNumber);
        const fromPoints = usersData[fromNumber]?.aura?.auraPoints || 0;
        if (fromPoints < amount) return { ok: false, reason: 'insufficient' };
        usersData[fromNumber].aura.auraPoints = fromPoints - amount;
        usersData[toNumber].aura.auraPoints = (usersData[toNumber].aura.auraPoints || 0) + amount;
        writeUsersDataForAura(usersData);
        return { ok: true, fromRemaining: usersData[fromNumber].aura.auraPoints, toNew: usersData[toNumber].aura.auraPoints };
    }

    getStickerHashFromMessage(msg) {
        const sticker = msg?.message?.stickerMessage || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
        if (!sticker) return null;
        const buf = sticker.fileSha256 || sticker.fileEncSha256;
        if (!buf) return null;
        const bytes = Buffer.isBuffer(buf) ? buf : (buf instanceof Uint8Array ? Buffer.from(buf) : null);
        if (!bytes) return null;
        return bytes.toString('base64');
    }

    getStickerFromMessage(msg) {
        return msg?.message?.stickerMessage || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
    }

    isMediaMessage(msg) {
        if (!msg?.message) return false;
        const k = Object.keys(msg.message)[0];
        return ['stickerMessage', 'imageMessage', 'videoMessage', 'documentMessage'].includes(k);
    }

    getCooldown(number, cooldownKey) {
        const usersData = readUsersDataForAura();
        this.initUser(usersData, number);
        return usersData[number]?.aura?.[cooldownKey];
    }

    setCooldown(number, cooldownKey, value) {
        const usersData = readUsersDataForAura();
        this.initUser(usersData, number);
        if (usersData[number]?.aura) usersData[number].aura[cooldownKey] = value;
        writeUsersDataForAura(usersData);
    }

    getPendingMogByChat() {
        const usersData = readUsersDataForAura();
        const global = usersData[AURA_GLOBAL_KEY];
        return (global && global.pendingMogByChat) ? global.pendingMogByChat : {};
    }

    setPendingMogByChat(byChat) {
        const usersData = readUsersDataForAura();
        if (!usersData[AURA_GLOBAL_KEY]) usersData[AURA_GLOBAL_KEY] = {};
        usersData[AURA_GLOBAL_KEY].pendingMogByChat = byChat;
        writeUsersDataForAura(usersData);
    }

    getPendingMogList(chatId) {
        const byChat = this.getPendingMogByChat();
        return byChat[chatId] || [];
    }

    addPendingMog(chatId, entry) {
        const byChat = this.getPendingMogByChat();
        const list = byChat[chatId] || [];
        list.push(entry);
        byChat[chatId] = list;
        this.setPendingMogByChat(byChat);
    }

    clearPendingMogForChat(chatId) {
        const byChat = this.getPendingMogByChat();
        delete byChat[chatId];
        this.setPendingMogByChat(byChat);
    }

    getAuraRanking(limit = 10) {
        const usersData = readUsersDataForAura();
        const entries = [];
        for (const [userId, userData] of Object.entries(usersData)) {
            if (typeof userId !== 'string' || !userId.includes('@') || !userData?.aura) continue;
            const auraPoints = userData.aura.auraPoints ?? 0;
            entries.push({
                userId,
                auraPoints,
                tierName: getAuraTier(auraPoints).name
            });
        }
        entries.sort((a, b) => b.auraPoints - a.auraPoints);
        return entries.slice(0, limit);
    }
}

const auraSystem = new AuraSystem();

const PRAISED_PATH = path.resolve(__dirname, '..', '..', '..', 'data', 'praised.json');

function readPraised() {
    try {
        if (fs.existsSync(PRAISED_PATH)) {
            return JSON.parse(fs.readFileSync(PRAISED_PATH, 'utf8'));
        }
    } catch (e) {
        console.error('[AURA] Erro ao ler praised.json:', e);
    }
    return {};
}

function writePraised(data) {
    try {
        const dir = path.dirname(PRAISED_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(PRAISED_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[AURA] Erro ao salvar praised.json:', e);
    }
}

function addPraise(fromAuraKey, toAuraKey) {
    const data = readPraised();
    if (!data[toAuraKey]) data[toAuraKey] = [];
    data[toAuraKey].push(fromAuraKey);
    writePraised(data);
}

function getWhoPraised(targetAuraKey) {
    const data = readPraised();
    return data[targetAuraKey] || [];
}

function getMentionedJid(msg) {
    const mentioned = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (Array.isArray(mentioned) && mentioned.length > 0) return mentioned[0];
    return null;
}

async function checkAuraNegativeAndPunish(sock, chatId, number, contactsCache) {
    const user = auraSystem.getUserAura(number);
    if (!user) return;
    const aura = user.auraPoints ?? 0;
    if (aura >= 0) return;
    const jid = number.includes('@') ? number : getJidFromNumber(number);
    const mentionInfo = mentionsController.processSingleMention(getJidForMention(jid), contactsCache);
    await sock.sendMessage(chatId, {
        text: `${mentionInfo.mentionText} FARMOU AURA NEGATIVA, -1000 AURA 💀💀💀`,
        mentions: mentionInfo.mentions
    });
    auraSystem.addAuraPoints(number, -1000);
}

async function endMogDuel(sock, chatId, duel) {
    activeMogDuel.delete(chatId);
    const fromKey = duel.fromKey;
    const toKey = duel.toKey;
    const countFrom = duel.countFrom || 0;
    const countTo = duel.countTo || 0;
    const winnerKey = countFrom > countTo ? fromKey : countTo > countFrom ? toKey : null;
    if (!winnerKey) {
        await sock.sendMessage(chatId, { text: `⏱ Empate! (${countFrom} x ${countTo} mensagens) Ninguém ganha aura.` });
        return;
    }
    const winnerNum = getUserIdNumber(winnerKey);
    const winnerAuraKey = getAuraKey(winnerKey);
    const levelUser = getLevelUserData(winnerNum);
    const winnerName = levelUser?.customNameEnabled && levelUser?.customName ? levelUser.customName : (levelUser?.pushName || winnerNum);
    const winnerCount = winnerKey === fromKey ? countFrom : countTo;
    const loserCount = winnerKey === fromKey ? countTo : countFrom;
    auraSystem.addAuraPoints(winnerAuraKey, 500);
    const missionReward = auraSystem.hasMission(winnerAuraKey, 'duel_win') ? auraSystem.completeMission(winnerAuraKey, 'duel_win') : 0;
    const totalGain = 500 + missionReward;
    await sock.sendMessage(chatId, {
        text: `🏆 Duelo encerrado! *${winnerName}* venceu o mog! (${winnerCount} x ${loserCount} mensagens)\n✨ *+500* aura pela vitória${missionReward ? ` + *${missionReward}* pela missão (Vença 1 duelo)` : ''} = *${totalGain}* aura no total.`
    });
}

async function auraCommandBot(sock, { messages }, contactsCache = {}) {
    const msg = messages[0];
    if (!msg?.message || !msg.key?.remoteJid) return;

    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participantAlt || msg.key.participant || chatId) : chatId;
    const number = getUserIdNumber(sender);
    if (!number) return;
    if (msg.key.fromMe) return;
    const senderAuraKey = getAuraKey(sender);

    const messageType = Object.keys(msg.message)[0];
    const textMessage = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();

    const activeEvent = activeRandomEvents.get(chatId);
    if (activeEvent && textMessage) {
        const cmd = textMessage.trim().toLowerCase();
        const eventCmd = activeEvent.command.trim().toLowerCase();
        if (cmd === eventCmd && Date.now() <= activeEvent.endsAt) {
            const senderKey = getCanonicalUserKey(sender) || sender;
            if (activeEvent.type === 'first') {
                if (activeEvent.winnerKey) {
                    await sock.sendMessage(chatId, { text: '⏳ Esse evento já foi conquistado por alguém!' }, { quoted: msg });
                    return;
                }
                const result = applyEventEffect(activeEvent.effect, senderAuraKey);
                activeEvent.winnerKey = senderKey;
                clearEventTimer(chatId);
                const levelUser = getLevelUserData(number);
                const displayName = levelUser?.customNameEnabled && levelUser?.customName ? levelUser.customName : (levelUser?.pushName || number);
                const emoji = result.amount >= 0 ? '✨' : '💀';
                await sock.sendMessage(chatId, { text: `${emoji} *${displayName}* ${result.amount >= 0 ? 'ganhou' : 'perdeu'} *${Math.abs(result.amount)}* de aura! Total: *${result.newTotal}*` }, { quoted: msg });
                return;
            }
            if (activeEvent.type === 'all') {
                if (activeEvent.participants.has(senderKey)) {
                    await sock.sendMessage(chatId, { text: '✅ Você já participou deste evento!' }, { quoted: msg });
                    return;
                }
                activeEvent.participants.add(senderKey);
                const result = applyEventEffect(activeEvent.effect, senderAuraKey);
                const levelUser = getLevelUserData(number);
                const displayName = levelUser?.customNameEnabled && levelUser?.customName ? levelUser.customName : (levelUser?.pushName || number);
                await sock.sendMessage(chatId, { text: `✨ *${displayName}* entrou e ganhou *${result.amount}* de aura! Total: *${result.newTotal}*` }, { quoted: msg });
                return;
            }
        }
    }

    trySpawnRandomEvent(sock, chatId).catch(() => {});

    const mognowState = mognowActive.get(chatId);
    if (mognowState) {
        const now = Date.now();
        const gameStarted = now >= mognowState.gameStartsAt;
        const gameEnded = now > mognowState.gameEndsAt;
        if (gameStarted && !gameEnded) {
            const senderKey = getCanonicalUserKey(sender) || sender;
            const isAttacker = mognowState.attackerKey && (senderKey === mognowState.attackerKey || getUserIdNumber(sender) === getUserIdNumber(mognowState.attackerKey));
            const isTarget = mognowState.targetKey && (senderKey === mognowState.targetKey || getUserIdNumber(sender) === getUserIdNumber(mognowState.targetKey));
            if (isAttacker) mognowState.countAttacker = (mognowState.countAttacker || 0) + 1;
            else if (isTarget) mognowState.countTarget = (mognowState.countTarget || 0) + 1;
        }
    }

    if (textMessage.toLowerCase().trim() === '!mog aceitar') {
        const list = auraSystem.getPendingMogList(chatId);
        const senderKey = getCanonicalUserKey(sender) || sender;
        const senderNum = getUserIdNumber(sender);
        const idx = list.findIndex(p => p.toKey === senderKey || getUserIdNumber(p.toKey) === senderNum || getUserIdNumber(p.toJid) === senderNum);
        if (idx === -1) {
            await sock.sendMessage(chatId, { text: '⚠️ Não há desafio de duelo para você aceitar aqui, ou só o usuário *marcado* no !mog pode aceitar.' }, { quoted: msg });
            return;
        }
        const pending = list[idx];
        auraSystem.clearPendingMogForChat(chatId);
        const endTime = Date.now() + MOG_DURATION_MS;
        activeMogDuel.set(chatId, {
            fromKey: pending.fromKey,
            toKey: pending.toKey,
            countFrom: 0,
            countTo: 0,
            endTime
        });
        await sock.sendMessage(chatId, {
            text: `⚔️ Duelo começando! Mandem mensagens por *15 segundos*. Quem tiver mais mensagens ganha!`
        });
        setTimeout(() => {
            const duel = activeMogDuel.get(chatId);
            if (duel) endMogDuel(sock, chatId, duel);
        }, MOG_DURATION_MS + 500);
        return;
    }

    if (textMessage.toLowerCase().startsWith('!mog ')) {
        const mentionedJid = getMentionedJid(msg);
        if (!mentionedJid) {
            await sock.sendMessage(chatId, { text: '⚠️ Use *!mog* marcando alguém: *!mog @usuario*' }, { quoted: msg });
            return;
        }
        const fromKey = getCanonicalUserKey(sender) || sender;
        const toKey = getCanonicalUserKey(mentionedJid) || mentionedJid;
        if (fromKey === toKey) {
            await sock.sendMessage(chatId, { text: '⚠️ Você não pode mogar a si mesmo.' }, { quoted: msg });
            return;
        }
        auraSystem.addPendingMog(chatId, { fromKey, toKey, toJid: mentionedJid });
        const mentionInfo = mentionsController.processSingleMention(getJidForMention(mentionedJid), contactsCache);
        await sock.sendMessage(chatId, {
            text: `⚔️ Desafio de duelo! ${mentionInfo.mentionText} pode aceitar respondendo *!mog aceitar*. Quem mandar mais mensagens em 15 segundos vence e ganha 500 de aura.`,
            mentions: mentionInfo.mentions
        }, { quoted: msg });
        return;
    }

    if (textMessage.toLowerCase().trim().startsWith('!mognow')) {
        const mentionedJid = getMentionedJid(msg);
        if (!mentionedJid) {
            await sock.sendMessage(chatId, { text: '⚠️ Use *!mognow* marcando alguém: *!mognow @usuario*' }, { quoted: msg });
            return;
        }
        if (mognowActive.has(chatId)) {
            await sock.sendMessage(chatId, { text: '⚠️ Já há um ataque em andamento neste chat.' }, { quoted: msg });
            return;
        }
        const attackerKey = getCanonicalUserKey(sender) || sender;
        const targetKey = getCanonicalUserKey(mentionedJid) || mentionedJid;
        if (attackerKey === targetKey || getUserIdNumber(sender) === getUserIdNumber(mentionedJid)) {
            await sock.sendMessage(chatId, { text: '⚠️ Você não pode atacar a si mesmo.' }, { quoted: msg });
            return;
        }
        const now = Date.now();
        const gameStartsAt = now + MOGNOW_COUNTDOWN_SEC * 1000;
        const gameEndsAt = gameStartsAt + MOGNOW_WINDOW_MS;
        for (let i = MOGNOW_COUNTDOWN_SEC; i >= 1; i--) {
            setTimeout(() => {
                sock.sendMessage(chatId, { text: `${i}` }).catch(() => {});
            }, (MOGNOW_COUNTDOWN_SEC - i) * 1000);
        }
        const mentionInfo = mentionsController.processSingleMention(getJidForMention(mentionedJid), contactsCache);
        setTimeout(() => {
            sock.sendMessage(chatId, {
                text: `💀 *MOGNOW!* ${mentionInfo.mentionText} — *15 segundos*: quem mandar *mais mensagens* vence. Alvo ganha 500 de aura (e missão) se vencer; atacante ganha 5 se vencer.`,
                mentions: mentionInfo.mentions
            }).catch(() => {});
        }, MOGNOW_COUNTDOWN_SEC * 1000);
        mognowActive.set(chatId, { attackerKey, targetKey, gameStartsAt, gameEndsAt, countAttacker: 0, countTarget: 0 });
        setTimeout(() => {
            const state = mognowActive.get(chatId);
            if (!state) return;
            mognowActive.delete(chatId);
            const countAttacker = state.countAttacker || 0;
            const countTarget = state.countTarget || 0;
            const attackerNum = getUserIdNumber(state.attackerKey);
            const targetNum = getUserIdNumber(state.targetKey);
            const attackerAuraKey = getAuraKey(state.attackerKey);
            const targetAuraKey = getAuraKey(state.targetKey);
            const attackerName = getLevelUserData(attackerNum)?.customNameEnabled && getLevelUserData(attackerNum)?.customName ? getLevelUserData(attackerNum).customName : (getLevelUserData(attackerNum)?.pushName || attackerNum);
            const targetName = getLevelUserData(targetNum)?.customNameEnabled && getLevelUserData(targetNum)?.customName ? getLevelUserData(targetNum).customName : (getLevelUserData(targetNum)?.pushName || targetNum);
            if (countTarget > countAttacker) {
                auraSystem.addAuraPoints(targetAuraKey, 500);
                const missionReward = auraSystem.hasMission(targetAuraKey, 'survive_attack') ? auraSystem.completeMission(targetAuraKey, 'survive_attack') : 0;
                const totalGain = 500 + missionReward;
                sock.sendMessage(chatId, {
                    text: `🛡️ *${targetName}* sobreviveu ao ataque! (${countTarget} x ${countAttacker} mensagens)\n✨ *+500* aura${missionReward ? ` + *${missionReward}* pela missão` : ''} = *${totalGain}* aura.`
                }).catch(() => {});
            } else if (countAttacker > countTarget) {
                if (attackerAuraKey) auraSystem.addAuraPoints(attackerAuraKey, 5);
                sock.sendMessage(chatId, {
                    text: `⏱ *${attackerName}* venceu o mognow! (${countAttacker} x ${countTarget} mensagens)\n✨ Atacante ganha *5* de aura.`
                }).catch(() => {});
            } else {
                sock.sendMessage(chatId, { text: `⏱ Empate! (${countAttacker} x ${countTarget}) Ninguém ganha aura.` }).catch(() => {});
            }
        }, MOGNOW_WINDOW_MS + MOGNOW_COUNTDOWN_SEC * 1000 + 500);
        return;
    }

    if (textMessage.toLowerCase().trim() === '!meditar') {
        const options = [0, 10, 20, 30, 40, 50];
        const gained = options[Math.floor(Math.random() * options.length)];
        auraSystem.addAuraPoints(senderAuraKey, gained);
        const total = auraSystem.getUserAura(senderAuraKey).auraPoints;
        await sock.sendMessage(chatId, {
            text: gained > 0 ? `🧘 Meditação concluída. Você absorveu *+${gained}* de aura. Total: *${total}*` : `🧘 Meditação concluída. Sua aura permanece estável. Total: *${total}*`
        }, { quoted: msg });
        return;
    }

    if (textMessage.toLowerCase().trim() === '!treinar') {
        const TREINAR_COOLDOWN_MS = 60 * 60 * 1000;
        const lastAt = auraSystem.getCooldown(senderAuraKey, 'lastTreinarAt');
        const now = Date.now();
        if (lastAt && now - lastAt < TREINAR_COOLDOWN_MS) {
            const secLeft = Math.ceil((TREINAR_COOLDOWN_MS - (now - lastAt)) / 1000);
            const minLeft = Math.ceil(secLeft / 60);
            const minText = minLeft === 1 ? '1 minuto' : `${minLeft} minutos`;
            await sock.sendMessage(chatId, { text: `⏳ Aguarde *${minText}* para treinar de novo.` }, { quoted: msg });
            return;
        }
        const win = Math.random() < 0.5;
        if (win) {
            auraSystem.addAuraPoints(senderAuraKey, 500);
            const total = auraSystem.getUserAura(senderAuraKey).auraPoints;
            await sock.sendMessage(chatId, { text: `💪 Treino intenso! *+500* de aura. Total: *${total}*` }, { quoted: msg });
        } else {
            auraSystem.addAuraPoints(senderAuraKey, -1000);
            const total = auraSystem.getUserAura(senderAuraKey).auraPoints;
            await sock.sendMessage(chatId, { text: `💔 O treino foi além do limite. *-1000* de aura. Total: *${total}*` }, { quoted: msg });
            await checkAuraNegativeAndPunish(sock, chatId, senderAuraKey, contactsCache);
        }
        auraSystem.setCooldown(senderAuraKey, 'lastTreinarAt', now);
        return;
    }

    if (textMessage.toLowerCase().trim() === '!dominar') {
        const DOMINAR_COOLDOWN_MS = 12 * 60 * 60 * 1000;
        const lastAt = auraSystem.getCooldown(senderAuraKey, 'lastDominarAt');
        const now = Date.now();
        if (lastAt && now - lastAt < DOMINAR_COOLDOWN_MS) {
            const hoursLeft = ((DOMINAR_COOLDOWN_MS - (now - lastAt)) / (60 * 60 * 1000)).toFixed(1);
            await sock.sendMessage(chatId, { text: `⏳ Dominação disponível em *${hoursLeft}h*.` }, { quoted: msg });
            return;
        }
        const won = Math.random() < 0.5;
        auraSystem.setCooldown(senderAuraKey, 'lastDominarAt', now);
        if (won) {
            auraSystem.addAuraPoints(senderAuraKey, 1000);
            const total = auraSystem.getUserAura(senderAuraKey).auraPoints;
            await sock.sendMessage(chatId, { text: `👑 Dominação absoluta! *+1000* de aura. Total: *${total}*` }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `😤 A dominação falhou. Nenhuma aura obtida.` }, { quoted: msg });
        }
        return;
    }

    if (textMessage.toLowerCase().trim() === '!ritual') {
        const today = auraSystem.getTodayDateString();
        const lastDate = auraSystem.getCooldown(senderAuraKey, 'lastRitualDate');
        if (lastDate === today) {
            await sock.sendMessage(chatId, { text: `⏳ O ritual só pode ser feito *uma vez por dia*. Volte amanhã.` }, { quoted: msg });
            return;
        }
        auraSystem.setCooldown(senderAuraKey, 'lastRitualDate', today);
        const ritualLines = [
            `💀🔥 *O ritual começa...* 🔥💀`,
            `💀 A aura emana energias sombrias... 💀`,
            `🔥 O fogo consome e renasce... 🔥`,
            `💀🔥 Ondas de poder cruzam o éter... 🔥💀`,
            `💀 O véu entre mundos se abre... 💀`,
            `🔥 Tudo ou nada. O destino decide. 🔥`,
            `💀🔥 *O ritual se completa.* 🔥💀`
        ];
        for (let i = 0; i < ritualLines.length; i++) {
            setTimeout(() => {
                sock.sendMessage(chatId, { text: ritualLines[i] }).catch(() => {});
            }, i * 1800);
        }
        const won = Math.random() < 0.5;
        const delayEnd = ritualLines.length * 1800 + 800;
        setTimeout(async () => {
            if (won) {
                auraSystem.addAuraPoints(senderAuraKey, 5000);
                const total = auraSystem.getUserAura(senderAuraKey).auraPoints;
                await sock.sendMessage(chatId, { text: `👑💀 *O ritual te abençoou.* +5000 de aura. Total: *${total}* 🔥` }).catch(() => {});
            } else {
                auraSystem.addAuraPoints(senderAuraKey, -5000);
                const total = auraSystem.getUserAura(senderAuraKey).auraPoints;
                await sock.sendMessage(chatId, { text: `💀🔥 *O ritual te consumiu.* -5000 de aura. Total: *${total}* 💀` }).catch(() => {});
                await checkAuraNegativeAndPunish(sock, chatId, senderAuraKey, contactsCache);
            }
        }, delayEnd);
        return;
    }

    if (textMessage.toLowerCase().startsWith('!respeito ')) {
        const mentionedJid = getMentionedJid(msg);
        if (!mentionedJid) {
            await sock.sendMessage(chatId, { text: '⚠️ Use *!respeito* marcando alguém: *!respeito @usuario*' }, { quoted: msg });
            return;
        }
        const targetAuraKey = getAuraKey(mentionedJid);
        if (!targetAuraKey || targetAuraKey === senderAuraKey) {
            await sock.sendMessage(chatId, { text: '⚠️ Você não pode dar respeito a si mesmo.' }, { quoted: msg });
            return;
        }
        auraSystem.getUserAura(targetAuraKey);
        const result = auraSystem.transferAura(senderAuraKey, targetAuraKey, 50);
        if (!result.ok) {
            await sock.sendMessage(chatId, { text: '❌ Você precisa de pelo menos *50* de aura para usar !respeito.' }, { quoted: msg });
            return;
        }
        await checkAuraNegativeAndPunish(sock, chatId, senderAuraKey, contactsCache);
        const hadHelpMission = auraSystem.hasMission(senderAuraKey, 'help_someone');
        if (hadHelpMission) auraSystem.completeMission(senderAuraKey, 'help_someone');
        await sock.sendMessage(chatId, {
            text: `🙏 Você transferiu *50* de aura como respeito.${hadHelpMission ? ` Missão "Ajude alguém" concluída: *+${MISSION_CONFIG.help_someone.reward}* aura.` : ''}`
        }, { quoted: msg });
        return;
    }

    if (textMessage.toLowerCase().startsWith('!elogiar ')) {
        const mentionedJid = getMentionedJid(msg);
        if (!mentionedJid) {
            await sock.sendMessage(chatId, { text: '⚠️ Use *!elogiar* marcando alguém: *!elogiar @usuario*' }, { quoted: msg });
            return;
        }
        const targetAuraKey = getAuraKey(mentionedJid);
        if (!targetAuraKey || targetAuraKey === senderAuraKey) {
            await sock.sendMessage(chatId, { text: '⚠️ Você não pode elogiar a si mesmo.' }, { quoted: msg });
            return;
        }
        auraSystem.getUserAura(targetAuraKey);
        auraSystem.addAuraPoints(targetAuraKey, 100);
        addPraise(senderAuraKey, targetAuraKey);
        const senderMention = mentionsController.processSingleMention(getJidForMention(sender), contactsCache);
        const targetMention = mentionsController.processSingleMention(getJidForMention(mentionedJid), contactsCache);
        const mentions = [...(senderMention.mentions || []), ...(targetMention.mentions || [])];
        await sock.sendMessage(chatId, {
            text: `🌟 ${senderMention.mentionText} elogiou ${targetMention.mentionText}! ${targetMention.mentionText} ganhou *+100* de aura.`,
            mentions: mentions.length ? mentions : undefined
        }, { quoted: msg });
        return;
    }

    if (textMessage.toLowerCase().startsWith('!provocar ')) {
        const mentionedJid = getMentionedJid(msg);
        if (!mentionedJid) {
            await sock.sendMessage(chatId, { text: '⚠️ Use *!provocar* marcando alguém: *!provocar @usuario*' }, { quoted: msg });
            return;
        }
        if (getCanonicalUserKey(sender) === getCanonicalUserKey(mentionedJid) || getUserIdNumber(sender) === getUserIdNumber(mentionedJid)) {
            await sock.sendMessage(chatId, { text: '⚠️ Você não pode provocar a si mesmo.' }, { quoted: msg });
            return;
        }
        const senderMention = mentionsController.processSingleMention(getJidForMention(sender), contactsCache);
        const targetMention = mentionsController.processSingleMention(getJidForMention(mentionedJid), contactsCache);
        const mentions = [...(senderMention.mentions || []), ...(targetMention.mentions || [])];
        await sock.sendMessage(chatId, {
            text: `${senderMention.mentionText} está te provocando ${targetMention.mentionText}, não quer tentar farmar aura rsrs? 🔥💀🔥💀`,
            mentions: mentions.length ? mentions : undefined
        }, { quoted: msg });
        return;
    }

    if (textMessage.toLowerCase().trim() === '!elogiados me' || textMessage.toLowerCase().trim().startsWith('!elogiados me ')) {
        const list = getWhoPraised(senderAuraKey);
        const uniqueJids = [...new Set(list)];
        if (uniqueJids.length === 0) {
            await sock.sendMessage(chatId, { text: '📋 Ninguém te elogiou ainda. Use *!elogiar @alguém* para elogiar e dar +100 de aura!' }, { quoted: msg });
            return;
        }
        const jids = uniqueJids.map(k => (k.includes('@') ? k : getJidFromNumber(k)));
        const parts = [];
        const allMentions = [];
        for (const jid of jids) {
            const info = mentionsController.processSingleMention(getJidForMention(jid), contactsCache);
            parts.push(info.mentionText);
            if (info.mentions && info.mentions.length) allMentions.push(...info.mentions);
        }
        await sock.sendMessage(chatId, {
            text: `📋 Quem te elogiou: ${parts.join(', ')}`,
            mentions: allMentions.length ? allMentions : undefined
        }, { quoted: msg });
        return;
    }
    if (textMessage.toLowerCase().startsWith('!elogiados ')) {
        const mentionedJid = getMentionedJid(msg);
        if (!mentionedJid) {
            await sock.sendMessage(chatId, { text: '⚠️ Use *!elogiados me* ou *!elogiados @usuario* para ver quem elogiou.' }, { quoted: msg });
            return;
        }
        const targetAuraKey = getAuraKey(mentionedJid);
        const list = getWhoPraised(targetAuraKey);
        const uniqueJids = [...new Set(list)];
        const targetMention = mentionsController.processSingleMention(getJidForMention(mentionedJid), contactsCache);
        if (uniqueJids.length === 0) {
            await sock.sendMessage(chatId, {
                text: `📋 Ninguém elogiou ${targetMention.mentionText} ainda.`,
                mentions: targetMention.mentions
            }, { quoted: msg });
            return;
        }
        const jids = uniqueJids.map(k => (k.includes('@') ? k : getJidFromNumber(k)));
        const parts = [];
        const allMentions = [...(targetMention.mentions || [])];
        for (const jid of jids) {
            const info = mentionsController.processSingleMention(getJidForMention(jid), contactsCache);
            parts.push(info.mentionText);
            if (info.mentions && info.mentions.length) allMentions.push(...info.mentions);
        }
        await sock.sendMessage(chatId, {
            text: `📋 Quem elogiou ${targetMention.mentionText}: ${parts.join(', ')}`,
            mentions: allMentions.length ? allMentions : undefined
        }, { quoted: msg });
        return;
    }

    if (textMessage.toLowerCase().startsWith('!aura farmar ')) {
        const mentionedJid = getMentionedJid(msg);
        if (!mentionedJid) {
            await sock.sendMessage(chatId, { text: '⚠️ Use *!aura farmar* marcando alguém: *!aura farmar @usuario*' }, { quoted: msg });
            return;
        }
        const targetAuraKey = getAuraKey(mentionedJid);
        if (!targetAuraKey || targetAuraKey === senderAuraKey) {
            await sock.sendMessage(chatId, { text: '⚠️ Você não pode farmar aura de si mesmo.' }, { quoted: msg });
            return;
        }
        auraSystem.getUserAura(targetAuraKey);
        const success = Math.random() < 0.5;
        if (success) {
            auraSystem.addAuraPoints(targetAuraKey, -100);
            auraSystem.addAuraPoints(senderAuraKey, 100);
            const targetMention = mentionsController.processSingleMention(getJidForMention(mentionedJid), contactsCache);
            await sock.sendMessage(chatId, {
                text: `🩸 Você farmou *100* de aura de ${targetMention.mentionText}. Você ganhou *+100* de aura.`,
                mentions: targetMention.mentions
            }, { quoted: msg });
            await checkAuraNegativeAndPunish(sock, chatId, targetAuraKey, contactsCache);
        } else {
            auraSystem.addAuraPoints(senderAuraKey, -200);
            const total = auraSystem.getUserAura(senderAuraKey).auraPoints;
            await sock.sendMessage(chatId, { text: `💔 Falhou! Você perdeu *200* de aura. Total: *${total}*` }, { quoted: msg });
            await checkAuraNegativeAndPunish(sock, chatId, senderAuraKey, contactsCache);
        }
        return;
    }

    const duel = activeMogDuel.get(chatId);
    if (duel && Date.now() < duel.endTime) {
        const senderKey = getCanonicalUserKey(sender) || sender;
        const senderNum = getUserIdNumber(sender);
        const fromNum = getUserIdNumber(duel.fromKey);
        const toNum = getUserIdNumber(duel.toKey);
        if (senderKey === duel.fromKey || (senderNum && senderNum === fromNum)) duel.countFrom = (duel.countFrom || 0) + 1;
        else if (senderKey === duel.toKey || (senderNum && senderNum === toNum)) duel.countTo = (duel.countTo || 0) + 1;
    }

    if (auraSystem.hasMission(senderAuraKey, 'messages_500')) {
        const result = auraSystem.incrementProgress(senderAuraKey, 'messages_500', 1);
        if (result) {
            await sock.sendMessage(chatId, { text: `📬 Missão "Mande 500 mensagens" concluída! *+${result.reward}* aura.` }, { quoted: msg });
        }
    }

    if (auraSystem.isMediaMessage(msg) && auraSystem.hasMission(senderAuraKey, 'send_media')) {
        const result = auraSystem.incrementProgress(senderAuraKey, 'send_media', 1);
        if (result) {
            await sock.sendMessage(chatId, { text: `📎 Missão "Envie mídia" concluída! *+${result.reward}* aura.` }, { quoted: msg });
        }
    }

    if (messageType === 'reactionMessage') {
        const reactionText = msg.message.reactionMessage?.text || '';
        if (reactionText === '💀' || reactionText === '☠️') {
            if (auraSystem.hasMission(senderAuraKey, 'reactions_500')) {
                const result = auraSystem.incrementProgress(senderAuraKey, 'reactions_500', 1);
                if (result) {
                    await sock.sendMessage(chatId, { text: `💀 Missão "Reaja 500x com 💀 ou ☠️" concluída! *+${result.reward}* aura.` }, { quoted: msg });
                }
            }
        }
        return;
    }

    if (textMessage.toLowerCase().startsWith('!aura figurinha')) {
        const stickerMsg = auraSystem.getStickerFromMessage(msg);
        if (!stickerMsg) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Envie *!aura figurinha* junto com uma figurinha ou respondendo a uma figurinha.'
            }, { quoted: msg });
            return;
        }
        const hash = auraSystem.getStickerHashFromMessage(msg);
        if (!hash) {
            await sock.sendMessage(chatId, { text: '❌ Não foi possível obter o hash desta figurinha.' }, { quoted: msg });
            return;
        }
        auraSystem.setStickerHash(senderAuraKey, hash);
        await sock.sendMessage(chatId, { text: '✅ Figurinha de aura definida! Use essa figurinha para ter chance de ganhar +100 de aura.' }, { quoted: msg });
        return;
    }

    if (textMessage.toLowerCase().startsWith('!aura personagem')) {
        const match = textMessage.match(/!aura\s+personagem\s+"([^"]+)"/i) || textMessage.match(/!aura\s+personagem\s+(.+)/i);
        const character = match ? (match[1] || '').trim() : '';
        if (!character) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Uso: *!aura personagem "nome do personagem"*'
            }, { quoted: msg });
            return;
        }
        auraSystem.setCharacter(senderAuraKey, character);
        await sock.sendMessage(chatId, { text: `✅ Personagem definido: *${character}*` }, { quoted: msg });
        return;
    }

    const trimmedAura = textMessage.trim();
    if (/^!aura missoes\s*$/i.test(trimmedAura) || /^!aura missões\s*$/i.test(trimmedAura)) {
        const user = auraSystem.getUserAura(senderAuraKey);
        const drawn = user.dailyMissions?.drawnMissions || [];
        const completed = user.dailyMissions?.completedMissionIds || [];
        const progress = user.dailyMissions?.progress || {};
        let text = `📋 *Suas missões de hoje* (${completed.length}/3 concluídas)\n`;
        text += `_Reset às 00:00_\n\n`;
        drawn.forEach(id => {
            const cfg = MISSION_CONFIG[id];
            const key = id === 'messages_500' ? 'messages' : id === 'reactions_500' ? 'reactions' : id === 'duel_win' ? 'duelWin' : id === 'survive_attack' ? 'surviveAttack' : id === 'send_media' ? 'media' : 'helpSomeone';
            const val = progress[key] ?? 0;
            const done = completed.includes(id);
            const target = cfg?.target ?? 1;
            const reward = cfg?.reward ?? 0;
            text += `${done ? '✅' : '⬜'} *${cfg?.label || id}*\n`;
            text += `   ${done ? 'Concluída' : `${val}/${target}`} → *+${reward}* aura\n\n`;
        });
        await sock.sendMessage(chatId, { text }, { quoted: msg });
        return;
    }

    if (/^!aura\s+ranking\s*$/i.test(textMessage.trim()) || /^!aura\s+rank\s*$/i.test(textMessage.trim())) {
        const ranking = auraSystem.getAuraRanking(10);
        if (ranking.length === 0) {
            await sock.sendMessage(chatId, { text: '📈 Ninguém no ranking de aura ainda. Jogue para acumular pontos!' }, { quoted: msg });
            return;
        }
        const mentionTexts = [];
        const mentions = [];
        for (let i = 0; i < ranking.length; i++) {
            const r = ranking[i];
            const mentionInfo = mentionsController.processSingleMention(getJidForMention(r.userId), contactsCache);
            mentionTexts.push(mentionInfo.mentionText);
            if (mentionInfo.mentions && mentionInfo.mentions.length) mentions.push(...mentionInfo.mentions);
        }
        let text = `📈 *Ranking de Aura — Quem tem mais aura* 📈\n`;
        text += `_Posição · Nome · Categoria (nível) · Pontos_\n\n`;
        for (let i = 0; i < ranking.length; i++) {
            const r = ranking[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            text += `${medal} ${mentionTexts[i]}\n`;
            text += `   📊 Categoria: *${r.tierName}*  │  💫 *${r.auraPoints}* aura\n\n`;
        }
        text += `—— *Categorias (níveis)* ——\n`;
        text += `0 = NPC · 500 = Presença · 2.000 = Dominante · 5.000 = Sigma · 10.000 = Entidade · 50.000 = Deus do chat`;
        await sock.sendMessage(chatId, { text, mentions: mentions.length ? mentions : undefined }, { quoted: msg });
        return;
    }

    if (textMessage.toLowerCase().trim().startsWith('!aura info')) {
        const trimmed = textMessage.trim();
        const isMe = /^!aura\s+info\s+me\s*$/i.test(trimmed);
        const mentionedJid = getMentionedJid(msg);
        if (!isMe && !mentionedJid) {
            await sock.sendMessage(chatId, { text: '⚠️ Use *!aura info me* para suas informações ou *!aura info @usuario* para ver de alguém.' }, { quoted: msg });
            return;
        }
        const targetKey = isMe ? senderAuraKey : getAuraKey(mentionedJid);
        const targetNumber = isMe ? number : getUserIdNumber(targetKey);
        const user = auraSystem.getUserAura(targetKey);
        if (!user) {
            await sock.sendMessage(chatId, { text: '❌ Não foi possível carregar as informações de aura.' }, { quoted: msg });
            return;
        }
        const levelUser = getLevelUserData(targetNumber);
        const displayName = levelUser?.customNameEnabled && levelUser?.customName ? levelUser.customName : (levelUser?.pushName || targetKey.split('@')[0]);
        const tier = getAuraTier(user.auraPoints);
        const titleLine = formatNameWithTitle(displayName, user.auraPoints, isGroup);
        const drawn = user.dailyMissions?.drawnMissions || [];
        const completed = user.dailyMissions?.completedMissionIds || [];
        let text = `✨ *${titleLine}*\n\n`;
        text += `💫 Aura: *${user.auraPoints}*  │  📈 Nível: *${tier.name}*\n`;
        text += user.character ? `🎭 Personagem: *${user.character}*\n` : '';
        text += user.stickerHash ? '🖼 Figurinha de aura: definida\n' : '🖼 Figurinha de aura: não definida\n';
        text += `\n📋 Missões de hoje (${completed.length}/3) – reset 00:00\n`;
        drawn.forEach(id => {
            const cfg = MISSION_CONFIG[id];
            const progress = user.dailyMissions?.progress;
            const key = id === 'messages_500' ? 'messages' : id === 'reactions_500' ? 'reactions' : id === 'duel_win' ? 'duelWin' : id === 'survive_attack' ? 'surviveAttack' : id === 'send_media' ? 'media' : 'helpSomeone';
            const val = progress?.[key] ?? 0;
            const done = completed.includes(id);
            text += `${done ? '✅' : '⬜'} ${cfg?.label || id}: ${done ? 'concluída' : `${val}/${cfg?.target ?? 1}`}\n`;
        });
        const mentionInfo = targetKey !== senderAuraKey ? mentionsController.processSingleMention(getJidForMention(targetKey), contactsCache) : null;
        await sock.sendMessage(chatId, {
            text,
            mentions: mentionInfo && mentionInfo.mentions?.length ? mentionInfo.mentions : undefined
        }, { quoted: msg });
        return;
    }

    const lowerAura = textMessage.toLowerCase();
    if (lowerAura === '!aura' || (lowerAura.startsWith('!aura ') && !lowerAura.includes('figurinha') && !lowerAura.includes('personagem') && !lowerAura.includes('missoes') && !lowerAura.includes('missões') && !lowerAura.includes('farmar') && !lowerAura.includes('ranking') && !lowerAura.includes('rank') && !lowerAura.includes('info'))) {
        const eventCommands = [...new Set(RANDOM_EVENTS.map(e => e.command))].sort().join(', ');
        let text = `✨ *SISTEMA DE AURA — GUIA COMPLETO* ✨\n\n`;
        text += `📌 *O que é:* Aura é a moeda/status do bot. Você ganha ou perde aura com comandos, missões e eventos. Seu *nível* (NPC, Presença, Dominante, Sigma, Entidade, Deus do chat) depende dos pontos.\n\n`;
        text += `📈 *Níveis (títulos):*\n`;
        text += `0 = NPC · 500 = Presença · 2.000 = Dominante · 5.000 = Sigma · 10.000 = Entidade · 50.000 = Deus do chat\n\n`;
        text += `—— *COMANDOS DE AÇÃO* ——\n`;
        text += `• *!meditar* — Chance de ganhar 0, 10, 20, 30, 40 ou 50 aura (sem cooldown)\n`;
        text += `• *!treinar* — 50% +500 aura, 50% -1000 aura. Cooldown: 1 hora\n`;
        text += `• *!dominar* — 50% +1000 aura, 50% nada. Cooldown: 12 horas\n`;
        text += `• *!ritual* — 50% +5000 ou 50% -5000 aura. Uma vez por dia\n`;
        text += `• *!respeito @usuario* — Transfere 50 de sua aura para a pessoa (precisa de 50+ aura)\n`;
        text += `• *!elogiar @usuario* — Dá +100 aura ao elogiado (sem tirar de você)\n`;
        text += `• *!provocar @usuario* — Mensagem de provocação\n`;
        text += `• *!elogiados me* — Lista quem te elogiou\n`;
        text += `• *!elogiados @usuario* — Lista quem elogiou a pessoa\n\n`;
        text += `—— *DUELOS E ATAQUES* ——\n`;
        text += `• *!mog @usuario* — Desafia para duelo. O desafiado usa *!mog aceitar*. Em 15s quem mandar mais mensagens vence e ganha 500 aura\n`;
        text += `• *!mognow @usuario* — Ataca alguém. Em 15s: se o alvo mandar mais mensagens, ganha 500 aura; se o atacante ganhar, recebe 5 aura\n`;
        text += `• *!aura farmar @usuario* — 50% você tira 100 do alvo e ganha 100; 50% você perde 200 aura\n\n`;
        text += `—— *COMANDOS !aura* ——\n`;
        text += `• *!aura* — Este guia (tudo sobre aura)\n`;
        text += `• *!aura info me* — Suas informações (aura, nível, personagem, missões)\n`;
        text += `• *!aura info @usuario* — Informações de aura de outra pessoa\n`;
        text += `• *!aura figurinha* — Definir figurinha de aura (com figurinha anexada). Usar essa figurinha dá 50% de +100 aura\n`;
        text += `• *!aura personagem "nome"* — Definir seu personagem\n`;
        text += `• *!aura missoes* — Ver suas 3 missões do dia (reset 00:00)\n`;
        text += `• *!aura ranking* — Top 10 global por aura\n\n`;
        text += `—— *EVENTOS ALEATÓRIOS* ——\n`;
        text += `O bot *dropa eventos* do nada no grupo. Quando aparecer uma mensagem de evento, digite o *comando indicado* no tempo limite para ganhar (ou às vezes perder) aura.\n`;
        text += `Comandos que podem aparecer nos eventos: ${eventCommands}\n`;
        text += `Alguns eventos: primeiro a digitar ganha; outros: todos que digitarem no tempo ganham. Alguns dão aura negativa — cuidado!\n\n`;
        text += `—— *MISSÕES DIÁRIAS* ——\n`;
        text += `Todo dia você recebe 3 missões entre: Mande 500 mensagens, Reaja 500x com 💀/☠️, Vença 1 duelo (!mog), Sobreviva a um ataque (!mognow), Envie mídia, Ajude alguém (!respeito). Concluir dá bônus de aura. Reset às 00:00.\n\n`;
        text += `_Use *!aura info me* para ver seu perfil completo._`;
        await sock.sendMessage(chatId, { text }, { quoted: msg });
        return;
    }

    if (messageType === 'stickerMessage') {
        const hash = auraSystem.getStickerHashFromMessage(msg);
        if (hash) {
            const user = auraSystem.getUserAura(senderAuraKey);
            if (user.stickerHash && user.stickerHash === hash && Math.random() < 0.5) {
                const newTotal = auraSystem.addAuraPoints(senderAuraKey, 100);
                await sock.sendMessage(chatId, { text: `✨ +100 de aura! Total: *${newTotal}*` }, { quoted: msg });
            }
        }
        return;
    }
}

module.exports = auraCommandBot;
module.exports.auraSystem = auraSystem;
module.exports.getUserIdNumber = getUserIdNumber;
module.exports.getLevelUserData = getLevelUserData;
module.exports.getJidFromNumber = getJidFromNumber;
module.exports.getAuraKey = getAuraKey;
module.exports.getWhoPraised = getWhoPraised;
module.exports.MISSION_IDS = MISSION_IDS;
module.exports.MISSION_CONFIG = MISSION_CONFIG;
module.exports.AURA_TIERS = AURA_TIERS;
module.exports.RANDOM_EVENTS = RANDOM_EVENTS;
module.exports.EVENT_SPAWN_CHANCE = EVENT_SPAWN_CHANCE;
module.exports.EVENT_COOLDOWN_MS = EVENT_COOLDOWN_MS;
module.exports.EVENT_CHANCE_MAX = EVENT_CHANCE_MAX;
module.exports.MOG_DURATION_MS = MOG_DURATION_MS;
module.exports.MOGNOW_COUNTDOWN_SEC = MOGNOW_COUNTDOWN_SEC;
module.exports.MOGNOW_WINDOW_MS = MOGNOW_WINDOW_MS;
module.exports.getAuraTier = getAuraTier;
module.exports.formatNameWithTitle = formatNameWithTitle;
