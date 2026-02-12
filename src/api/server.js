const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.API_PORT || 3001;
const HOST = process.env.API_HOST || '0.0.0.0';

const getAllowedOrigins = () => {
    if (process.env.CORS_ORIGINS) {
        return process.env.CORS_ORIGINS.split(',').map(o => o.trim());
    }
    return ['http://localhost:3000', 'http://localhost:3001'];
};

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        const allowedOrigins = getAllowedOrigins();
        
        if (allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`[CORS] Origem não permitida: ${origin}`);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

app.options('*', cors(corsOptions));
app.use(express.json());

app.set('trust proxy', 1);

const USERS_FILE = path.join(__dirname, '..', '..', 'levels_info', 'users.json');
const DAILY_BONUS_FILE = path.join(__dirname, '..', '..', 'levels_info', 'daily_bonus.json');
const MENTIONS_FILE = path.join(__dirname, '..', '..', 'data', 'mentions', 'mentions_preferences.json');
const BACKUP_FILE = path.join(__dirname, '..', '..', 'data', 'backups', 'deleted_users.json');
const AUTH_CODES_FILE = path.join(__dirname, '..', '..', 'data', 'auth', 'auth_codes.json');
const PENDING_MESSAGES_FILE = path.join(__dirname, '..', '..', 'data', 'auth', 'pending_messages.json');
const SESSIONS_FILE = path.join(__dirname, '..', '..', 'data', 'auth', 'sessions.json');
const AMIGO_SECRETO_FILE = path.join(__dirname, '..', '..', 'data', 'amigoSecreto', 'participantes.json');
const PRAISED_FILE = path.join(__dirname, '..', '..', 'data', 'praised.json');

const auraCommand = require('../commands/aura/auraCommand');
const getAuraKey = auraCommand.getAuraKey;
const getWhoPraised = auraCommand.getWhoPraised;
const MISSION_IDS = auraCommand.MISSION_IDS;
const MISSION_CONFIG = auraCommand.MISSION_CONFIG;
const RANDOM_EVENTS = auraCommand.RANDOM_EVENTS;
const EVENT_SPAWN_CHANCE = auraCommand.EVENT_SPAWN_CHANCE;
const EVENT_COOLDOWN_MS = auraCommand.EVENT_COOLDOWN_MS;
const EVENT_CHANCE_MAX = auraCommand.EVENT_CHANCE_MAX;
const MOG_DURATION_MS = auraCommand.MOG_DURATION_MS;
const MOGNOW_COUNTDOWN_SEC = auraCommand.MOGNOW_COUNTDOWN_SEC;
const MOGNOW_WINDOW_MS = auraCommand.MOGNOW_WINDOW_MS;

const AURA_TIERS = [
    { minPoints: 50000, name: 'Deus do chat' },
    { minPoints: 10000, name: 'Entidade' },
    { minPoints: 5000,  name: 'Sigma' },
    { minPoints: 2000,  name: 'Dominante' },
    { minPoints: 500,   name: 'Presença' },
    { minPoints: 0,     name: 'NPC' }
];

const getAuraTier = (auraPoints) => {
    const points = Number(auraPoints) || 0;
    for (const tier of AURA_TIERS) {
        if (points >= tier.minPoints) return tier;
    }
    return AURA_TIERS[AURA_TIERS.length - 1];
};

const isUserKey = (k) => typeof k === 'string' && k.includes('@');

const backupsDir = path.join(__dirname, '..', '..', 'data', 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}

const authDir = path.join(__dirname, '..', '..', 'data', 'auth');
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
}

if (!fs.existsSync(BACKUP_FILE)) {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify({ deletedUsers: [] }, null, 2));
}

if (!fs.existsSync(AUTH_CODES_FILE)) {
    fs.writeFileSync(AUTH_CODES_FILE, JSON.stringify({}, null, 2));
}

if (!fs.existsSync(PENDING_MESSAGES_FILE)) {
    fs.writeFileSync(PENDING_MESSAGES_FILE, JSON.stringify({ pending: [] }, null, 2));
}

