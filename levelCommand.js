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
                totalMessages: 0,
                lastMessageTime: null,
                badges: [],
                lastPrestigeLevel: 0
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
        
        const prestigeMultiplier = 1 + (user.prestige * 0.5);
        const finalXP = Math.floor(xpAmount * prestigeMultiplier);
        
        console.log(`[DEBUG] XP base: ${xpAmount}, multiplicador: ${prestigeMultiplier}, final: ${finalXP}`);
        
        user.xp += finalXP;
        user.totalMessages++;
        user.lastMessageTime = new Date().toISOString();
        
        const oldLevel = user.level;
        const newLevel = this.calculateLevel(user.xp);
        user.level = newLevel;
        
        console.log(`[DEBUG] Usuário ${userId}: ${oldLevel} -> ${newLevel}, XP: ${user.xp}`);
        this.saveUsersData();
        
        return {
            oldLevel,
            newLevel,
            xpGained: finalXP,
            isLevelUp: newLevel > oldLevel,
            isDailyBonus
        };
    }

    checkDailyBonus(userId) {
        const now = new Date();
        const today = now.toDateString();
        const currentHour = now.getHours();
        
        console.log(`[DEBUG] Verificando bônus diário para ${userId}`);
        console.log(`[DEBUG] Hora atual: ${currentHour}, Data: ${today}`);
        console.log(`[DEBUG] Último bônus: ${this.dailyBonus.lastBonusDate}, Usuário: ${this.dailyBonus.lastBonusUser}`);
        
        if (currentHour < 6) {
            console.log(`[DEBUG] Muito cedo para bônus (${currentHour}h)`);
            return false;
        }
        
        if (this.dailyBonus.lastBonusDate === today) {
            console.log(`[DEBUG] Bônus já foi dado hoje`);
            return false;
        }
        
        console.log(`[DEBUG] Aplicando bônus diário para ${userId}`);
        this.dailyBonus.lastBonusDate = today;
        this.dailyBonus.lastBonusUser = userId;
        this.saveDailyBonus();
        
        return true;
    }

    canPrestige(userId) {
        this.initUser(userId);
        const user = this.usersData[userId];
        
        return user.level >= 10 && 
               user.level % 10 === 0 && 
               user.lastPrestigeLevel < user.level;
    }

    prestige(userId) {
        this.initUser(userId);
        const user = this.usersData[userId];
        
        if (!this.canPrestige(userId)) {
            if (user.level < 10) {
                return { success: false, message: "Você precisa estar no nível 10 ou superior para fazer prestígio!" };
            } else if (user.level % 10 !== 0) {
                return { success: false, message: "Você só pode fazer prestígio em níveis múltiplos de 10 (10, 20, 30, etc.)!" };
            } else if (user.lastPrestigeLevel >= user.level) {
                return { success: false, message: `Você já fez prestígio no nível ${user.level}! Aguarde o próximo nível múltiplo de 10.` };
            }
        }
        
        const prestigeBadge = `🏆 Prestígio ${user.prestige + 1}`;
        if (!user.badges.includes(prestigeBadge)) {
            user.badges.push(prestigeBadge);
        }
        
        const oldPrestige = user.prestige;
        user.prestige++;
        user.lastPrestigeLevel = user.level;
        
        this.saveUsersData();
        
        return {
            success: true,
            message: `🎉 Prestígio realizado! Você agora é Prestígio ${user.prestige}! Badge adicionado!`,
            newPrestige: user.prestige,
            oldPrestige: oldPrestige
        };
    }

    getUserInfo(userId) {
        this.initUser(userId);
        const user = this.usersData[userId];
        const currentRank = this.getUserRank(user.level);
        
        let totalXPNeeded = 0;
        for (let i = 1; i < user.level; i++) {
            totalXPNeeded += this.getRequiredXP(i);
        }
        
        const nextLevelXP = this.getRequiredXP(user.level);
        const progressXP = user.xp - totalXPNeeded;
        const neededXP = Math.max(0, nextLevelXP - progressXP);
        
        return {
            ...user,
            rank: currentRank,
            progressXP: Math.min(progressXP, nextLevelXP),
            neededXP,
            nextLevelXP,
            prestigeMultiplier: 1 + (user.prestige * 0.5)
        };
    }

    getUserRank(level) {
        return RANKS.find(rank => level >= rank.minLevel && level <= rank.maxLevel) || RANKS[RANKS.length - 1];
    }

    getRanking(limit = 10) {
        const sortedUsers = Object.entries(this.usersData)
            .sort(([,a], [,b]) => {
                if (a.prestige !== b.prestige) return b.prestige - a.prestige;
                if (a.level !== b.level) return b.level - a.level;
                return b.xp - a.xp;
            })
            .slice(0, limit);
        
        return sortedUsers.map(([userId, data]) => ({
            userId,
            ...data,
            rank: this.getUserRank(data.level)
        }));
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
        
        let xpToGive = 10;
        if (isDailyBonus) {
            xpToGive = 60;
            console.log(`[DEBUG] Aplicando bônus diário: 10 + 50 = 60 XP`);
        }
        
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
                levelUpMessage += `🌅 Bônus diário: +50 XP!`;
            }
            
            await sock.sendMessage(chatId, {
                text: levelUpMessage,
                mentions: [sender]
            });
            
            if (xpResult.newLevel >= 10 && xpResult.newLevel % 10 === 0) {
                await sock.sendMessage(chatId, {
                    text: `🏆 @${sender.split('@')[0]} alcançou o nível ${xpResult.newLevel}! Use !prestigio para resgatar seu badge de prestígio! 🏆`,
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
        meMessage += `🌟 Elo: ${rank.name}\n`;
        meMessage += `📈 Progresso: ${userInfo.progressXP}/${userInfo.nextLevelXP} XP\n`;
        meMessage += `🎯 XP necessário: ${userInfo.neededXP}\n`;
        meMessage += `⚡ Multiplicador: ${userInfo.prestigeMultiplier}x\n`;
        meMessage += `💬 Mensagens: ${userInfo.totalMessages}\n`;
        
        if (userInfo.badges.length > 0) {
            meMessage += `🏅 Badges: ${userInfo.badges.join(', ')}\n`;
        }
        
        await sock.sendMessage(chatId, {
            text: meMessage,
            mentions: [sender]
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

    if (textMessage.startsWith("!prestigio")) {
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
        niveisMessage += `• Benefício: +0.5x multiplicador de XP por prestígio\n`;
        niveisMessage += `• Não reseta nível: Continua progredindo normalmente\n`;
        niveisMessage += `• Badges: Ganha emblemas de prestígio únicos\n\n`;
        
        niveisMessage += `🌟 *Sistema de Elos:*\n`;
        niveisMessage += `• 10 elos diferentes baseados no nível\n`;
        niveisMessage += `• De Bronze (nível 1) até Transcendente (nível 201+)\n`;
        niveisMessage += `• Notificação automática ao mudar de elo\n\n`;
        
        niveisMessage += `💬 *Comandos disponíveis:*\n`;
        niveisMessage += `• !me - Seu status atual\n`;
        niveisMessage += `• !elos - Lista todos os elos\n`;
        niveisMessage += `• !prestigio - Faz prestígio\n`;
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
}

module.exports = levelCommandBot;
