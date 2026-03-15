const repo = require('../database/repository');

async function loadMentionsPreferences() {
    try {
        return await repo.getMentionsPreferences();
    } catch (error) {
        console.error('Erro ao carregar preferências de marcações:', error);
        return { globalEnabled: false };
    }
}

async function saveMentionsPreferences(prefs) {
    try {
        await repo.updateMentionsPreferences(prefs);
    } catch (error) {
        console.error('Erro ao salvar preferências de marcações:', error);
    }
}

async function readUsersData() {
    try {
        return await repo.getAllUsers();
    } catch (error) {
        console.error('Erro ao ler dados dos usuários:', error);
        return {};
    }
}

async function writeUsersData(data) {
    try {
        await repo.saveAllUsers(data);
    } catch (error) {
        console.error('Erro ao salvar dados dos usuários:', error);
    }
}

async function getUsersData() {
    return readUsersData();
}

async function getMentionsEnabled() {
    const prefs = await loadMentionsPreferences();
    return prefs.globalEnabled || false;
}

async function setMentionsEnabled(enabled) {
    const prefs = await loadMentionsPreferences();
    prefs.globalEnabled = enabled;
    await saveMentionsPreferences(prefs);
}

async function getUserMentionPreference(jid) {
    const usersData = await readUsersData();
    
    let user = null;
    
    for (const [savedJid, userData] of Object.entries(usersData)) {
        if (userData.jid === jid) {
            user = userData;
            break;
        }
    }
    
    if (!user) {
        user = usersData[jid];
    }
    
    if (!user) {
        const phoneNumber = jid.split('@')[0].split(':')[0];
        const possibleJid = `${phoneNumber}@s.whatsapp.net`;
        user = usersData[possibleJid];
    }
    
    if (!user) {
        return false;
    }
    
    if (user.allowMentions === undefined) {
        return false;
    }
    
    return user.allowMentions === true;
}

async function setUserMentionPreference(jid, enabled) {
    const usersData = await readUsersData();
    
    if (!usersData[jid]) {
        usersData[jid] = {
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
            allowMentions: enabled
        };
    } else {
        usersData[jid].allowMentions = enabled;
    }
    
    await writeUsersData(usersData);
}

async function setCustomName(jid, customName) {
    const usersData = await readUsersData();
    
    if (!usersData[jid]) {
        usersData[jid] = {
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
            customName: customName,
            customNameEnabled: true
        };
    } else {
        usersData[jid].customName = customName;
        usersData[jid].customNameEnabled = true;
    }
    
    await writeUsersData(usersData);
}

async function setCustomNameEnabled(jid, enabled) {
    const usersData = await readUsersData();
    
    if (!usersData[jid]) {
        usersData[jid] = {
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
            customNameEnabled: enabled
        };
    } else {
        usersData[jid].customNameEnabled = enabled;
    }
    
    await writeUsersData(usersData);
}

async function canMentionUser(jid) {
    const globalEnabled = await getMentionsEnabled();
    if (!globalEnabled) {
        return false;
    }
    return getUserMentionPreference(jid);
}

async function getUserDisplayName(jid, contactsCache = {}) {
    if (!jid) {
        return {
            displayName: null,
            hasCustomName: false,
            hasPushName: false
        };
    }
    
    const usersData = await readUsersData();
    
    let user = null;
    
    for (const [savedJid, userData] of Object.entries(usersData)) {
        if (userData.jid === jid) {
            user = userData;
            break;
        }
    }
    
    if (!user) {
        user = usersData[jid];
    }
    
    if (!user) {
        const phoneNumber = jid.split('@')[0].split(':')[0];
        const possibleJid = `${phoneNumber}@s.whatsapp.net`;
        user = usersData[possibleJid];
    }
    
    if (user?.customNameEnabled && user?.customName) {
        return {
            displayName: user.customName,
            hasCustomName: true,
            hasPushName: false
        };
    }
    
    if (user?.pushName) {
        return {
            displayName: user.pushName,
            hasCustomName: false,
            hasPushName: true
        };
    }
    
    return {
        displayName: null,
        hasCustomName: false,
        hasPushName: false
    };
}

async function getPushName(jid, contactsCache = {}) {
    const nameInfo = await getUserDisplayName(jid, contactsCache);
    return nameInfo.displayName || jid.split('@')[0];
}

async function processMentions(jids, contactsCache = {}) {
    const canMention = await Promise.all(jids.map(jid => canMentionUser(jid)));
    const mentions = jids.filter((jid, index) => canMention[index]);
    const displayNames = await Promise.all(jids.map(async (jid, index) => {
        const nameInfo = await getUserDisplayName(jid, contactsCache);
        
        if (canMention[index]) {
            if (nameInfo.hasCustomName) {
                return `@${jid.split('@')[0]} (${nameInfo.displayName})`;
            } else {
                return `@${jid.split('@')[0]}`;
            }
        } else {
            return nameInfo.displayName || "O usuário mencionado";
        }
    }));
    
    return {
        canMention,
        mentions,
        displayNames
    };
}

async function processSingleMention(jid, contactsCache = {}) {
    const canMention = await canMentionUser(jid);
    const nameInfo = await getUserDisplayName(jid, contactsCache);
    
    let mentionText;
    const mentions = canMention ? [jid] : [];
    
    const hasName = nameInfo.displayName !== null && 
                   nameInfo.displayName !== undefined && 
                   nameInfo.displayName.trim().length > 0;
    
    if (canMention) {
        if (nameInfo.hasCustomName && nameInfo.displayName) {
            mentionText = `@${jid.split('@')[0]} (${nameInfo.displayName})`;
        } else {
            mentionText = `@${jid.split('@')[0]}`;
        }
    } else {
        if (hasName) {
            mentionText = nameInfo.displayName;
        } else {
            mentionText = "O usuário mencionado";
        }
    }
    
    return {
        canMention,
        mentionText,
        mentions,
        hasName: hasName,
        hasCustomName: nameInfo.hasCustomName
    };
}

async function processMultipleMentions(jids, contactsCache = {}) {
    const result = await processMentions(jids, contactsCache);
    return {
        mentionTexts: result.displayNames,
        mentions: result.mentions
    };
}

module.exports = {
    getMentionsEnabled,
    setMentionsEnabled,
    getUserMentionPreference,
    setUserMentionPreference,
    canMentionUser,
    getPushName,
    getUserDisplayName,
    processMentions,
    processSingleMention,
    processMultipleMentions,
    loadMentionsPreferences,
    getUsersData,
    setCustomName,
    setCustomNameEnabled
};