if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}, null, 2));
}

const readJsonFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Erro ao ler arquivo ${filePath}:`, error);
        return null;
    }
};

const writeJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Erro ao escrever arquivo ${filePath}:`, error);
        return false;
    }
};

const formatUserId = (id) => {
    let formattedId = id.trim();
    
    if (formattedId.includes('@')) {
        return formattedId;
    }
    
    return `${formattedId}@s.whatsapp.net`;
};

const getRequiredXP = (level) => {
    if (level < 10) {
        return 100 + (level - 1) * 10;
    } else {
        return 100 + (9 * 10) + (level - 10) * 100;
    }
};

const calculateUserProgress = (user) => {
    if (!user || !user.level) return null;
    
    let totalXPNeeded = 0;
    for (let i = 1; i < user.level; i++) {
        totalXPNeeded += getRequiredXP(i);
    }
    
    const nextLevelXP = getRequiredXP(user.level);
    
    const progressXP = Math.max(0, (user.xp || 0) - totalXPNeeded);
    
    const neededXP = Math.max(0, nextLevelXP - progressXP);
    
    return {
        progressXP: Math.min(progressXP, nextLevelXP),
        nextLevelXP,
        neededXP,
        progressPercent: Math.min(100, Math.round((progressXP / nextLevelXP) * 100))
    };
};

const enrichUserData = (user) => {
    const progress = calculateUserProgress(user);
    return {
        ...user,
        ...progress
    };
};

const cleanOldBackups = () => {
    try {
        const backupData = readJsonFile(BACKUP_FILE);
        if (!backupData || !backupData.deletedUsers) return;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const filteredUsers = backupData.deletedUsers.filter(user => {
            const deletedAt = new Date(user.deletedAt);
            return deletedAt > thirtyDaysAgo;
        });

        if (filteredUsers.length !== backupData.deletedUsers.length) {
            writeJsonFile(BACKUP_FILE, { deletedUsers: filteredUsers });
            console.log(`[Backup Cleanup] Removidos ${backupData.deletedUsers.length - filteredUsers.length} backups antigos`);
        }
    } catch (error) {
        console.error('Erro ao limpar backups antigos:', error);
    }
};

cleanOldBackups();
setInterval(cleanOldBackups, 24 * 60 * 60 * 1000);

const generateAuthCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateSessionToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
};

const cleanExpiredCodes = () => {
    try {
        const authCodes = readJsonFile(AUTH_CODES_FILE) || {};
        const now = Date.now();
        let changed = false;

        for (const [userId, data] of Object.entries(authCodes)) {
            if (data.expiresAt && new Date(data.expiresAt).getTime() < now) {
                delete authCodes[userId];
                changed = true;
            }
        }

        if (changed) {
            writeJsonFile(AUTH_CODES_FILE, authCodes);
        }
    } catch (error) {
        console.error('Erro ao limpar códigos expirados:', error);
    }
};

setInterval(cleanExpiredCodes, 60 * 1000);

