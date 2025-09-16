const fs = require('fs');
const path = require('path');
const admins = require('./adm');

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
        this.dataPath = path.join(__dirname, 'levels_info');
        this.usersData = this.loadUsersData();
        this.dailyBonus = this.loadDailyBonus();
    }

    loadUsersData() {
        try {
            const filePath = path.join(this.dataPath, 'users.json');
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        } catch (error) {
            console.error('Erro ao carregar dados dos usuários:', error);
        }
        return {};
    }

    saveUsersData() {
        try {
            const filePath = path.join(this.dataPath, 'users.json');
            fs.writeFileSync(filePath, JSON.stringify(this.usersData, null, 2));
        } catch (error) {
            console.error('Erro ao salvar dados dos usuários:', error);
        }
    }

    loadDailyBonus() {
        try {
            const filePath = path.join(this.dataPath, 'daily_bonus.json');
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        } catch (error) {
            console.error('Erro ao carregar bônus diário:', error);
        }
        return { lastBonusDate: null, lastBonusUser: null };
    }

    saveDailyBonus() {
        try {
            const filePath = path.join(this.dataPath, 'daily_bonus.json');
            fs.writeFileSync(filePath, JSON.stringify(this.dailyBonus, null, 2));
        } catch (error) {
            console.error('Erro ao salvar bônus diário:', error);
        }
    }

    initUser(userId) {
        if (!this.usersData[userId]) {
            this.usersData[userId] = {
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
                dailyBonusExpiry: null
            };
        }
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

    addXP(userId, xpAmount, isDailyBonus = false) {
        console.log(`[DEBUG] addXP chamado para ${userId} com ${xpAmount} XP, bônus: ${isDailyBonus}`);
        this.initUser(userId);
        const user = this.usersData[userId];
        
        if (user.dailyBonusExpiry && new Date(user.dailyBonusExpiry) < new Date()) {
            console.log(`[DEBUG] Bônus diário expirou, removendo multiplicador`);
            user.dailyBonusMultiplier = 0;
            user.dailyBonusExpiry = null;
            this.saveUsersData();
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
            this.updatePrestigeAvailable(userId);
        }
        
        console.log(`[DEBUG] Usuário ${userId}: ${oldLevel} -> ${newLevel}, XP: ${user.xp}`);
        this.saveUsersData();
        
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
        this.initUser(userId);
        const user = this.usersData[userId];
        const now = new Date();
        const today = now.toDateString();
        const currentHour = now.getHours();
        
        console.log(`[DEBUG] Verificando bônus diário para ${userId}`);
        console.log(`[DEBUG] Hora atual: ${currentHour}, Data: ${today}`);
        console.log(`[DEBUG] Último bônus: ${this.dailyBonus.lastBonusDate}, Usuário: ${this.dailyBonus.lastBonusUser}`);
        
        if (user.dailyBonusExpiry && new Date(user.dailyBonusExpiry) < now) {
            console.log(`[DEBUG] Bônus anterior expirou, removendo multiplicador`);
            user.dailyBonusMultiplier = 0;
            user.dailyBonusExpiry = null;
            this.saveUsersData();
        }
        
        if (currentHour < 6) {
            console.log(`[DEBUG] Muito cedo para bônus (${currentHour}h)`);
            return false;
        }
        
        if (this.dailyBonus.lastBonusDate === today) {
            console.log(`[DEBUG] Bônus já foi dado hoje`);
            return false;
        }
        
        console.log(`[DEBUG] Aplicando bônus diário de multiplicador para ${userId}`);
        this.dailyBonus.lastBonusDate = today;
        this.dailyBonus.lastBonusUser = userId;
        
        user.dailyBonusMultiplier = 1.0;
        user.dailyBonusExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        
        this.saveDailyBonus();
        this.saveUsersData();
        
        return true;
    }

    canPrestige(userId) {
        this.initUser(userId);
        const user = this.usersData[userId];
        
        this.updatePrestigeAvailable(userId);
        
        return user.level >= 10 && user.prestigeAvailable > 0;
    }

    prestige(userId) {
        this.initUser(userId);
        const user = this.usersData[userId];
        
        this.updatePrestigeAvailable(userId);
        
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
        
        this.saveUsersData();
        
        return {
            success: true,
            message: `🎉 Prestígio realizado! Você agora é Prestígio ${user.prestige}! Badge adicionado!\n💎 Prestígios restantes: ${user.prestigeAvailable}`,
            newPrestige: user.prestige,
            oldPrestige: oldPrestige,
            prestigeAvailable: user.prestigeAvailable
        };
    }

    prestigioAll(userId) {
        this.initUser(userId);
        const user = this.usersData[userId];
        
        this.updatePrestigeAvailable(userId);
        
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
        
        this.saveUsersData();
        
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
        this.initUser(userId);
        const user = this.usersData[userId];
        const currentRank = this.getUserRank(user.level);
        
        this.updatePrestigeAvailable(userId);
        
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
            this.saveUsersData();
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

    updatePrestigeAvailable(userId) {
        this.initUser(userId);
        const user = this.usersData[userId];
        const shouldHave = this.calculateAvailablePrestiges(user.level);
        const used = user.prestige;
        user.prestigeAvailable = Math.max(0, shouldHave - used);
    }

    setLevel(userId, targetLevel) {
        this.initUser(userId);
        const user = this.usersData[userId];
        
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
        
        if (!user.levelHistory) {
            user.levelHistory = [];
        }
        
        user.levelHistory.push({
            timestamp: new Date().toISOString(),
            oldLevel: oldLevel,
            oldXP: oldXP,
            oldPrestigeAvailable: oldPrestigeAvailable,
            newLevel: targetLevel,
            newXP: totalXPNeeded,
            action: 'setlevel'
        });
        
        if (user.levelHistory.length > 10) {
            user.levelHistory = user.levelHistory.slice(-10);
        }
        
        user.level = targetLevel;
        user.xp = totalXPNeeded;
        
        this.updatePrestigeAvailable(userId);
        
        this.saveUsersData();
        
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
        this.initUser(userId);
        const user = this.usersData[userId];
        
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
        
        user.level = lastSetLevel.oldLevel;
        user.xp = lastSetLevel.oldXP;
        user.prestigeAvailable = lastSetLevel.oldPrestigeAvailable || 0;
        
        this.updatePrestigeAvailable(userId);
        
        const lastIndex = user.levelHistory.findLastIndex(entry => entry.action === 'setlevel');
        if (lastIndex !== -1) {
            user.levelHistory.splice(lastIndex, 1);
        }
        
        this.saveUsersData();
        
        this.updateRankingAfterChange(userId);
        
        return {
            success: true,
            message: `🔄 Nível revertido com sucesso!\n📊 ${currentLevel} → ${lastSetLevel.oldLevel}\n⭐ XP: ${currentXP} → ${lastSetLevel.oldXP}\n💎 Prestígios disponíveis: ${currentPrestigeAvailable} → ${user.prestigeAvailable}`,
            oldLevel: currentLevel,
            newLevel: lastSetLevel.oldLevel,
            oldXP: currentXP,
            newXP: lastSetLevel.oldXP,
            oldPrestigeAvailable: currentPrestigeAvailable,
            newPrestigeAvailable: user.prestigeAvailable
        };
    }

    getRanking(limit = 10) {
        console.log(`[DEBUG] Calculando ranking com ${Object.keys(this.usersData).length} usuários`);
        
        const sortedUsers = Object.entries(this.usersData)
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
        this.updatePrestigeAvailable(userId);
        
        this.saveUsersData();
        
        const user = this.usersData[userId];
        console.log(`[DEBUG] Ranking atualizado para ${userId}: Nível ${user.level}, XP ${user.xp}, Prestígio ${user.prestige}`);
        console.log(`[DEBUG] Dados em memória - Total de usuários: ${Object.keys(this.usersData).length}`);
        
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

async function levelCommandBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const messageType = Object.keys(msg.message)[0];
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (msg.key.fromMe) return;

    const excludedCommands = ['!menu', '!help', '!ajuda'];
    const isExcludedCommand = excludedCommands.some(cmd => textMessage.toLowerCase().startsWith(cmd.toLowerCase()));

    if (textMessage && textMessage.trim().length > 0) {
        console.log(`[DEBUG] Processando mensagem de ${sender}: "${textMessage}"`);
        const isDailyBonus = levelSystem.checkDailyBonus(sender);
        console.log(`[DEBUG] Bônus diário: ${isDailyBonus}`);
        
        const xpToGive = 10;
        const xpResult = levelSystem.addXP(sender, xpToGive, isDailyBonus);
        console.log(`[DEBUG] Resultado XP:`, xpResult);
        
        if (xpResult.isLevelUp) {
            const userInfo = levelSystem.getUserInfo(sender);
            const rank = userInfo.rank;
            
            let levelUpMessage = `🎉 @${sender.split('@')[0]} subiu para o nível ${xpResult.newLevel}! 🎉\n`;
            
            if (admins.admins.includes(sender)) {
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
                mentions: [sender]
            });
            
            if (xpResult.newLevel >= 10 && xpResult.newLevel % 10 === 0) {
                const userInfo = levelSystem.getUserInfo(sender);
                await sock.sendMessage(chatId, {
                    text: `🏆 @${sender.split('@')[0]} alcançou o nível ${xpResult.newLevel}! Você tem ${userInfo.prestigeAvailable} prestígios disponíveis! Use !prestigio para resgatar! 🏆`,
                    mentions: [sender]
                });
            }
        }
        
        if (xpResult.isLevelUp) {
            const userInfo = levelSystem.getUserInfo(sender);
            const rank = userInfo.rank;
            
            const oldRank = levelSystem.getUserRank(xpResult.oldLevel);
            if (oldRank.name !== rank.name) {
                await sock.sendMessage(chatId, {
                    text: `🌟 @${sender.split('@')[0]} alcançou o elo ${rank.name}! 🌟`,
                    mentions: [sender]
                });
            }
        }
    }

    if (isExcludedCommand) {
        console.log(`[DEBUG] Comando excluído detectado: ${textMessage}`);
        return;
    }

    if (textMessage.startsWith("!me")) {
        const userInfo = levelSystem.getUserInfo(sender);
        const rank = userInfo.rank;
        
        let meMessage = `👤 *Informações do Usuário*\n`;
        
        if (admins.admins.includes(sender)) {
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
        
        await sock.sendMessage(chatId, {
            text: meMessage,
            mentions: [sender]
        }, { quoted: msg });
    }

    if (textMessage.startsWith("!info")) {
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

        const userInfo = levelSystem.getUserInfo(targetUserId);
        const rank = userInfo.rank;
        
        let infoMessage = `👤 *Informações do Usuário*\n`;
        
        if (admins.admins.includes(targetUserId)) {
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
        
        await sock.sendMessage(chatId, {
            text: infoMessage,
            mentions: [targetUserId]
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
        const prestigeAllResult = levelSystem.prestigioAll(sender);
        
        if (prestigeAllResult.success) {
            await sock.sendMessage(chatId, {
                text: prestigeAllResult.message,
                mentions: [sender]
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, {
                text: prestigeAllResult.message,
                mentions: [sender]
            }, { quoted: msg });
        }
    }

    if (textMessage === "!prestigio" || textMessage.startsWith("!prestigio ")) {
        const prestigeResult = levelSystem.prestige(sender);
        
        if (prestigeResult.success) {
            await sock.sendMessage(chatId, {
                text: prestigeResult.message,
                mentions: [sender]
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, {
                text: prestigeResult.message,
                mentions: [sender]
            }, { quoted: msg });
        }
    }

    if (textMessage.startsWith("!ranking")) {
        const ranking = levelSystem.getRanking(10);
        
        let rankingMessage = `🏆 *Ranking Top 10* 🏆\n\n`;
        let mentions = [];
        
        for (let i = 0; i < ranking.length; i++) {
            const user = ranking[i];
            const rank = user.rank;
            
            rankingMessage += `${i + 1}. @${user.userId.split('@')[0]} - Nível ${user.level} (${rank.name})\n`;
            rankingMessage += `   ⭐ ${user.xp} XP | 🏆 Prestígio ${user.prestige}\n\n`;
            mentions.push(user.userId);
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
        if (!admins.admins.includes(sender)) {
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

        const result = levelSystem.setLevel(targetUserId, targetLevel);
        
        if (result.success) {
            await sock.sendMessage(chatId, {
                text: `🔧 *Comando Administrativo Executado*\n\n${result.message}\n\n👤 Usuário: @${targetUserId.split('@')[0]}\n👑 Executado por: @${sender.split('@')[0]}`,
                mentions: [targetUserId, sender]
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, {
                text: `❌ Erro: ${result.message}`
            }, { quoted: msg });
        }
    }

    if (textMessage.toLowerCase().startsWith("!resetsetlevel")) {
        console.log(`[DEBUG] Comando !resetSetLevel detectado: "${textMessage}"`);
        if (!admins.admins.includes(sender)) {
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

        const result = levelSystem.resetSetLevel(targetUserId);
        
        if (result.success) {
            await sock.sendMessage(chatId, {
                text: `🔧 *Comando Administrativo Executado*\n\n${result.message}\n\n👤 Usuário: @${targetUserId.split('@')[0]}\n👑 Executado por: @${sender.split('@')[0]}`,
                mentions: [targetUserId, sender]
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, {
                text: `❌ Erro: ${result.message}`
            }, { quoted: msg });
        }
    }
}

module.exports = levelCommandBot;
