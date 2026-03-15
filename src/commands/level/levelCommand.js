const path = require('path');
const https = require('https');
const http = require('http');
const { admins } = require('../../config/adm');
const mentionsController = require('../../controllers/mentionsController');
const repo = require('../../database/repository');

async function downloadImageAsBase64(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return downloadImageAsBase64(response.headers.location).then(resolve).catch(reject);
            }
            
            if (response.statusCode !== 200) {
                return reject(new Error(`Erro ao baixar imagem: ${response.statusCode}`));
            }
            
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const base64 = buffer.toString('base64');
                const contentType = response.headers['content-type'] || 'image/jpeg';
                const dataUrl = `data:${contentType};base64,${base64}`;
                resolve(dataUrl);
            });
            response.on('error', reject);
        }).on('error', reject);
    });
}

async function updateUserProfilePicture(sock, userId, usersData, levelSystem) {
    try {
        const user = usersData[userId];
        if (!user) return false;
        
        const now = new Date();
        const lastUpdate = user.profilePictureUpdatedAt ? new Date(user.profilePictureUpdatedAt) : null;
        const hoursSinceUpdate = lastUpdate ? (now - lastUpdate) / (1000 * 60 * 60) : Infinity;
        
        if (user.profilePicture && hoursSinceUpdate < 24) {
            return false;
        }
        
        const profilePictureUrl = await sock.profilePictureUrl(userId, 'image').catch(() => null);
        
        if (!profilePictureUrl) {
            if (user.profilePicture !== null) {
                user.profilePicture = null;
                user.profilePictureUpdatedAt = now.toISOString();
                await levelSystem.writeUsersData(usersData);
            }
            return false;
        }
        
        const base64Image = await downloadImageAsBase64(profilePictureUrl);
        
        user.profilePicture = base64Image;
        user.profilePictureUpdatedAt = now.toISOString();
        await levelSystem.writeUsersData(usersData);
        
        console.log(`[DEBUG] Foto de perfil atualizada para ${userId}`);
        return true;
    } catch (error) {
        console.log(`[DEBUG] Não foi possível obter foto de perfil de ${userId}:`, error.message);
        return false;
    }
}

const RANKS = [
    { name: "🥉 Bronze", minLevel: 1, maxLevel: 5, color: "#CD7F32" },
    { name: "🥈 Prata", minLevel: 6, maxLevel: 10, color: "#C0C0C0" },
    { name: "🥇 Ouro", minLevel: 11, maxLevel: 20, color: "#FFD700" },
    { name: "💎 Diamante", minLevel: 21, maxLevel: 35, color: "#B9F2FF" },
    { name: "👑 Mestre", minLevel: 36, maxLevel: 50, color: "#8A2BE2" },
    { name: "🔥 Lendário", minLevel: 51, maxLevel: 70, color: "#FF4500" },
    { name: "⚡ Épico", minLevel: 71, maxLevel: 100, color: "#9932CC" },
    { name: "🌟 Mítico", minLevel: 101, maxLevel: 150, color: "#FF69B4" },
    { name: "💫 Celestial", minLevel: 151, maxLevel: 200, color: "#00CED1" },
    { name: "👽 Transcendente", minLevel: 201, maxLevel: 999, color: "#FF1493" }
];

// Cache em memória + IDs processados (evita perda de mensagens e duplicatas)
const levelCache = { users: null, dailyBonus: null };
const processedMessageIds = new Set();
const MAX_PROCESSED_IDS = 100000;
const lastLevelUpSent = new Map();

function getMessageId(msg) {
    const id = msg?.key?.id;
    if (id) return id;
    const jid = msg?.key?.remoteJid || '';
    const ts = msg?.messageTimestamp || Date.now();
    const participant = msg?.key?.participant || msg?.key?.participantAlt || '';
    return `${jid}_${participant}_${ts}`;
}

class LevelSystem {
    constructor() {}

    async getOrLoadCache() {
        if (!levelCache.users) {
            levelCache.users = await this.readUsersData();
        }
        return levelCache.users;
    }

    async flushCache() {
        if (levelCache.users && Object.keys(levelCache.users).length > 0) {
            try {
                await this.writeUsersData(levelCache.users);
            } catch (err) {
                console.error('[LEVEL] Erro ao flush do cache para DB:', err.message);
                throw err;
            }
        }
    }

    invalidateCache() {
        levelCache.users = null;
    }

    async readUsersData() {
        try {
            return await repo.getAllUsers();
        } catch (error) {
            console.error('Erro ao ler dados dos usuários:', error);
            return {};
        }
    }

    async writeUsersData(data) {
        try {
            await repo.saveAllUsers(data);
            levelCache.users = data;
        } catch (error) {
            console.error('Erro ao salvar dados dos usuários:', error);
            throw error;
        }
    }

    async readDailyBonus() {
        try {
            const db = await repo.getDailyBonus();
            return { lastBonusDate: db.lastBonusDate, lastBonusUser: db.lastBonusUser };
        } catch (error) {
            console.error('Erro ao ler bônus diário:', error);
            return { lastBonusDate: null, lastBonusUser: null };
        }
    }

    async writeDailyBonus(data) {
        try {
            await repo.setDailyBonus(data.lastBonusDate, data.lastBonusUser);
        } catch (error) {
            console.error('Erro ao salvar bônus diário:', error);
            throw error;
        }
    }

    initUser(usersData, userId, pushName = null) {
        if (!usersData[userId]) {
            usersData[userId] = {
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
                pushName: pushName || null,
                customName: null,
                customNameEnabled: false,
                jid: userId,
                profilePicture: null,
                profilePictureUpdatedAt: null
            };
        } else {
            if (usersData[userId].allowMentions === undefined) {
                usersData[userId].allowMentions = false;
            }
            if (usersData[userId].customName === undefined) {
                usersData[userId].customName = null;
            }
            if (usersData[userId].customNameEnabled === undefined) {
                usersData[userId].customNameEnabled = false;
            }
            if (usersData[userId].jid === undefined) {
                usersData[userId].jid = userId;
            }
            if (usersData[userId].profilePicture === undefined) {
                usersData[userId].profilePicture = null;
            }
            if (usersData[userId].profilePictureUpdatedAt === undefined) {
                usersData[userId].profilePictureUpdatedAt = null;
            }
            if (pushName && (!usersData[userId].pushName || usersData[userId].pushName !== pushName)) {
                usersData[userId].pushName = pushName;
            }
        }
    }