app.post('/api/auth/getCode', (req, res) => {
    try {
        const { number } = req.body;

        if (!number) {
            return res.status(400).json({
                success: false,
                message: 'Número é obrigatório'
            });
        }

        const userId = formatUserId(number);
        const users = readJsonFile(USERS_FILE);

        if (!users || !users[userId]) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado na base de dados',
                userId: userId,
                exists: false
            });
        }

        const code = generateAuthCode();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const authCodes = readJsonFile(AUTH_CODES_FILE) || {};
        authCodes[userId] = {
            code,
            expiresAt,
            attempts: 0,
            createdAt: new Date().toISOString()
        };

        if (!writeJsonFile(AUTH_CODES_FILE, authCodes)) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao salvar código de autenticação'
            });
        }

        const pendingMessages = readJsonFile(PENDING_MESSAGES_FILE) || { pending: [] };
        pendingMessages.pending.push({
            to: userId,
            message: `*BreakerBot - Código de Verificação*\n\nSeu código de acesso é: *${code}*\n\nEste código expira em 5 minutos.\n\n_Se você não solicitou este código, ignore esta mensagem._`,
            createdAt: new Date().toISOString()
        });

        if (!writeJsonFile(PENDING_MESSAGES_FILE, pendingMessages)) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao enfileirar mensagem'
            });
        }

        res.json({
            success: true,
            message: 'Código enviado para o WhatsApp',
            userId: userId,
            expiresAt: expiresAt
        });
    } catch (error) {
        console.error('Erro ao gerar código:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { number, code } = req.body;

        if (!number || !code) {
            return res.status(400).json({
                success: false,
                message: 'Número e código são obrigatórios'
            });
        }

        const userId = formatUserId(number);
        const authCodes = readJsonFile(AUTH_CODES_FILE) || {};

        if (!authCodes[userId]) {
            return res.status(404).json({
                success: false,
                message: 'Nenhum código encontrado para este número. Solicite um novo código.'
            });
        }

        const authData = authCodes[userId];

        if (new Date(authData.expiresAt).getTime() < Date.now()) {
            delete authCodes[userId];
            writeJsonFile(AUTH_CODES_FILE, authCodes);
            return res.status(401).json({
                success: false,
                message: 'Código expirado. Solicite um novo código.'
            });
        }

        if (authData.attempts >= 3) {
            delete authCodes[userId];
            writeJsonFile(AUTH_CODES_FILE, authCodes);
            return res.status(429).json({
                success: false,
                message: 'Muitas tentativas incorretas. Solicite um novo código.'
            });
        }

        if (authData.code !== code) {
            authCodes[userId].attempts += 1;
            writeJsonFile(AUTH_CODES_FILE, authCodes);
            return res.status(401).json({
                success: false,
                message: 'Código incorreto',
                attemptsRemaining: 3 - authCodes[userId].attempts
            });
        }

        delete authCodes[userId];
        writeJsonFile(AUTH_CODES_FILE, authCodes);

        const sessionToken = generateSessionToken();
        const sessions = readJsonFile(SESSIONS_FILE) || {};
        sessions[sessionToken] = {
            userId: userId,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        if (!writeJsonFile(SESSIONS_FILE, sessions)) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao criar sessão'
            });
        }

        const users = readJsonFile(USERS_FILE);
        const user = users ? enrichUserData(users[userId]) : null;

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token: sessionToken,
            userId: userId,
            user: user,
            expiresAt: sessions[sessionToken].expiresAt
        });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.post('/api/auth/verify', (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token é obrigatório'
            });
        }

        const sessions = readJsonFile(SESSIONS_FILE) || {};

        if (!sessions[token]) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }

        const session = sessions[token];

        if (new Date(session.expiresAt).getTime() < Date.now()) {
            delete sessions[token];
            writeJsonFile(SESSIONS_FILE, sessions);
            return res.status(401).json({
                success: false,
                message: 'Sessão expirada'
            });
        }

        const users = readJsonFile(USERS_FILE);
        const user = users ? enrichUserData(users[session.userId]) : null;

        res.json({
            success: true,
            valid: true,
            userId: session.userId,
            user: user,
            expiresAt: session.expiresAt
        });
    } catch (error) {
        console.error('Erro ao verificar token:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.post('/api/auth/logout', (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token é obrigatório'
            });
        }

        const sessions = readJsonFile(SESSIONS_FILE) || {};

        if (sessions[token]) {
            delete sessions[token];
            writeJsonFile(SESSIONS_FILE, sessions);
        }

        res.json({
            success: true,
            message: 'Logout realizado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.get('/api/users', (req, res) => {
    try {
        const users = readJsonFile(USERS_FILE);
        
        if (!users) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao ler arquivo de usuários' 
            });
        }

        const usersArray = Object.entries(users).map(([id, data]) => ({
            id,
            ...enrichUserData(data)
        }));

        res.json({
            success: true,
            count: usersArray.length,
            users: usersArray
        });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.get('/api/users/:id', (req, res) => {
    try {
        const userId = formatUserId(req.params.id);
        const users = readJsonFile(USERS_FILE);

        if (!users) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao ler arquivo de usuários' 
            });
        }

        const user = users[userId];

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado',
                userId: userId,
                exists: false
            });
        }

        res.json({
            success: true,
            userId: userId,
            user: enrichUserData(user)
        });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.post('/api/users', (req, res) => {
    try {
        const { id, ...userData } = req.body;

        if (!id) {
            return res.status(400).json({ 
                success: false, 
                message: 'ID do usuário é obrigatório' 
            });
        }

        const userId = formatUserId(id);
        const users = readJsonFile(USERS_FILE);

        if (!users) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao ler arquivo de usuários' 
            });
        }

        if (users[userId]) {
            return res.status(409).json({ 
                success: false, 
                message: 'Usuário já existe na base de dados',
                userId: userId,
                existingUser: users[userId]
            });
        }

        const defaultUserData = {
            xp: 0,
            level: 1,
            prestige: 0,
            prestigeAvailable: 0,
            totalMessages: 0,
            lastMessageTime: new Date().toISOString(),
            badges: [],
            lastPrestigeLevel: 0,
            levelHistory: [],
            dailyBonusMultiplier: 0,
            dailyBonusExpiry: null,
            allowMentions: false,
            pushName: userData.pushName || null,
            customName: userData.customName || null,
            customNameEnabled: userData.customNameEnabled || false,
            jid: userData.jid || userId,
            profilePicture: userData.profilePicture || null,
            profilePictureUpdatedAt: userData.profilePictureUpdatedAt || null
        };

        const newUser = { ...defaultUserData, ...userData };
        users[userId] = newUser;

        if (!writeJsonFile(USERS_FILE, users)) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao salvar usuário' 
            });
        }

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            userId: userId,
            user: newUser
        });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.put('/api/users/:id', (req, res) => {
    try {
        const userId = formatUserId(req.params.id);
        const userData = req.body;
        const users = readJsonFile(USERS_FILE);

        if (!users) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao ler arquivo de usuários' 
            });
        }

        if (!users[userId]) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado',
                userId: userId
            });
        }

        users[userId] = { ...userData };

        if (!writeJsonFile(USERS_FILE, users)) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao atualizar usuário' 
            });
        }

        res.json({
            success: true,
            message: 'Usuário atualizado com sucesso',
            userId: userId,
            user: enrichUserData(users[userId])
        });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.patch('/api/users/:id', (req, res) => {
    try {
        const userId = formatUserId(req.params.id);
        const updates = req.body;
        const users = readJsonFile(USERS_FILE);

        if (!users) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao ler arquivo de usuários' 
            });
        }

        if (!users[userId]) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado',
                userId: userId
            });
        }

        users[userId] = { ...users[userId], ...updates };

        if (!writeJsonFile(USERS_FILE, users)) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao atualizar usuário' 
            });
        }

        res.json({
            success: true,
            message: 'Usuário atualizado parcialmente com sucesso',
            userId: userId,
            user: enrichUserData(users[userId])
        });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.delete('/api/users/:id', (req, res) => {
    try {
        const userId = formatUserId(req.params.id);
        const users = readJsonFile(USERS_FILE);

        if (!users) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao ler arquivo de usuários' 
            });
        }

        if (!users[userId]) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado',
                userId: userId
            });
        }

        const backupData = readJsonFile(BACKUP_FILE) || { deletedUsers: [] };
        const deletedUser = {
            id: userId,
            data: users[userId],
            deletedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };
        
        backupData.deletedUsers.push(deletedUser);
        
        if (!writeJsonFile(BACKUP_FILE, backupData)) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao criar backup do usuário' 
            });
        }

        const deletedUserData = users[userId];
        delete users[userId];

        if (!writeJsonFile(USERS_FILE, users)) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao remover usuário' 
            });
        }

        res.json({
            success: true,
            message: 'Usuário removido com sucesso. Backup criado por 30 dias.',
            userId: userId,
            deletedUser: deletedUserData,
            backupExpiresAt: deletedUser.expiresAt
        });
    } catch (error) {
        console.error('Erro ao remover usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.get('/api/backup/users', (req, res) => {
    try {
        const backupData = readJsonFile(BACKUP_FILE);

        if (!backupData) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao ler arquivo de backup' 
            });
        }

        res.json({
            success: true,
            count: backupData.deletedUsers.length,
            backups: backupData.deletedUsers
        });
    } catch (error) {
        console.error('Erro ao listar backups:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.post('/api/backup/restore/:id', (req, res) => {
    try {
        const userId = formatUserId(req.params.id);
        const backupData = readJsonFile(BACKUP_FILE);
        const users = readJsonFile(USERS_FILE);

        if (!backupData || !users) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao ler arquivos' 
            });
        }

        const backupIndex = backupData.deletedUsers.findIndex(u => u.id === userId);

        if (backupIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado no backup',
                userId: userId
            });
        }

        if (users[userId]) {
            return res.status(409).json({ 
                success: false, 
                message: 'Usuário já existe na base de dados. Delete-o primeiro se quiser restaurar.',
                userId: userId
            });
        }

        const restoredUser = backupData.deletedUsers[backupIndex];
        users[userId] = restoredUser.data;

        backupData.deletedUsers.splice(backupIndex, 1);

        if (!writeJsonFile(USERS_FILE, users) || !writeJsonFile(BACKUP_FILE, backupData)) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao restaurar usuário' 
            });
        }

        res.json({
            success: true,
            message: 'Usuário restaurado com sucesso',
            userId: userId,
            user: users[userId]
        });
    } catch (error) {
        console.error('Erro ao restaurar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.get('/api/daily-bonus', (req, res) => {
    try {
        const dailyBonus = readJsonFile(DAILY_BONUS_FILE);

        if (!dailyBonus) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao ler arquivo de bônus diário' 
            });
        }

        res.json({
            success: true,
            dailyBonus: dailyBonus
        });
    } catch (error) {
        console.error('Erro ao buscar bônus diário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.get('/api/mentions', (req, res) => {
    try {
        const mentions = readJsonFile(MENTIONS_FILE);

        if (!mentions) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao ler arquivo de menções' 
            });
        }

        res.json({
            success: true,
            mentions: mentions
        });
    } catch (error) {
        console.error('Erro ao buscar menções:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.put('/api/mentions', (req, res) => {
    try {
        const mentionsData = req.body;

        if (!writeJsonFile(MENTIONS_FILE, mentionsData)) {
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao atualizar menções' 
            });
        }

        res.json({
            success: true,
            message: 'Preferências de menções atualizadas',
            mentions: mentionsData
        });
    } catch (error) {
        console.error('Erro ao atualizar menções:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.get('/api/admins', (req, res) => {
    try {
        const adminsEnv = process.env.ADMINS;
        
        if (!adminsEnv) {
            return res.json({
                success: true,
                count: 0,
                admins: [],
                message: 'Nenhum administrador configurado no .env'
            });
        }

        const admins = adminsEnv.split(',').map(num => ({
            number: num.trim(),
            fullId: `${num.trim()}@s.whatsapp.net`
        }));

        res.json({
            success: true,
            count: admins.length,
            admins: admins
        });
    } catch (error) {
        console.error('Erro ao buscar admins:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.get('/api/amigo-secreto', (req, res) => {
    try {
        const amigoSecreto = readJsonFile(AMIGO_SECRETO_FILE);

        if (!amigoSecreto) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao ler arquivo do amigo secreto'
            });
        }

        const groups = Object.entries(amigoSecreto).map(([groupId, data]) => ({
            groupId,
            groupName: data.groupName,
            participantes: data.participantes || [],
            presentes: data.presentes || {},
            nomes: data.nomes || {},
            sorteio: data.sorteio || null,
            sorteioData: data.sorteioData || null,
            totalParticipantes: (data.participantes || []).length,
            sorteioRealizado: !!data.sorteio
        }));

        res.json({
            success: true,
            count: groups.length,
            groups: groups
        });
    } catch (error) {
        console.error('Erro ao buscar amigo secreto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.get('/api/amigo-secreto/user/:id', (req, res) => {
    try {
        let searchId = req.params.id.trim();
        
        if (!searchId.includes('@')) {
            searchId = `${searchId}@s.whatsapp.net`;
        }

        const amigoSecreto = readJsonFile(AMIGO_SECRETO_FILE);
        const users = readJsonFile(USERS_FILE);

        if (!amigoSecreto) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao ler arquivo do amigo secreto'
            });
        }

        let userIds = [searchId];

        if (users) {
            if (searchId.includes('@s.whatsapp.net') && users[searchId]?.jid) {
                userIds.push(users[searchId].jid);
            }
            
            for (const [oderId, userData] of Object.entries(users)) {
                if (userData.jid === searchId) {
                    userIds.push(oderId);
                }
            }
        }

        const userGroups = [];

        for (const [groupId, data] of Object.entries(amigoSecreto)) {
            const userIdInGroup = data.participantes?.find(p => userIds.includes(p));
            
            if (userIdInGroup) {
                let amigoSorteado = null;
                let presenteDoAmigo = null;
                let nomeDoAmigo = null;
                
                if (data.sorteio && data.sorteio[userIdInGroup]) {
                    amigoSorteado = data.sorteio[userIdInGroup];
                    presenteDoAmigo = data.presentes?.[amigoSorteado] || null;
                    nomeDoAmigo = data.nomes?.[amigoSorteado] || amigoSorteado.split('@')[0];
                }

                const participantesDetalhados = (data.participantes || []).map(p => ({
                    id: p,
                    nome: data.nomes?.[p] || p.split('@')[0],
                    presente: data.presentes?.[p] || null
                }));

                userGroups.push({
                    groupId,
                    groupName: data.groupName,
                    participantes: participantesDetalhados,
                    totalParticipantes: participantesDetalhados.length,
                    userIdInGroup,
                    meuNome: data.nomes?.[userIdInGroup] || userIdInGroup.split('@')[0],
                    meuPresente: data.presentes?.[userIdInGroup] || null,
                    sorteioRealizado: !!data.sorteio,
                    sorteioData: data.sorteioData || null,
                    amigoSorteado: amigoSorteado ? {
                        id: amigoSorteado,
                        nome: nomeDoAmigo,
                        presente: presenteDoAmigo
                    } : null
                });
            }
        }

        if (userGroups.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado em nenhum grupo de amigo secreto',
                searchedIds: userIds
            });
        }

        res.json({
            success: true,
            count: userGroups.length,
            searchedIds: userIds,
            groups: userGroups
        });
    } catch (error) {
        console.error('Erro ao buscar grupos do usuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.patch('/api/amigo-secreto/:groupId/presente', (req, res) => {
    try {
        const { groupId } = req.params;
        const { odI, presente } = req.body;

        if (!odI || presente === undefined) {
            return res.status(400).json({
                success: false,
                message: 'userId e presente são obrigatórios'
            });
        }

        let userIdFormatado = odI.trim();
        if (!userIdFormatado.includes('@')) {
            userIdFormatado = `${userIdFormatado}@s.whatsapp.net`;
        }

        const amigoSecreto = readJsonFile(AMIGO_SECRETO_FILE);

        if (!amigoSecreto) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao ler arquivo do amigo secreto'
            });
        }

        if (!amigoSecreto[groupId]) {
            return res.status(404).json({
                success: false,
                message: 'Grupo não encontrado'
            });
        }

        const group = amigoSecreto[groupId];
        const users = readJsonFile(USERS_FILE);
        
        let participantId = null;
        
        if (group.participantes.includes(userIdFormatado)) {
            participantId = userIdFormatado;
        } else {
            for (const pId of group.participantes) {
                if (users && users[pId]?.jid === userIdFormatado) {
                    participantId = pId;
                    break;
                }
                if (users && users[userIdFormatado]?.jid === pId) {
                    participantId = pId;
                    break;
                }
            }
        }

        if (!participantId) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não é participante deste grupo'
            });
        }

        if (!group.presentes) {
            group.presentes = {};
        }

        if (presente.trim() === '') {
            delete group.presentes[participantId];
        } else {
            group.presentes[participantId] = presente.trim();
        }

        if (!writeJsonFile(AMIGO_SECRETO_FILE, amigoSecreto)) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao salvar presente'
            });
        }

        res.json({
            success: true,
            message: 'Presente atualizado com sucesso',
            groupId: groupId,
            odI: participantId,
            presente: presente.trim() || null
        });

    } catch (error) {
        console.error('Erro ao atualizar presente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.get('/api/aura/ranking', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
        const users = readJsonFile(USERS_FILE);
        if (!users) {
            return res.status(500).json({ success: false, message: 'Erro ao ler usuários' });
        }
        const entries = [];
        for (const [userId, data] of Object.entries(users)) {
            if (!isUserKey(userId) || !data?.aura) continue;
            const auraPoints = data.aura.auraPoints ?? 0;
            entries.push({
                userId,
                auraPoints,
                tierName: getAuraTier(auraPoints).name,
                displayName: data.customNameEnabled && data.customName ? data.customName : (data.pushName || userId.split('@')[0])
            });
        }
        entries.sort((a, b) => b.auraPoints - a.auraPoints);
        const ranking = entries.slice(0, limit);
        res.json({
            success: true,
            limit,
            ranking,
            tiers: AURA_TIERS
        });
    } catch (error) {
        console.error('Erro ao buscar ranking de aura:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

app.get('/api/aura/users/:id', (req, res) => {
    try {
        const requestedId = formatUserId(req.params.id);
        const users = readJsonFile(USERS_FILE);
        if (!users) {
            return res.status(500).json({ success: false, message: 'Erro ao ler usuários' });
        }
        let userId = requestedId;
        let user = users[userId];
        if (!user) {
            for (const [uid, data] of Object.entries(users)) {
                if (!isUserKey(uid)) continue;
                if (data.jid === requestedId || uid === requestedId) {
                    user = data;
                    userId = uid;
                    break;
                }
            }
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuário não encontrado',
                    userId: requestedId
                });
            }
        }
        const aura = user.aura || {
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
        const tier = getAuraTier(aura.auraPoints ?? 0);
        const displayName = user.customNameEnabled && user.customName ? user.customName : (user.pushName || userId.split('@')[0]);
        const auraKey = getAuraKey(userId);
        const praisedBy = auraKey ? (getWhoPraised(auraKey) || []) : [];
        res.json({
            success: true,
            userId,
            displayName,
            aura: {
                auraPoints: aura.auraPoints ?? 0,
                stickerHash: aura.stickerHash ?? null,
                character: aura.character ?? null,
                hasStickerHash: !!(aura.stickerHash),
                dailyMissions: aura.dailyMissions ?? null,
                lastRitualDate: aura.lastRitualDate ?? null,
                lastTreinarAt: aura.lastTreinarAt ?? null,
                lastDominarAt: aura.lastDominarAt ?? null,
                tierName: tier.name,
                tierMinPoints: tier.minPoints
            },
            praisedBy,
            profile: {
                pushName: user.pushName ?? null,
                customName: user.customName ?? null,
                customNameEnabled: !!user.customNameEnabled
            }
        });
    } catch (error) {
        console.error('Erro ao buscar aura do usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

app.get('/api/aura/tiers', (req, res) => {
    try {
        res.json({
            success: true,
            tiers: AURA_TIERS
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

app.get('/api/aura/config', (req, res) => {
    try {
        res.json({
            success: true,
            tiers: AURA_TIERS,
            missionIds: MISSION_IDS,
            missionConfig: MISSION_CONFIG,
            randomEvents: RANDOM_EVENTS,
            eventSpawnChance: EVENT_SPAWN_CHANCE,
            eventCooldownMs: EVENT_COOLDOWN_MS,
            eventChanceMax: EVENT_CHANCE_MAX,
            mogDurationMs: MOG_DURATION_MS,
            mognowCountdownSec: MOGNOW_COUNTDOWN_SEC,
            mognowWindowMs: MOGNOW_WINDOW_MS
        });
    } catch (error) {
        console.error('Erro ao buscar config de aura:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

app.get('/api/aura/global', (req, res) => {
    try {
        const users = readJsonFile(USERS_FILE);
        const globalKey = '__auraGlobal';
        const global = (users && users[globalKey]) ? users[globalKey] : {};
        res.json({
            success: true,
            pendingMogByChat: global.pendingMogByChat ?? {}
        });
    } catch (error) {
        console.error('Erro ao buscar dados globais de aura:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

app.get('/api/aura/praised', (req, res) => {
    try {
        const praised = readJsonFile(PRAISED_FILE) || {};
        res.json({
            success: true,
            praised
        });
    } catch (error) {
        console.error('Erro ao buscar praised:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'BreakerBot API',
        version: '1.0.0',
        endpoints: {
            auth: {
                'POST /api/auth/getCode': 'Solicita código de verificação (body: { number })',
                'POST /api/auth/login': 'Faz login com código (body: { number, code })',
                'POST /api/auth/verify': 'Verifica se token é válido (body: { token })',
                'POST /api/auth/logout': 'Encerra sessão (body: { token })'
            },
            users: {
                'GET /api/users': 'Lista todos os usuários',
                'GET /api/users/:id': 'Busca usuário específico',
                'POST /api/users': 'Cria novo usuário',
                'PUT /api/users/:id': 'Atualiza usuário (completo)',
                'PATCH /api/users/:id': 'Atualiza usuário (parcial)',
                'DELETE /api/users/:id': 'Remove usuário (com backup)'
            },
            backup: {
                'GET /api/backup/users': 'Lista usuários deletados',
                'POST /api/backup/restore/:id': 'Restaura usuário do backup'
            },
            dailyBonus: {
                'GET /api/daily-bonus': 'Retorna dados do bônus diário'
            },
            mentions: {
                'GET /api/mentions': 'Retorna preferências de menções',
                'PUT /api/mentions': 'Atualiza preferências de menções'
            },
            admins: {
                'GET /api/admins': 'Lista administradores'
            },
            amigoSecreto: {
                'GET /api/amigo-secreto': 'Lista todos os grupos de amigo secreto',
                'GET /api/amigo-secreto/user/:id': 'Lista grupos do usuário (aceita @s.whatsapp.net ou @lid)',
                'PATCH /api/amigo-secreto/:groupId/presente': 'Atualiza presente desejado do usuário no grupo'
            },
            aura: {
                'GET /api/aura/ranking': 'Ranking de aura (query: limit, default 10). Retorna ranking, tier de cada um e lista de tiers.',
                'GET /api/aura/users/:id': 'Todos os dados de aura do usuário: auraPoints, stickerHash, character, dailyMissions (completo), cooldowns (ritual, treinar, dominar), praisedBy, perfil.',
                'GET /api/aura/tiers': 'Lista níveis de aura (NPC, Presença, Dominante, Sigma, Entidade, Deus do chat)',
                'GET /api/aura/config': 'Config completa: tiers, missionIds, missionConfig, randomEvents, eventSpawnChance, eventCooldownMs, eventChanceMax, mogDurationMs, mognowCountdownSec, mognowWindowMs',
                'GET /api/aura/global': 'Dados globais de aura: pendingMogByChat (desafios de duelo pendentes por chat)',
                'GET /api/aura/praised': 'Mapa completo de elogios: por userId (quem foi elogiado), lista de userIds que elogiaram'
            },
            health: {
                'GET /api/health': 'Status da API'
            }
        }
    });
});

app.listen(PORT, HOST, () => {
    console.log(`\n========================================`);
    console.log(`  BreakerBot API - ${process.env.NODE_ENV || 'development'}`);
    console.log(`========================================`);
    console.log(`  Host: ${HOST}`);
    console.log(`  Porta: ${PORT}`);
    console.log(`  CORS: ${process.env.CORS_ORIGINS || 'localhost apenas'}`);
    console.log(`  Documentação: http://localhost:${PORT}/`);
    console.log(`========================================\n`);
});

module.exports = app;
