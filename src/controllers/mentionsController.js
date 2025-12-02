const path = require('path');
const fs = require('fs');

const MENTIONS_PREFS_FILE = path.resolve(__dirname, '..', '..', 'data', 'mentions', 'mentions_preferences.json');
const USERS_DATA_FILE = path.resolve(__dirname, '..', '..', 'levels_info', 'users.json');

function loadMentionsPreferences() {
    try {
        if (fs.existsSync(MENTIONS_PREFS_FILE)) {
            const data = fs.readFileSync(MENTIONS_PREFS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Erro ao carregar preferências de marcações:', error);
    }
    return {
        globalEnabled: false
    };
}

function saveMentionsPreferences(prefs) {
    try {
        fs.writeFileSync(MENTIONS_PREFS_FILE, JSON.stringify(prefs, null, 2), 'utf8');
    } catch (error) {
        console.error('Erro ao salvar preferências de marcações:', error);
    }
}

function readUsersData() {
    try {
        if (fs.existsSync(USERS_DATA_FILE)) {
            const data = fs.readFileSync(USERS_DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Erro ao ler dados dos usuários:', error);
    }
    return {};
}

function writeUsersData(data) {
    try {
        const dir = path.dirname(USERS_DATA_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(USERS_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Erro ao salvar dados dos usuários:', error);
    }
}

function getUsersData() {
    return readUsersData();
}

function getMentionsEnabled() {
    const prefs = loadMentionsPreferences();
    return prefs.globalEnabled || false;
}

function setMentionsEnabled(enabled) {
    const prefs = loadMentionsPreferences();
    prefs.globalEnabled = enabled;
    saveMentionsPreferences(prefs);
}

function getUserMentionPreference(jid) {
    const usersData = readUsersData();
    const user = usersData[jid];
    
    if (!user) {
        return false;
    }
    
    if (user.allowMentions === undefined) {
        return false;
    }
    
    return user.allowMentions === true;
}

function setUserMentionPreference(jid, enabled) {
    const usersData = readUsersData();
    
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
    
    writeUsersData(usersData);
}

function setCustomName(jid, customName) {
    const usersData = readUsersData();
    
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
    
    writeUsersData(usersData);
}

function setCustomNameEnabled(jid, enabled) {
    const usersData = readUsersData();
    
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
    
    writeUsersData(usersData);
}

function canMentionUser(jid) {
    const globalEnabled = getMentionsEnabled();
    if (!globalEnabled) {
        return false;
    }
    return getUserMentionPreference(jid);
}

function getUserDisplayName(jid, contactsCache = {}) {
    if (!jid) {
        return {
            displayName: null,
            hasCustomName: false,
            hasPushName: false
        };
    }
    
    const usersData = readUsersData();
    
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

function getPushName(jid, contactsCache = {}) {
    const nameInfo = getUserDisplayName(jid, contactsCache);
    return nameInfo.displayName || jid.split('@')[0];
}

function processMentions(jids, contactsCache = {}) {
    const canMention = jids.map(jid => canMentionUser(jid));
    const mentions = jids.filter((jid, index) => canMention[index]);
    const displayNames = jids.map((jid, index) => {
        const nameInfo = getUserDisplayName(jid, contactsCache);
        
        if (canMention[index]) {
            if (nameInfo.hasCustomName) {
                return `@${jid.split('@')[0]} (${nameInfo.displayName})`;
            } else {
                return `@${jid.split('@')[0]}`;
            }
        } else {
            return nameInfo.displayName || "O usuário mencionado";
        }
    });
    
    return {
        canMention,
        mentions,
        displayNames
    };
}

function processSingleMention(jid, contactsCache = {}) {
    const canMention = canMentionUser(jid);
    const nameInfo = getUserDisplayName(jid, contactsCache);
    
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

function processMultipleMentions(jids, contactsCache = {}) {
    const result = processMentions(jids, contactsCache);
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