    findUserKey(usersData, jid) {
        if (usersData[jid]) {
            return jid;
        }
        const isUserKey = (k) => typeof k === 'string' && k.includes('@');
        for (const [savedJid, userData] of Object.entries(usersData)) {
            if (!isUserKey(savedJid)) continue;
            if (userData.jid === jid) {
                return savedJid;
            }
        }
        
        const phoneNumber = jid.split('@')[0].split(':')[0];
        const possibleJid = `${phoneNumber}@s.whatsapp.net`;
        if (usersData[possibleJid]) {
            return possibleJid;
        }
        
        return null;
    }

    getRequiredXP(level) {
        if (level < 10) {
            return 100 + (level - 1) * 10;
        } else {
            return 100 + (9 * 10) + (level - 10) * 100;
        }
    }

    calculateLevel(xp) {
        let level = 1;
        let totalXP = 0;
        
        while (true) {
            const requiredXP = this.getRequiredXP(level);
            if (totalXP + requiredXP > xp) break;
            totalXP += requiredXP;
            level++;
        }
        
        return level;
    }

    async addXP(userId, xpAmount, isDailyBonus = false, pushName = null) {
        console.log(`[DEBUG] addXP chamado para ${userId} com ${xpAmount} XP, bônus: ${isDailyBonus}`);
        
        let usersData = await this.readUsersData();
        this.initUser(usersData, userId, pushName);
        const user = usersData[userId];
        
        if (user.dailyBonusExpiry && new Date(user.dailyBonusExpiry) < new Date()) {
            console.log(`[DEBUG] Bônus diário expirou, removendo multiplicador`);
            user.dailyBonusMultiplier = 0;
            user.dailyBonusExpiry = null;
            await this.writeUsersData(usersData);
            usersData = await this.readUsersData();
        }
        
        const prestigeMultiplier = 1 + (user.prestige * 0.5);
        const dailyBonusMultiplier = user.dailyBonusMultiplier || 0;
        const totalMultiplier = prestigeMultiplier + dailyBonusMultiplier;
        const finalXP = Math.floor(xpAmount * totalMultiplier);
        
        console.log(`[DEBUG] XP base: ${xpAmount}, multiplicador prestígio: ${prestigeMultiplier}, multiplicador bônus: ${dailyBonusMultiplier}, total: ${totalMultiplier}, final: ${finalXP}`);
        
        user.xp += finalXP;
        user.totalMessages++;
        user.lastMessageTime = new Date().toISOString();
        
        const oldLevel = user.level;
        const newLevel = this.calculateLevel(user.xp);
        user.level = newLevel;
        
        if (newLevel > oldLevel) {
            this.updatePrestigeAvailable(usersData, userId);
        }
        
        console.log(`[DEBUG] Usuário ${userId}: ${oldLevel} -> ${newLevel}, XP: ${user.xp}`);
        
        await this.writeUsersData(usersData);
        
        return {
            oldLevel,
            newLevel,
            xpGained: finalXP,
            isLevelUp: newLevel > oldLevel,
            isDailyBonus,
            totalMultiplier,
            dailyBonusMultiplier
        };
    }

    /** Adiciona XP ao cache em memória (não escreve no DB). Usado para processar batch de mensagens. */
    async addXPToCache(userId, xpAmount, isDailyBonus = false, pushName = null) {
        const usersData = await this.getOrLoadCache();
        this.initUser(usersData, userId, pushName);
        const user = usersData[userId];

        if (user.dailyBonusExpiry && new Date(user.dailyBonusExpiry) < new Date()) {
            user.dailyBonusMultiplier = 0;
            user.dailyBonusExpiry = null;
        }

        const prestigeMultiplier = 1 + (user.prestige * 0.5);
        const dailyBonusMultiplier = user.dailyBonusMultiplier || 0;
        const totalMultiplier = prestigeMultiplier + dailyBonusMultiplier;
        const finalXP = Math.floor(xpAmount * totalMultiplier);

        user.xp += finalXP;
        user.totalMessages++;
        user.lastMessageTime = new Date().toISOString();

        const oldLevel = user.level;
        const newLevel = this.calculateLevel(user.xp);
        user.level = newLevel;

        if (newLevel > oldLevel) {
            this.updatePrestigeAvailable(usersData, userId);
        }

        return {
            oldLevel,
            newLevel,
            xpGained: finalXP,
            isLevelUp: newLevel > oldLevel,
            isDailyBonus,
            totalMultiplier,
            dailyBonusMultiplier
        };
    }

    async checkDailyBonus(userId, pushName = null, useCache = false) {
        let usersData = useCache ? await this.getOrLoadCache() : await this.readUsersData();
        this.initUser(usersData, userId, pushName);
        let user = usersData[userId];
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const currentHour = now.getHours();
        
        let dailyBonus = await this.readDailyBonus();
        const lastDateStr = dailyBonus.lastBonusDate
            ? (typeof dailyBonus.lastBonusDate === 'string'
                ? dailyBonus.lastBonusDate.slice(0, 10)
                : new Date(dailyBonus.lastBonusDate).toISOString().slice(0, 10))
            : null;
        
        console.log(`[DEBUG] Verificando bônus diário para ${userId}`);
        console.log(`[DEBUG] Hora atual: ${currentHour}, Data: ${today}`);
        console.log(`[DEBUG] Último bônus: ${lastDateStr}, Usuário: ${dailyBonus.lastBonusUser}`);
        
        if (user.dailyBonusExpiry && new Date(user.dailyBonusExpiry) < now) {
            console.log(`[DEBUG] Bônus anterior expirou, removendo multiplicador`);
            user.dailyBonusMultiplier = 0;
            user.dailyBonusExpiry = null;
            if (!useCache) {
                await this.writeUsersData(usersData);
                usersData = await this.readUsersData();
                user = usersData[userId];
            }
        }
        
        if (currentHour < 6) {
            console.log(`[DEBUG] Muito cedo para bônus (${currentHour}h)`);
            return false;
        }
        
        if (lastDateStr === today) {
            console.log(`[DEBUG] Bônus já foi dado hoje`);
            return false;
        }
        
        console.log(`[DEBUG] Aplicando bônus diário de multiplicador para ${userId}`);
        dailyBonus.lastBonusDate = today;
        dailyBonus.lastBonusUser = userId;
        
        user.dailyBonusMultiplier = 1.0;
        user.dailyBonusExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        
        await this.writeDailyBonus(dailyBonus);
        if (!useCache) await this.writeUsersData(usersData);
        
        return true;
    }

