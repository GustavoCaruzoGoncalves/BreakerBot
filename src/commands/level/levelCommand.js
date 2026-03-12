const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { admins } = require('../../config/adm');
const mentionsController = require('../../controllers/mentionsController');
const { PREFIX } = require('../../config/prefix');

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
                levelSystem.writeUsersData(usersData);
            }
            return false;
        }
        
        const base64Image = await downloadImageAsBase64(profilePictureUrl);
        
        user.profilePicture = base64Image;
        user.profilePictureUpdatedAt = now.toISOString();
        levelSystem.writeUsersData(usersData);
        
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

class LevelSystem {
    constructor() {
        this.dataPath = path.join(__dirname, '..', '..', '..', 'levels_info');
        this.ensureDirectory();
    }

    ensureDirectory() {
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }
    }

    readUsersData() {
        try {
            const filePath = path.join(this.dataPath, 'users.json');
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Erro ao ler dados dos usuários:', error);
        }
        return {};
    }

    writeUsersData(data) {
        try {
            this.ensureDirectory();
            const filePath = path.join(this.dataPath, 'users.json');
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erro ao salvar dados dos usuários:', error);
            throw error;
        }
    }

    readDailyBonus() {
        try {
            const filePath = path.join(this.dataPath, 'daily_bonus.json');
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Erro ao ler bônus diário:', error);
        }
        return { lastBonusDate: null, lastBonusUser: null };
    }

    writeDailyBonus(data) {
        try {
            this.ensureDirectory();
            const filePath = path.join(this.dataPath, 'daily_bonus.json');
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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

    addXP(userId, xpAmount, isDailyBonus = false, pushName = null) {
        console.log(`[DEBUG] addXP chamado para ${userId} com ${xpAmount} XP, bônus: ${isDailyBonus}`);
        
        let usersData = this.readUsersData();
        this.initUser(usersData, userId, pushName);
        const user = usersData[userId];
        
        if (user.dailyBonusExpiry && new Date(user.dailyBonusExpiry) < new Date()) {
            console.log(`[DEBUG] Bônus diário expirou, removendo multiplicador`);
            user.dailyBonusMultiplier = 0;
            user.dailyBonusExpiry = null;
            this.writeUsersData(usersData);
            usersData = this.readUsersData();
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
        
        this.writeUsersData(usersData);
        
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

    checkDailyBonus(userId) {
        let usersData = this.readUsersData();
        this.initUser(usersData, userId);
        let user = usersData[userId];
        const now = new Date();
        const today = now.toDateString();
        const currentHour = now.getHours();
        
        let dailyBonus = this.readDailyBonus();
        
        console.log(`[DEBUG] Verificando bônus diário para ${userId}`);
        console.log(`[DEBUG] Hora atual: ${currentHour}, Data: ${today}`);
        console.log(`[DEBUG] Último bônus: ${dailyBonus.lastBonusDate}, Usuário: ${dailyBonus.lastBonusUser}`);
        
        if (user.dailyBonusExpiry && new Date(user.dailyBonusExpiry) < now) {
            console.log(`[DEBUG] Bônus anterior expirou, removendo multiplicador`);
            user.dailyBonusMultiplier = 0;
            user.dailyBonusExpiry = null;
            this.writeUsersData(usersData);
            usersData = this.readUsersData();
            user = usersData[userId];
        }
        
        if (currentHour < 6) {
            console.log(`[DEBUG] Muito cedo para bônus (${currentHour}h)`);
            return false;
        }
        
        if (dailyBonus.lastBonusDate === today) {
            console.log(`[DEBUG] Bônus já foi dado hoje`);
            return false;
        }
        
        console.log(`[DEBUG] Aplicando bônus diário de multiplicador para ${userId}`);
        dailyBonus.lastBonusDate = today;
        dailyBonus.lastBonusUser = userId;
        
        user.dailyBonusMultiplier = 1.0;
        user.dailyBonusExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        
        this.writeDailyBonus(dailyBonus);
        this.writeUsersData(usersData);
        
        return true;
    }

    canPrestige(userId) {
        const usersData = this.readUsersData();
        this.initUser(usersData, userId);
        const user = usersData[userId];
        
        this.updatePrestigeAvailable(usersData, userId);
        
        return user.level >= 10 && user.prestigeAvailable > 0;
    }

    prestige(userId) {
        let usersData = this.readUsersData();
        this.initUser(usersData, userId);
        const user = usersData[userId];
        
        this.updatePrestigeAvailable(usersData, userId);
        
        if (!this.canPrestige(userId)) {
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
        
        this.writeUsersData(usersData);
        
        return {
            success: true,
            message: `🎉 Prestígio realizado! Você agora é Prestígio ${user.prestige}! Badge adicionado!\n💎 Prestígios restantes: ${user.prestigeAvailable}`,
            newPrestige: user.prestige,
            oldPrestige: oldPrestige,
            prestigeAvailable: user.prestigeAvailable
        };
    }

    prestigioAll(userId) {
        let usersData = this.readUsersData();
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
        
        this.writeUsersData(usersData);
        
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

    getUserInfo(userId) {
        let usersData = this.readUsersData();
        
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
            this.writeUsersData(usersData);
            usersData = this.readUsersData();
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

    setLevel(userId, targetLevel) {
        let usersData = this.readUsersData();
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
        
        this.writeUsersData(usersData);
        
        this.updateRankingAfterChange(userId);
        
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

    resetSetLevel(userId) {
        let usersData = this.readUsersData();
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
        
        this.writeUsersData(usersData);
        
        this.updateRankingAfterChange(userId);
        
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

    getRanking(limit = 10) {
        const usersData = this.readUsersData();
        const userEntries = Object.entries(usersData).filter(([k]) => typeof k === 'string' && k.includes('@'));
        console.log(`[DEBUG] Calculando ranking com ${userEntries.length} usuários`);
        const sortedUsers = userEntries
            .sort(([,a], [,b]) => {
                if (a.prestige !== b.prestige) return b.prestige - a.prestige;
                if (a.level !== b.level) return b.level - a.level;
                return b.xp - a.xp;
            })
            .slice(0, limit);
        
        console.log(`[DEBUG] Top 3 do ranking:`, sortedUsers.slice(0, 3).map(([userId, data]) => ({
            userId: userId.split('@')[0],
            level: data.level,
            xp: data.xp,
            prestige: data.prestige
        })));
        
        return sortedUsers.map(([userId, data]) => ({
            userId,
            ...data,
            rank: this.getUserRank(data.level)
        }));
    }

    updateRankingAfterChange(userId) {
        let usersData = this.readUsersData();
        this.initUser(usersData, userId);
        const user = usersData[userId];
        
        this.updatePrestigeAvailable(usersData, userId);
        
        this.writeUsersData(usersData);
        
        console.log(`[DEBUG] Ranking atualizado para ${userId}: Nível ${user.level}, XP ${user.xp}, Prestígio ${user.prestige}`);
        console.log(`[DEBUG] Dados do arquivo - Total de usuários: ${Object.keys(usersData).length}`);
        
        const testRanking = this.getRanking(3);
        console.log(`[DEBUG] Teste de ranking após mudança:`, testRanking.map(u => ({
            userId: u.userId.split('@')[0],
            level: u.level,
            xp: u.xp,
            prestige: u.prestige
        })));
    }
}

const levelSystem = new LevelSystem();

async function levelCommandBot(sock, { messages }, contactsCache = {}) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = isGroup 
        ? (msg.key.participantAlt || msg.key.participant || msg.key.remoteJid)
        : msg.key.remoteJid;
    
    const messageType = Object.keys(msg.message)[0];
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (msg.key.fromMe) return;

    const excludedCommands = [PREFIX + 'menu', PREFIX + 'help', PREFIX + 'ajuda'];
    const isExcludedCommand = excludedCommands.some(cmd => textMessage.toLowerCase().startsWith(cmd.toLowerCase()));

    if (textMessage && textMessage.trim().length > 0) {
        console.log(`[DEBUG] Processando mensagem de ${sender}: "${textMessage}"`);
        
        const pushName = msg.pushName || contactsCache[sender]?.notify || contactsCache[sender]?.name || null;
        
        const userJid = msg.key.participantAlt || msg.key.participant || sender;
        
        let jidToSave = null;
        if (isGroup) {
            jidToSave = msg.key.participant || null;
        } else {
            jidToSave = msg.key.remoteJidAlt || null;
        }
        
        const isDailyBonus = levelSystem.checkDailyBonus(userJid, pushName);
        console.log(`[DEBUG] Bônus diário: ${isDailyBonus}`);
        
        const xpToGive = 10;
        const xpResult = levelSystem.addXP(userJid, xpToGive, isDailyBonus, pushName);
        
        let usersData = levelSystem.readUsersData();
        if (!usersData[userJid]) {
            usersData[userJid] = {
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
                jid: jidToSave || userJid,
                profilePicture: null,
                profilePictureUpdatedAt: null
            };
            levelSystem.writeUsersData(usersData);
        } else {
            let needsSave = false;
            if (jidToSave && (!usersData[userJid].jid || usersData[userJid].jid !== jidToSave)) {
                usersData[userJid].jid = jidToSave;
                needsSave = true;
            }
            if (pushName && (!usersData[userJid].pushName || usersData[userJid].pushName !== pushName)) {
                usersData[userJid].pushName = pushName;
                needsSave = true;
            }
            if (needsSave) {
                levelSystem.writeUsersData(usersData);
            }
        }
        
        usersData = levelSystem.readUsersData();
        updateUserProfilePicture(sock, userJid, usersData, levelSystem).catch(err => {
            console.log(`[DEBUG] Erro ao atualizar foto de perfil:`, err.message);
        });
        
        console.log(`[DEBUG] Resultado XP:`, xpResult);
        
        if (xpResult.isLevelUp) {
            const userInfo = levelSystem.getUserInfo(sender);
            const rank = userInfo.rank;
            
            const mentionInfo = mentionsController.processSingleMention(sender, contactsCache);
            let levelUpMessage = `🎉 ${mentionInfo.mentionText} subiu para o nível ${xpResult.newLevel}! 🎉\n`;
            
            if (admins.includes(sender)) {
                levelUpMessage += `👑 ADMINISTRADOR⭐😎\n`;
            }
            
            levelUpMessage += `📊 Elo: ${rank.name}\n`;
            levelUpMessage += `⭐ XP: ${userInfo.xp}\n`;
            levelUpMessage += `🏆 Prestígio: ${userInfo.prestige}\n`;
            
            if (xpResult.isDailyBonus) {
                levelUpMessage += `🌅 Bônus diário ativado: +1.0x multiplicador por 24h!`;
            } else if (xpResult.dailyBonusMultiplier > 0) {
                levelUpMessage += `🌅 Multiplicador bônus ativo: +${xpResult.dailyBonusMultiplier}x`;
            }
            
            await sock.sendMessage(chatId, {
                text: levelUpMessage,
                mentions: mentionInfo.mentions
            });
            
            if (xpResult.newLevel >= 10 && xpResult.newLevel % 10 === 0) {
                const userInfo = levelSystem.getUserInfo(sender);
                const mentionInfo2 = mentionsController.processSingleMention(sender, contactsCache);
                await sock.sendMessage(chatId, {
                    text: `🏆 ${mentionInfo2.mentionText} alcançou o nível ${xpResult.newLevel}! Você tem ${userInfo.prestigeAvailable} prestígios disponíveis! Use !prestigio para resgatar! 🏆`,
                    mentions: mentionInfo2.mentions
                });
            }
        }
        
        if (xpResult.isLevelUp) {
            const userInfo = levelSystem.getUserInfo(sender);
            const rank = userInfo.rank;
            
            const oldRank = levelSystem.getUserRank(xpResult.oldLevel);
            if (oldRank.name !== rank.name) {
                const mentionInfo = mentionsController.processSingleMention(sender, contactsCache);
                await sock.sendMessage(chatId, {
                    text: `🌟 ${mentionInfo.mentionText} alcançou o elo ${rank.name}! 🌟`,
                    mentions: mentionInfo.mentions
                });
            }
        }
    }

    if (isExcludedCommand) {
        console.log(`[DEBUG] Comando excluído detectado: ${textMessage}`);
        return;
    }

    if (textMessage === PREFIX + "me" || textMessage.startsWith(PREFIX + "me ")) {
        const userInfo = levelSystem.getUserInfo(sender);
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
        
        const mentionInfo = mentionsController.processSingleMention(sender, contactsCache);
        await sock.sendMessage(chatId, {
            text: meMessage,
            mentions: mentionInfo.mentions
        }, { quoted: msg });
    }

    if (textMessage.startsWith(PREFIX + "info")) {
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
                text: `📝 *Uso:* ${PREFIX}info @usuario\n\n*Exemplo:* ${PREFIX}info @usuario`
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
                text: `❌ Você deve mencionar um usuário! Use: ${PREFIX}info @usuario`
            }, { quoted: msg });
            return;
        }

        const userInfo = levelSystem.getUserInfo(targetUserId);
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
        
        const mentionInfo = mentionsController.processSingleMention(targetUserId, contactsCache);
        await sock.sendMessage(chatId, {
            text: infoMessage,
            mentions: mentionInfo.mentions
        }, { quoted: msg });
    }

    if (textMessage.startsWith(PREFIX + "elos")) {
        let elosMessage = `🌟 *Sistema de Elos* 🌟\n\n`;
        
        RANKS.forEach((rank, index) => {
            elosMessage += `${rank.name} - Níveis ${rank.minLevel} a ${rank.maxLevel}\n`;
        });
        
        elosMessage += `\n💡 Use ${PREFIX}me para ver seu status atual!`;
        
        await sock.sendMessage(chatId, {
            text: elosMessage
        }, { quoted: msg });
    }

    if (textMessage.startsWith(PREFIX + "prestigioAll")) {
        const prestigeAllResult = levelSystem.prestigioAll(sender);
        
        const mentionInfo = mentionsController.processSingleMention(sender, contactsCache);
        await sock.sendMessage(chatId, {
            text: prestigeAllResult.message,
            mentions: mentionInfo.mentions
        }, { quoted: msg });
    }

    if (textMessage === PREFIX + "prestigio" || textMessage.startsWith(PREFIX + "prestigio ")) {
        const prestigeResult = levelSystem.prestige(sender);
        
        const mentionInfo = mentionsController.processSingleMention(sender, contactsCache);
        await sock.sendMessage(chatId, {
            text: prestigeResult.message,
            mentions: mentionInfo.mentions
        }, { quoted: msg });
    }

    if (textMessage.startsWith(PREFIX + "ranking") && !textMessage.startsWith(PREFIX + "rankingGay")) {
        const ranking = levelSystem.getRanking(10);
        
        let rankingMessage = `🏆 *Ranking Top 10* 🏆\n\n`;
        const userIds = ranking.map(user => user.userId);
        
        const mentionTexts = [];
        const mentions = [];
        
        for (let i = 0; i < ranking.length; i++) {
            const user = ranking[i];
            const userJidForMention = user.jid || user.userId;
            const mentionInfo = mentionsController.processSingleMention(userJidForMention, contactsCache);
            mentionTexts.push(mentionInfo.mentionText);
            if (mentionInfo.mentions.length > 0) {
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

    if (textMessage.startsWith(PREFIX + "niveis")) {
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
        niveisMessage += `• ${PREFIX}me - Seu status atual\n`;
        niveisMessage += `• ${PREFIX}info @usuario - Informações de outro usuário\n`;
        niveisMessage += `• ${PREFIX}elos - Lista todos os elos\n`;
        niveisMessage += `• ${PREFIX}prestigio - Faz prestígio\n`;
        niveisMessage += `• ${PREFIX}prestigioAll - Usa todos os prestígios disponíveis\n`;
        niveisMessage += `• ${PREFIX}ranking - Top 10 usuários\n`;
        niveisMessage += `• ${PREFIX}niveis - Esta explicação\n\n`;
        
        niveisMessage += `🔔 *Notificações automáticas:*\n`;
        niveisMessage += `• Level up - Quando sobe de nível\n`;
        niveisMessage += `• Mudança de elo - Quando muda de elo\n`;
        niveisMessage += `• Bônus diário - Quando ganha bônus de 50 XP`;
        
        await sock.sendMessage(chatId, {
            text: niveisMessage
        }, { quoted: msg });
    }

    if (textMessage.toLowerCase().startsWith(`${PREFIX}setlevel`.toLowerCase())) {
        console.log(`[DEBUG] Comando setlevel detectado: "${textMessage}"`);
        if (!admins.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: "❌ Acesso negado! Apenas administradores podem usar este comando."
            }, { quoted: msg });
            return;
        }

        const parts = textMessage.split(' ');
        if (parts.length < 3) {
            await sock.sendMessage(chatId, {
                text: `📝 *Uso:* ${PREFIX}setlevel @usuario nivel\n📝 *Uso:* ${PREFIX}setlevel me nivel\n\n*Exemplos:*\n• ${PREFIX}setlevel @usuario 50\n• ${PREFIX}setlevel me 25`
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

        const result = levelSystem.setLevel(targetUserId, targetLevel);
        
        if (result.success) {
            const mentionInfoTarget = mentionsController.processSingleMention(targetUserId, contactsCache);
            const mentionInfoSender = mentionsController.processSingleMention(sender, contactsCache);
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

    if (textMessage.toLowerCase().startsWith(`${PREFIX}resetsetlevel`.toLowerCase())) {
        console.log(`[DEBUG] Comando resetSetLevel detectado: "${textMessage}"`);
        if (!admins.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: "❌ Acesso negado! Apenas administradores podem usar este comando."
            }, { quoted: msg });
            return;
        }

        const parts = textMessage.split(' ');
        if (parts.length < 2) {
            await sock.sendMessage(chatId, {
                text: `📝 *Uso:* ${PREFIX}resetSetLevel @usuario\n📝 *Uso:* ${PREFIX}resetSetLevel me\n\n*Exemplos:*\n• ${PREFIX}resetSetLevel @usuario\n• ${PREFIX}resetSetLevel me`
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

        const result = levelSystem.resetSetLevel(targetUserId);
        
        if (result.success) {
            const mentionInfoTarget = mentionsController.processSingleMention(targetUserId, contactsCache);
            const mentionInfoSender = mentionsController.processSingleMention(sender, contactsCache);
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

    if (textMessage.toLowerCase() === PREFIX.toLowerCase() + "pfp" || textMessage.toLowerCase().startsWith((PREFIX + "pfp ").toLowerCase())) {
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
                    text: `📝 *Uso:* ${PREFIX}pfp @usuario ou ${PREFIX}pfp me\n\n*Exemplos:*\n• ${PREFIX}pfp @usuario - Foto de outro usuário\n• ${PREFIX}pfp me - Sua própria foto\n• ${PREFIX}pfp - Sua própria foto`
                }, { quoted: msg });
                return;
            }
        }

        try {
            let usersData = levelSystem.readUsersData();
            const userKey = levelSystem.findUserKey(usersData, targetUserId);
            const user = userKey ? usersData[userKey] : null;

            if (user?.profilePicture) {
                const base64Data = user.profilePicture.split(',')[1];
                const imageBuffer = Buffer.from(base64Data, 'base64');

                const mentionInfo = mentionsController.processSingleMention(targetUserId, contactsCache);
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
                levelSystem.writeUsersData(usersData);
            }

            const mentionInfo = mentionsController.processSingleMention(targetUserId, contactsCache);
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