    async canPrestige(userId) {
        const usersData = await this.readUsersData();
        this.initUser(usersData, userId);
        const user = usersData[userId];
        
        this.updatePrestigeAvailable(usersData, userId);
        
        return user.level >= 10 && user.prestigeAvailable > 0;
    }

    async prestige(userId) {
        let usersData = await this.readUsersData();
        this.initUser(usersData, userId);
        const user = usersData[userId];
        
        this.updatePrestigeAvailable(usersData, userId);
        
        if (!(await this.canPrestige(userId))) {
            if (user.level < 10) {
                return { success: false, message: "Você precisa estar no nível 10 ou superior para fazer prestígio!" };
            } else if (user.prestigeAvailable <= 0) {
                return { success: false, message: `Você não tem prestígios disponíveis! Você tem ${user.prestige} prestígios usados e pode ter até ${this.calculateAvailablePrestiges(user.level)} prestígios no nível ${user.level}.` };
            }
        }
        
        const prestigeBadge = `🏆 Prestígio ${user.prestige + 1}`;
        if (!user.badges.includes(prestigeBadge)) {
            user.badges.push(prestigeBadge);
        }
        
        const oldPrestige = user.prestige;
        user.prestige++;
        user.prestigeAvailable--;
        
        await this.writeUsersData(usersData);
        
        return {
            success: true,
            message: `🎉 Prestígio realizado! Você agora é Prestígio ${user.prestige}! Badge adicionado!\n💎 Prestígios restantes: ${user.prestigeAvailable}`,
            newPrestige: user.prestige,
            oldPrestige: oldPrestige,
            prestigeAvailable: user.prestigeAvailable
        };
    }

    async prestigioAll(userId) {
        let usersData = await this.readUsersData();
        this.initUser(usersData, userId);
        const user = usersData[userId];
        
        this.updatePrestigeAvailable(usersData, userId);
        
        if (user.level < 10) {
            return { success: false, message: "Você precisa estar no nível 10 ou superior para fazer prestígio!" };
        }
        
        if (user.prestigeAvailable <= 0) {
            return { success: false, message: `Você não tem prestígios disponíveis! Você tem ${user.prestige} prestígios usados e pode ter até ${this.calculateAvailablePrestiges(user.level)} prestígios no nível ${user.level}.` };
        }
        
        const oldPrestige = user.prestige;
        const prestigiosUsados = user.prestigeAvailable;
        const badgesAdicionados = [];
        
        for (let i = 0; i < prestigiosUsados; i++) {
            const prestigeBadge = `🏆 Prestígio ${user.prestige + 1}`;
            if (!user.badges.includes(prestigeBadge)) {
                user.badges.push(prestigeBadge);
                badgesAdicionados.push(prestigeBadge);
            }
            user.prestige++;
        }
        
        user.prestigeAvailable = 0;
        
        await this.writeUsersData(usersData);
        
        return {
            success: true,
            message: `🎉 Todos os prestígios realizados! Você agora é Prestígio ${user.prestige}! 🎉\n📊 Prestígios usados: ${prestigiosUsados}\n🏆 Badges adicionados: ${badgesAdicionados.join(', ')}\n💎 Prestígios restantes: ${user.prestigeAvailable}`,
            newPrestige: user.prestige,
            oldPrestige: oldPrestige,
            prestigiosUsados: prestigiosUsados,
            badgesAdicionados: badgesAdicionados,
            prestigeAvailable: user.prestigeAvailable
        };
    }

    getUserInfoFromCache(userId) {
        if (!levelCache.users) return null;
        const userKey = this.findUserKey(levelCache.users, userId);
        const actualUserId = userKey || userId;
        this.initUser(levelCache.users, actualUserId);
        const user = levelCache.users[actualUserId];
        if (!user) return null;
        const currentRank = this.getUserRank(user.level);
        this.updatePrestigeAvailable(levelCache.users, actualUserId);
        let totalXPNeeded = 0;
        for (let i = 1; i < user.level; i++) {
            totalXPNeeded += this.getRequiredXP(i);
        }
        const nextLevelXP = this.getRequiredXP(user.level);
        const progressXP = user.xp - totalXPNeeded;
        const neededXP = Math.max(0, nextLevelXP - progressXP);
        const prestigeMultiplier = 1 + (user.prestige * 0.5);
        const dailyBonusMultiplier = user.dailyBonusMultiplier || 0;
        const totalMultiplier = prestigeMultiplier + dailyBonusMultiplier;
        return {
            ...user,
            rank: currentRank,
            progressXP: Math.min(progressXP, nextLevelXP),
            neededXP,
            nextLevelXP,
            prestigeMultiplier,
            dailyBonusMultiplier,
            totalMultiplier
        };
    }

    async getUserInfo(userId) {
        if (levelCache.users) {
            const cached = this.getUserInfoFromCache(userId);
            if (cached) return cached;
        }
        let usersData = await this.readUsersData();
        
        const userKey = this.findUserKey(usersData, userId);
        const actualUserId = userKey || userId;
        
        this.initUser(usersData, actualUserId);
        let user = usersData[actualUserId];
        const currentRank = this.getUserRank(user.level);
        
        this.updatePrestigeAvailable(usersData, actualUserId);
        
        let totalXPNeeded = 0;
        for (let i = 1; i < user.level; i++) {
            totalXPNeeded += this.getRequiredXP(i);
        }
        
        const nextLevelXP = this.getRequiredXP(user.level);
        const progressXP = user.xp - totalXPNeeded;
        const neededXP = Math.max(0, nextLevelXP - progressXP);
        
        if (user.dailyBonusExpiry && new Date(user.dailyBonusExpiry) < new Date()) {
            user.dailyBonusMultiplier = 0;
            user.dailyBonusExpiry = null;
            await this.writeUsersData(usersData);
            usersData = await this.readUsersData();
            user = usersData[actualUserId];
        }
        
        const prestigeMultiplier = 1 + (user.prestige * 0.5);
        const dailyBonusMultiplier = user.dailyBonusMultiplier || 0;
        const totalMultiplier = prestigeMultiplier + dailyBonusMultiplier;
        
        return {
            ...user,
            rank: currentRank,
            progressXP: Math.min(progressXP, nextLevelXP),
            neededXP,
            nextLevelXP,
            prestigeMultiplier,
            dailyBonusMultiplier,
            totalMultiplier
        };
    }

    getUserRank(level) {
        return RANKS.find(rank => level >= rank.minLevel && level <= rank.maxLevel) || RANKS[RANKS.length - 1];
    }

    calculateAvailablePrestiges(level) {
        return Math.floor(level / 10);
    }

    updatePrestigeAvailable(usersData, userId) {
        this.initUser(usersData, userId);
        const user = usersData[userId];
        const shouldHave = this.calculateAvailablePrestiges(user.level);
        const used = user.prestige;
        user.prestigeAvailable = Math.max(0, shouldHave - used);
    }

    async setLevel(userId, targetLevel) {
        let usersData = await this.readUsersData();
        this.initUser(usersData, userId);
        const user = usersData[userId];
        
        if (targetLevel < 1) {
            return { success: false, message: "O nível deve ser pelo menos 1!" };
        }
        
        if (targetLevel > 999) {
            return { success: false, message: "O nível máximo é 999!" };
        }
        
        let totalXPNeeded = 0;
        for (let i = 1; i < targetLevel; i++) {
            totalXPNeeded += this.getRequiredXP(i);
        }
        
        const oldLevel = user.level;
        const oldXP = user.xp;
        const oldPrestigeAvailable = user.prestigeAvailable;
        const oldPrestige = user.prestige;
        
        if (!user.levelHistory) {
            user.levelHistory = [];
        }
        
        user.levelHistory.push({
            timestamp: new Date().toISOString(),
            oldLevel: oldLevel,
            oldXP: oldXP,
            oldPrestigeAvailable: oldPrestigeAvailable,
            oldPrestige: oldPrestige,
            newLevel: targetLevel,
            newXP: totalXPNeeded,
            action: 'setlevel'
        });
        
        if (user.levelHistory.length > 10) {
            user.levelHistory = user.levelHistory.slice(-10);
        }
        
        user.level = targetLevel;
        user.xp = totalXPNeeded;
        
        this.updatePrestigeAvailable(usersData, userId);
        
        await this.writeUsersData(usersData);
        
        await this.updateRankingAfterChange(userId);
        
        return {
            success: true,
            message: `✅ Nível alterado com sucesso!\n📊 ${oldLevel} → ${targetLevel}\n⭐ XP: ${oldXP} → ${totalXPNeeded}\n💎 Prestígios disponíveis: ${user.prestigeAvailable}`,
            oldLevel,
            newLevel: targetLevel,
            oldXP,
            newXP: totalXPNeeded,
            prestigeAvailable: user.prestigeAvailable
        };
    }

    async resetSetLevel(userId) {
        let usersData = await this.readUsersData();
        this.initUser(usersData, userId);
        const user = usersData[userId];
        
        if (!user.levelHistory) {
            user.levelHistory = [];
        }
        
        const setlevelHistory = user.levelHistory.filter(entry => entry.action === 'setlevel');
        
        if (setlevelHistory.length === 0) {
            return { success: false, message: "Nenhuma alteração de nível administrativa encontrada para reverter!" };
        }
        
        const lastSetLevel = setlevelHistory[setlevelHistory.length - 1];
        
        const currentLevel = user.level;
        const currentXP = user.xp;
        const currentPrestigeAvailable = user.prestigeAvailable;
        const currentPrestige = user.prestige;
        console.log(`[DEBUG] currentPrestigeAvailable: ${currentPrestigeAvailable}`);
        console.log(`[DEBUG] currentPrestige: ${currentPrestige}`);
        console.log(`[DEBUG] lastSetLevel.oldPrestigeAvailable: ${lastSetLevel.oldPrestigeAvailable}`);
        console.log(`[DEBUG] lastSetLevel.oldPrestige: ${lastSetLevel.oldPrestige}`);
        
        user.level = lastSetLevel.oldLevel;
        user.xp = lastSetLevel.oldXP;
        user.prestigeAvailable = lastSetLevel.oldPrestigeAvailable || 0;
        user.prestige = lastSetLevel.oldPrestige || 0;
        
        console.log(`[DEBUG] Após reset - Nível: ${user.level}, XP: ${user.xp}, Prestígios disponíveis: ${user.prestigeAvailable}, Prestígios usados: ${user.prestige}`);
        
        const lastIndex = user.levelHistory.findLastIndex(entry => entry.action === 'setlevel');
        if (lastIndex !== -1) {
            user.levelHistory.splice(lastIndex, 1);
        }
        
        await this.writeUsersData(usersData);
        
        await this.updateRankingAfterChange(userId);
        
        return {
            success: true,
            message: `🔄 Nível revertido com sucesso!\n📊 ${currentLevel} → ${lastSetLevel.oldLevel}\n⭐ XP: ${currentXP} → ${lastSetLevel.oldXP}\n💎 Prestígios disponíveis: ${currentPrestigeAvailable} → ${user.prestigeAvailable}\n🏆 Prestígios usados: ${currentPrestige} → ${user.prestige}`,
            oldLevel: currentLevel,
            newLevel: lastSetLevel.oldLevel,
            oldXP: currentXP,
            newXP: lastSetLevel.oldXP,
            oldPrestigeAvailable: currentPrestigeAvailable,
            newPrestigeAvailable: user.prestigeAvailable,
            oldPrestige: currentPrestige,
            newPrestige: user.prestige
        };
    }

    async getRanking(limit = 10) {
        const rows = await repo.getLevelRanking(limit);
        return rows.map(row => ({
            ...row,
            rank: this.getUserRank(row.level)
        }));
    }

    async updateRankingAfterChange(userId) {
        let usersData = await this.readUsersData();
        this.initUser(usersData, userId);
        const user = usersData[userId];
        
        this.updatePrestigeAvailable(usersData, userId);
        
        await this.writeUsersData(usersData);
        
        console.log(`[DEBUG] Ranking atualizado para ${userId}: Nível ${user.level}, XP ${user.xp}, Prestígio ${user.prestige}`);
        console.log(`[DEBUG] Dados do arquivo - Total de usuários: ${Object.keys(usersData).length}`);
        
        const testRanking = await this.getRanking(3);
        console.log(`[DEBUG] Teste de ranking após mudança:`, testRanking.map(u => ({
            userId: u.userId.split('@')[0],
            level: u.level,
            xp: u.xp,
            prestige: u.prestige
        })));
    }
}

const levelSystem = new LevelSystem();

async function levelCommandBot(sock, evt, contactsCache = {}) {
    const msgList = Array.isArray(evt) ? evt : (evt?.messages || []);
    const msg = msgList[0];
    if (!msg?.key?.remoteJid) return;

    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const excludedCommands = ['!menu', '!help', '!ajuda'];

    const levelUpsByUser = new Map();

    for (const m of msgList) {
        if (!m?.message || m.key?.fromMe) continue;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        if (!text || !text.trim()) continue;

        const msgId = getMessageId(m);
        if (processedMessageIds.has(msgId)) continue;
        if (processedMessageIds.size >= MAX_PROCESSED_IDS) {
            const arr = [...processedMessageIds];
            processedMessageIds.clear();
            arr.slice(-MAX_PROCESSED_IDS / 2).forEach(id => processedMessageIds.add(id));
        }
        processedMessageIds.add(msgId);

        const sender = isGroup ? (m.key.participantAlt || m.key.participant || chatId) : chatId;
        const participantJid = m.key.participantAlt || m.key.participant || sender;
        const pushName = m.pushName || contactsCache[sender]?.notify || contactsCache[sender]?.name || null;
        const jidToSave = isGroup ? (m.key.participant || null) : (m.key.remoteJidAlt || null);

        const usersData = await levelSystem.getOrLoadCache();
        const canonicalUserId = levelSystem.findUserKey(usersData, participantJid)
            || (participantJid.endsWith('@lid') ? await repo.findUserByJid(participantJid) : null)
            || participantJid;
        const userJid = canonicalUserId;

        const isDailyBonus = await levelSystem.checkDailyBonus(userJid, pushName, true);
        const xpResult = await levelSystem.addXPToCache(userJid, 10, isDailyBonus, pushName);

        if (!usersData[userJid]) {
            usersData[userJid] = {
                xp: 0, level: 1, prestige: 0, prestigeAvailable: 0, totalMessages: 0,
                lastMessageTime: null, badges: [], lastPrestigeLevel: 0, levelHistory: [],
                dailyBonusMultiplier: 0, dailyBonusExpiry: null, allowMentions: false,
                pushName: pushName || null, customName: null, customNameEnabled: false,
                jid: (jidToSave && !jidToSave.endsWith('@lid')) ? jidToSave : userJid,
                profilePicture: null, profilePictureUpdatedAt: null
            };
        } else {
            if (jidToSave && !jidToSave.endsWith('@lid')) {
                if (!usersData[userJid].jid || usersData[userJid].jid !== jidToSave) usersData[userJid].jid = jidToSave;
            }
            if (pushName && (!usersData[userJid].pushName || usersData[userJid].pushName !== pushName)) usersData[userJid].pushName = pushName;
        }

        if (xpResult.isLevelUp) {
            const prev = levelUpsByUser.get(userJid);
            if (!prev || xpResult.newLevel > prev.newLevel) {
                levelUpsByUser.set(userJid, { ...xpResult, chatId, sender });
            }
        }
    }

    try {
        await levelSystem.flushCache();
    } catch (err) {
        console.error('[LEVEL] Falha ao salvar no banco:', err.message);
    }

    for (const [userJid, data] of levelUpsByUser) {
        const key = `${userJid}_${data.newLevel}`;
        if (lastLevelUpSent.get(key)) continue;
        lastLevelUpSent.set(key, true);
        if (lastLevelUpSent.size > 5000) {
            const keys = [...lastLevelUpSent.keys()];
            keys.slice(0, 2500).forEach(k => lastLevelUpSent.delete(k));
        }

        const userInfo = levelSystem.getUserInfoFromCache(userJid) || await levelSystem.getUserInfo(userJid);
        const rank = userInfo?.rank || levelSystem.getUserRank(data.newLevel);
        const mentionInfo = await mentionsController.processSingleMention(data.sender, contactsCache);

        let levelUpMessage = `🎉 ${mentionInfo.mentionText} subiu para o nível ${data.newLevel}! 🎉\n`;
        if (admins.includes(data.sender)) levelUpMessage += `👑 ADMINISTRADOR⭐😎\n`;
        levelUpMessage += `📊 Elo: ${rank.name}\n`;
        levelUpMessage += `⭐ XP: ${userInfo?.xp ?? 0}\n`;
        levelUpMessage += `🏆 Prestígio: ${userInfo?.prestige ?? 0}\n`;
        if (data.isDailyBonus) {
            levelUpMessage += `🌅 Bônus diário ativado: +1.0x multiplicador por 24h!`;
        } else if (data.dailyBonusMultiplier > 0) {
            levelUpMessage += `🌅 Multiplicador bônus ativo: +${data.dailyBonusMultiplier}x`;
        }

        await sock.sendMessage(data.chatId, { text: levelUpMessage, mentions: mentionInfo.mentions });

        if (data.newLevel >= 10 && data.newLevel % 10 === 0) {
            const mentionInfo2 = await mentionsController.processSingleMention(data.sender, contactsCache);
            await sock.sendMessage(data.chatId, {
                text: `🏆 ${mentionInfo2.mentionText} alcançou o nível ${data.newLevel}! Você tem ${userInfo?.prestigeAvailable ?? 0} prestígios disponíveis! Use !prestigio para resgatar! 🏆`,
                mentions: mentionInfo2.mentions
            });
        }

        const oldRank = levelSystem.getUserRank(data.oldLevel);
        if (oldRank.name !== rank.name) {
            const mentionInfo3 = await mentionsController.processSingleMention(data.sender, contactsCache);
            await sock.sendMessage(data.chatId, {
                text: `🌟 ${mentionInfo3.mentionText} alcançou o elo ${rank.name}! 🌟`,
                mentions: mentionInfo3.mentions
            });
        }
    }

    updateUserProfilePicture(sock, msgList[0] ? (msgList[0].key.participantAlt || msgList[0].key.participant || chatId) : null, await levelSystem.getOrLoadCache(), levelSystem).catch(() => {});

    const sender = isGroup ? (msg.key.participantAlt || msg.key.participant || chatId) : chatId;
    const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const isExcludedCommand = excludedCommands.some(cmd => textMessage.toLowerCase().startsWith(cmd.toLowerCase()));

    if (isExcludedCommand) {
        console.log(`[DEBUG] Comando excluído detectado: ${textMessage}`);
        return;
    }

    if (textMessage === "!me" || textMessage.startsWith("!me ")) {
        const userInfo = await levelSystem.getUserInfo(sender);
        const rank = userInfo.rank;
        
        let meMessage = `👤 *Informações do Usuário*\n`;
        
        if (admins.includes(sender)) {
            meMessage += `👑 ADMINISTRADOR⭐😎\n`;
        }
        
        meMessage += `📊 Nível: ${userInfo.level}\n`;
        meMessage += `⭐ XP: ${userInfo.xp}\n`;
        meMessage += `🏆 Prestígio: ${userInfo.prestige}\n`;
        meMessage += `💎 Prestígios disponíveis: ${userInfo.prestigeAvailable}\n`;
        meMessage += `🌟 Elo: ${rank.name}\n`;
        meMessage += `📈 Progresso: ${userInfo.progressXP}/${userInfo.nextLevelXP} XP\n`;
        meMessage += `🎯 XP necessário: ${userInfo.neededXP}\n`;
        meMessage += `⚡ Multiplicador: ${userInfo.totalMultiplier}x`;
        
        if (userInfo.dailyBonusMultiplier > 0) {
            const expiryTime = new Date(userInfo.dailyBonusExpiry);
            const hoursLeft = Math.ceil((expiryTime - new Date()) / (1000 * 60 * 60));
            meMessage += ` (${userInfo.prestigeMultiplier}x prestígio + ${userInfo.dailyBonusMultiplier}x bônus)\n`;
            meMessage += `🌅 Bônus diário ativo por mais ${hoursLeft}h`;
        } else {
            meMessage += ` (${userInfo.prestigeMultiplier}x prestígio)\n`;
        }
        
        meMessage += `\n💬 Mensagens: ${userInfo.totalMessages}\n`;
        
        if (userInfo.badges.length > 0) {
            meMessage += `🏅 Badges: ${userInfo.badges.join(', ')}\n`;
        }
        
                const mentionInfo = await mentionsController.processSingleMention(sender, contactsCache);
        await sock.sendMessage(chatId, {
            text: meMessage,
            mentions: mentionInfo.mentions
        }, { quoted: msg });
    }

    if (textMessage.startsWith("!info")) {
        console.log('========== LOG DE MENÇÃO (!info) ==========');
        console.log('[DEBUG] Mensagem completa (msg):', JSON.stringify(msg, null, 2));
        console.log('[DEBUG] msg.key:', JSON.stringify(msg.key, null, 2));
        console.log('[DEBUG] msg.message:', JSON.stringify(msg.message, null, 2));
        console.log('[DEBUG] msg.message.extendedTextMessage:', JSON.stringify(msg.message.extendedTextMessage, null, 2));
        console.log('[DEBUG] contextInfo:', JSON.stringify(msg.message.extendedTextMessage?.contextInfo, null, 2));
        console.log('[DEBUG] mentionedJid:', JSON.stringify(msg.message.extendedTextMessage?.contextInfo?.mentionedJid, null, 2));
        console.log('[DEBUG] participantAlt:', msg.key.participantAlt);
        console.log('[DEBUG] participant:', msg.key.participant);
        console.log('[DEBUG] sender:', sender);
        console.log('==========================================');
        const parts = textMessage.split(' ');
        if (parts.length < 2) {
            await sock.sendMessage(chatId, {
                text: "📝 *Uso:* !info @usuario\n\n*Exemplo:* !info @usuario"
            }, { quoted: msg });
            return;
        }

        const targetUser = parts[1];
        let targetUserId;

        if (targetUser.startsWith('@')) {
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.length > 0) {
                targetUserId = mentions[0];
            } else {
                await sock.sendMessage(chatId, {
                    text: "❌ Usuário não encontrado na menção!"
                }, { quoted: msg });
                return;
            }
        } else {
            await sock.sendMessage(chatId, {
                text: "❌ Você deve mencionar um usuário! Use: !info @usuario"
            }, { quoted: msg });
            return;
        }

        const userInfo = await levelSystem.getUserInfo(targetUserId);
        const rank = userInfo.rank;
        
        let infoMessage = `👤 *Informações do Usuário*\n`;
        
        if (admins.includes(targetUserId)) {
            infoMessage += `👑 ADMINISTRADOR⭐😎\n`;
        }
        
        infoMessage += `📊 Nível: ${userInfo.level}\n`;
        infoMessage += `⭐ XP: ${userInfo.xp}\n`;
        infoMessage += `🏆 Prestígio: ${userInfo.prestige}\n`;
        infoMessage += `💎 Prestígios disponíveis: ${userInfo.prestigeAvailable}\n`;
        infoMessage += `🌟 Elo: ${rank.name}\n`;
        infoMessage += `📈 Progresso: ${userInfo.progressXP}/${userInfo.nextLevelXP} XP\n`;
        infoMessage += `🎯 XP necessário: ${userInfo.neededXP}\n`;
        infoMessage += `⚡ Multiplicador: ${userInfo.prestigeMultiplier}x\n`;
        infoMessage += `💬 Mensagens: ${userInfo.totalMessages}\n`;
        
        if (userInfo.badges.length > 0) {
            infoMessage += `🏅 Badges: ${userInfo.badges.join(', ')}\n`;
        }
        
        const mentionInfo = await mentionsController.processSingleMention(targetUserId, contactsCache);
        await sock.sendMessage(chatId, {
            text: infoMessage,
            mentions: mentionInfo.mentions
        }, { quoted: msg });
    }

    if (textMessage.startsWith("!elos")) {
        let elosMessage = `🌟 *Sistema de Elos* 🌟\n\n`;
        
        RANKS.forEach((rank, index) => {
            elosMessage += `${rank.name} - Níveis ${rank.minLevel} a ${rank.maxLevel}\n`;
        });
        
        elosMessage += `\n💡 Use !me para ver seu status atual!`;
        
        await sock.sendMessage(chatId, {
            text: elosMessage
        }, { quoted: msg });
    }

    if (textMessage.startsWith("!prestigioAll")) {
        const prestigeAllResult = await levelSystem.prestigioAll(sender);
        
                const mentionInfo = await mentionsController.processSingleMention(sender, contactsCache);
        await sock.sendMessage(chatId, {
            text: prestigeAllResult.message,
            mentions: mentionInfo.mentions
        }, { quoted: msg });
    }

    if (textMessage === "!prestigio" || textMessage.startsWith("!prestigio ")) {
        const prestigeResult = await levelSystem.prestige(sender);
        
                const mentionInfo = await mentionsController.processSingleMention(sender, contactsCache);
        await sock.sendMessage(chatId, {
            text: prestigeResult.message,
            mentions: mentionInfo.mentions
        }, { quoted: msg });
    }

    if (textMessage.startsWith("!ranking") && !textMessage.startsWith("!rankingGay")) {
        const ranking = await levelSystem.getRanking(10);
        
        let rankingMessage = `🏆 *Ranking Top 10* 🏆\n\n`;
        const userIds = ranking.map(user => user.userId);
        
        const globalMentionsEnabled = await mentionsController.getMentionsEnabled();
        const mentionTexts = [];
        const mentions = [];
        
        for (let i = 0; i < ranking.length; i++) {
            const user = ranking[i];
            const userJidForMention = (user.jid && user.jid.endsWith('@lid')) ? user.userId : (user.jid || user.userId);
            const mentionInfo = await mentionsController.processSingleMention(userJidForMention, contactsCache);
            mentionTexts.push(mentionInfo.mentionText);
            const canMention = globalMentionsEnabled && (user.allowMentions === true);
            if (canMention && mentionInfo.mentions && mentionInfo.mentions.length > 0) {
                mentions.push(...mentionInfo.mentions);
            }
        }
        
        for (let i = 0; i < ranking.length; i++) {
            const user = ranking[i];
            const rank = user.rank;
            
            rankingMessage += `${i + 1}. ${mentionTexts[i]} - Nível ${user.level} (${rank.name})\n`;
            rankingMessage += `   ⭐ ${user.xp} XP | 🏆 Prestígio ${user.prestige}\n\n`;
        }
        
        await sock.sendMessage(chatId, {
            text: rankingMessage,
            mentions: mentions
        }, { quoted: msg });
    }

    if (textMessage.startsWith("!niveis")) {
        let niveisMessage = `🎯 *Sistema de Níveis* 🎯\n\n`;
        niveisMessage += `📊 *Como funciona:*\n`;
        niveisMessage += `• Ganhe 10 XP a cada mensagem enviada\n`;
        niveisMessage += `• Primeiro usuário após 6h da manhã ganha +50 XP\n`;
        niveisMessage += `• Multiplicador de prestígio aumenta XP ganho\n\n`;
        
        niveisMessage += `📈 *Fórmula de níveis:*\n`;
        niveisMessage += `• Níveis 1-10: 100 + (nível-1) × 10 XP\n`;
        niveisMessage += `• Níveis 10+: 100 + 90 + (nível-10) × 100 XP\n\n`;
        
        niveisMessage += `🏆 *Sistema de Prestígio:*\n`;
        niveisMessage += `• Requisito: A cada 10 níveis (10, 20, 30, etc.)\n`;
        niveisMessage += `• Acumulação: Prestígios se acumulam conforme você progride\n`;
        niveisMessage += `• Exemplo: Nível 50 = 5 prestígios disponíveis\n`;
        niveisMessage += `• Benefício: +0.5x multiplicador de XP por prestígio\n`;
        niveisMessage += `• Não reseta nível: Continua progredindo normalmente\n`;
        niveisMessage += `• Badges: Ganha emblemas de prestígio únicos\n\n`;
        
        niveisMessage += `🌟 *Sistema de Elos:*\n`;
        niveisMessage += `• 10 elos diferentes baseados no nível\n`;
        niveisMessage += `• De Bronze (nível 1) até Transcendente (nível 201+)\n`;
        niveisMessage += `• Notificação automática ao mudar de elo\n\n`;
        
        niveisMessage += `💬 *Comandos disponíveis:*\n`;
        niveisMessage += `• !me - Seu status atual\n`;
        niveisMessage += `• !info @usuario - Informações de outro usuário\n`;
        niveisMessage += `• !elos - Lista todos os elos\n`;
        niveisMessage += `• !prestigio - Faz prestígio\n`;
        niveisMessage += `• !prestigioAll - Usa todos os prestígios disponíveis\n`;
        niveisMessage += `• !ranking - Top 10 usuários\n`;
        niveisMessage += `• !niveis - Esta explicação\n\n`;
        
        niveisMessage += `🔔 *Notificações automáticas:*\n`;
        niveisMessage += `• Level up - Quando sobe de nível\n`;
        niveisMessage += `• Mudança de elo - Quando muda de elo\n`;
        niveisMessage += `• Bônus diário - Quando ganha bônus de 50 XP`;
        
        await sock.sendMessage(chatId, {
            text: niveisMessage
        }, { quoted: msg });
    }

    if (textMessage.toLowerCase().startsWith("!setlevel")) {
        console.log(`[DEBUG] Comando !setlevel detectado: "${textMessage}"`);
        if (!admins.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: "❌ Acesso negado! Apenas administradores podem usar este comando."
            }, { quoted: msg });
            return;
        }

        const parts = textMessage.split(' ');
        if (parts.length < 3) {
            await sock.sendMessage(chatId, {
                text: "📝 *Uso:* !setlevel @usuario nivel\n📝 *Uso:* !setlevel me nivel\n\n*Exemplos:*\n• !setlevel @usuario 50\n• !setlevel me 25"
            }, { quoted: msg });
            return;
        }

        const targetUser = parts[1];
        const targetLevel = parseInt(parts[2]);

        console.log(`[DEBUG] !setlevel - targetUser: "${targetUser}", targetLevel: ${targetLevel}`);

        if (isNaN(targetLevel)) {
            await sock.sendMessage(chatId, {
                text: "❌ Nível inválido! Use um número válido."
            }, { quoted: msg });
            return;
        }

        let targetUserId;
        if (targetUser.toLowerCase() === 'me') {
            console.log(`[DEBUG] !setlevel - Usando "me", targetUserId será: ${sender}`);
            targetUserId = sender;
        } else if (targetUser.startsWith('@')) {
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.length > 0) {
                targetUserId = mentions[0];
            } else {
                await sock.sendMessage(chatId, {
                    text: "❌ Usuário não encontrado na menção!"
                }, { quoted: msg });
                return;
            }
        } else {
            await sock.sendMessage(chatId, {
                text: "❌ Use '@usuario' para mencionar alguém ou 'me' para você mesmo!"
            }, { quoted: msg });
            return;
        }

        const result = await levelSystem.setLevel(targetUserId, targetLevel);
        
        if (result.success) {
            const mentionInfoTarget = await mentionsController.processSingleMention(targetUserId, contactsCache);
            const mentionInfoSender = await mentionsController.processSingleMention(sender, contactsCache);
            const allMentions = [...mentionInfoTarget.mentions, ...mentionInfoSender.mentions];
            
            await sock.sendMessage(chatId, {
                text: `🔧 *Comando Administrativo Executado*\n\n${result.message}\n\n👤 Usuário: ${mentionInfoTarget.mentionText}\n👑 Executado por: ${mentionInfoSender.mentionText}`,
                mentions: allMentions
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, {
                text: `❌ Erro: ${result.message}`
            }, { quoted: msg });
        }
    }

    if (textMessage.toLowerCase().startsWith("!resetsetlevel")) {
        console.log(`[DEBUG] Comando !resetSetLevel detectado: "${textMessage}"`);
        if (!admins.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: "❌ Acesso negado! Apenas administradores podem usar este comando."
            }, { quoted: msg });
            return;
        }

        const parts = textMessage.split(' ');
        if (parts.length < 2) {
            await sock.sendMessage(chatId, {
                text: "📝 *Uso:* !resetSetLevel @usuario\n📝 *Uso:* !resetSetLevel me\n\n*Exemplos:*\n• !resetSetLevel @usuario\n• !resetSetLevel me"
            }, { quoted: msg });
            return;
        }

        const targetUser = parts[1];
        let targetUserId;

        console.log(`[DEBUG] !resetSetLevel - targetUser: "${targetUser}"`);

        if (targetUser.toLowerCase() === 'me') {
            console.log(`[DEBUG] !resetSetLevel - Usando "me", targetUserId será: ${sender}`);
            targetUserId = sender;
        } else if (targetUser.startsWith('@')) {
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.length > 0) {
                targetUserId = mentions[0];
            } else {
                await sock.sendMessage(chatId, {
                    text: "❌ Usuário não encontrado na menção!"
                }, { quoted: msg });
                return;
            }
        } else {
            await sock.sendMessage(chatId, {
                text: "❌ Use '@usuario' para mencionar alguém ou 'me' para você mesmo!"
            }, { quoted: msg });
            return;
        }

        const result = await levelSystem.resetSetLevel(targetUserId);
        
        if (result.success) {
            const mentionInfoTarget = await mentionsController.processSingleMention(targetUserId, contactsCache);
            const mentionInfoSender = await mentionsController.processSingleMention(sender, contactsCache);
            const allMentions = [...mentionInfoTarget.mentions, ...mentionInfoSender.mentions];
            
            await sock.sendMessage(chatId, {
                text: `🔧 *Comando Administrativo Executado*\n\n${result.message}\n\n👤 Usuário: ${mentionInfoTarget.mentionText}\n👑 Executado por: ${mentionInfoSender.mentionText}`,
                mentions: allMentions
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, {
                text: `❌ Erro: ${result.message}`
            }, { quoted: msg });
        }
    }

    if (textMessage.toLowerCase() === "!pfp" || textMessage.toLowerCase().startsWith("!pfp ")) {
        const parts = textMessage.split(' ');
        let targetUserId;

        if (parts.length < 2) {
            targetUserId = sender;
        } else {
            const targetUser = parts[1];
            if (targetUser.toLowerCase() === 'me') {
                targetUserId = sender;
            } else if (targetUser.startsWith('@')) {
                const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentions.length > 0) {
                    targetUserId = mentions[0];
                } else {
                    await sock.sendMessage(chatId, {
                        text: "❌ Usuário não encontrado na menção!"
                    }, { quoted: msg });
                    return;
                }
            } else {
                await sock.sendMessage(chatId, {
                    text: "📝 *Uso:* !pfp @usuario ou !pfp me\n\n*Exemplos:*\n• !pfp @usuario - Foto de outro usuário\n• !pfp me - Sua própria foto\n• !pfp - Sua própria foto"
                }, { quoted: msg });
                return;
            }
        }

        try {
            let usersData = await levelSystem.readUsersData();
            const userKey = levelSystem.findUserKey(usersData, targetUserId);
            const user = userKey ? usersData[userKey] : null;

            if (user?.profilePicture) {
                const base64Data = user.profilePicture.split(',')[1];
                const imageBuffer = Buffer.from(base64Data, 'base64');

                const mentionInfo = await mentionsController.processSingleMention(targetUserId, contactsCache);
                await sock.sendMessage(chatId, {
                    image: imageBuffer,
                    caption: `📸 Foto de perfil de ${mentionInfo.mentionText}\n\n✅ Carregada do cache\n🕐 Última atualização: ${user.profilePictureUpdatedAt ? new Date(user.profilePictureUpdatedAt).toLocaleString('pt-BR') : 'N/A'}`,
                    mentions: mentionInfo.mentions
                }, { quoted: msg });
                return;
            }

            const profilePictureUrl = await sock.profilePictureUrl(targetUserId, 'image').catch(() => null);

            if (!profilePictureUrl) {
                await sock.sendMessage(chatId, {
                    text: "❌ Não foi possível obter a foto de perfil deste usuário.\nPode ser que a foto esteja privada ou o usuário não tenha foto."
                }, { quoted: msg });
                return;
            }

            const base64Image = await downloadImageAsBase64(profilePictureUrl);
            const base64Data = base64Image.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');

            if (userKey) {
                usersData[userKey].profilePicture = base64Image;
                usersData[userKey].profilePictureUpdatedAt = new Date().toISOString();
                await levelSystem.writeUsersData(usersData);
            }

            const mentionInfo = await mentionsController.processSingleMention(targetUserId, contactsCache);
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: `📸 Foto de perfil de ${mentionInfo.mentionText}\n\n🔄 Buscada do WhatsApp`,
                mentions: mentionInfo.mentions
            }, { quoted: msg });

        } catch (error) {
            console.error('[DEBUG] Erro ao buscar foto de perfil:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Erro ao buscar foto de perfil: ${error.message}`
            }, { quoted: msg });
        }
    }

}

module.exports = levelCommandBot;
module.exports.levelSystem = levelSystem;
