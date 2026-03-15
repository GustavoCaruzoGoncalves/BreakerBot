const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.API_PORT || 3001;
const HOST = process.env.API_HOST || '0.0.0.0';

const repo = require('../database/repository');

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id']
};

app.use(cors(corsOptions));

app.options('*', cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

app.set('trust proxy', 1);

const auraCommand = require('../commands/aura/auraCommand');
const { levelSystem } = require('../commands/level/levelCommand');
const auraSystem = auraCommand.auraSystem;
const getAuraKey = auraCommand.getAuraKey;
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

const cleanOldBackups = async () => {
    try {
        const removed = await repo.cleanOldDeletedUsers(30);
        if (removed > 0) {
            console.log(`[Backup Cleanup] Removidos ${removed} backups antigos`);
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

const cleanExpiredCodes = async () => {
    try {
        await repo.cleanExpiredAuthCodes();
    } catch (error) {
        console.error('Erro ao limpar códigos expirados:', error);
    }
};

setInterval(cleanExpiredCodes, 60 * 1000);

app.post('/api/auth/getCode', async (req, res) => {
    try {
        const { number } = req.body;

        if (!number) {
            return res.status(400).json({
                success: false,
                message: 'Número é obrigatório'
            });
        }

        const userId = formatUserId(number);
        const user = await repo.getUserById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado na base de dados',
                userId: userId,
                exists: false
            });
        }

        const code = generateAuthCode();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        await repo.setAuthCode(userId, {
            code,
            expiresAt,
            attempts: 0,
            createdAt: new Date().toISOString()
        });

        const msg = `*BreakerBot - Código de Verificação*\n\nSeu código de acesso é: *${code}*\n\nEste código expira em 5 minutos.\n\n_Se você não solicitou este código, ignore esta mensagem._`;
        await repo.addPendingMessage(userId, msg);

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

app.post('/api/auth/login', async (req, res) => {
    try {
        const { number, code } = req.body;

        if (!number || !code) {
            return res.status(400).json({
                success: false,
                message: 'Número e código são obrigatórios'
            });
        }

        const userId = formatUserId(number);
        const authData = await repo.getAuthCode(userId);

        if (!authData) {
            return res.status(404).json({
                success: false,
                message: 'Nenhum código encontrado para este número. Solicite um novo código.'
            });
        }

        if (new Date(authData.expiresAt).getTime() < Date.now()) {
            await repo.deleteAuthCode(userId);
            return res.status(401).json({
                success: false,
                message: 'Código expirado. Solicite um novo código.'
            });
        }

        if (authData.attempts >= 3) {
            await repo.deleteAuthCode(userId);
            return res.status(429).json({
                success: false,
                message: 'Muitas tentativas incorretas. Solicite um novo código.'
            });
        }

        if (authData.code !== code) {
            const updated = await repo.incrementAuthCodeAttempts(userId);
            return res.status(401).json({
                success: false,
                message: 'Código incorreto',
                attemptsRemaining: 3 - updated.attempts
            });
        }

        await repo.deleteAuthCode(userId);

        const sessionToken = generateSessionToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await repo.setSession(sessionToken, {
            userId,
            createdAt: new Date().toISOString(),
            expiresAt
        });

        const user = await repo.getUserById(userId);

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token: sessionToken,
            userId: userId,
            user: user ? enrichUserData(user) : null,
            expiresAt
        });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.post('/api/auth/verify', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token é obrigatório'
            });
        }

        const session = await repo.getSession(token);

        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }

        if (new Date(session.expiresAt).getTime() < Date.now()) {
            await repo.deleteSession(token);
            return res.status(401).json({
                success: false,
                message: 'Sessão expirada'
            });
        }

        const user = await repo.getUserById(session.userId);

        res.json({
            success: true,
            valid: true,
            userId: session.userId,
            user: user ? enrichUserData(user) : null,
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

app.post('/api/auth/logout', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token é obrigatório'
            });
        }

        await repo.deleteSession(token);

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

app.get('/api/users', async (req, res) => {
    try {
        const users = await repo.getAllUsers();
        const usersArray = Object.entries(users)
            .filter(([id]) => isUserKey(id))
            .map(([id, data]) => ({
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

app.get('/api/users/:id', async (req, res) => {
    try {
        const userId = formatUserId(req.params.id);
        const user = await repo.getUserById(userId);

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

app.post('/api/users', async (req, res) => {
    try {
        const body = req.body || {};
        const { id, ...userData } = body;

        if (!id) {
            return res.status(400).json({ 
                success: false, 
                message: 'ID do usuário é obrigatório' 
            });
        }

        const userId = formatUserId(String(id).trim());
        const existing = await repo.getUserById(userId);

        if (existing) {
            return res.status(409).json({ 
                success: false, 
                message: 'Usuário já existe na base de dados',
                userId: userId,
                existingUser: existing
            });
        }

        const newUser = await repo.createUser(userId, userData);
        levelSystem.invalidateCache();

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            userId: userId,
            user: enrichUserData(newUser)
        });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Erro interno do servidor' 
        });
    }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const userId = formatUserId(req.params.id);
        const userData = req.body;
        const existing = await repo.getUserById(userId);

        if (!existing) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado',
                userId: userId
            });
        }

        const user = await repo.updateUser(userId, userData);
        levelSystem.invalidateCache();

        res.json({
            success: true,
            message: 'Usuário atualizado com sucesso',
            userId: userId,
            user: enrichUserData(user)
        });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.patch('/api/users/:id', async (req, res) => {
    try {
        const userId = formatUserId(String(req.params.id || '').trim());
        const updates = req.body || {};
        const { aura, ...userUpdates } = updates;
        const user = await repo.patchUser(userId, userUpdates);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado',
                userId: userId
            });
        }

        if (aura && typeof aura === 'object') {
            const existing = await repo.getUserById(userId);
            const mergedAura = { ...(existing?.aura || {}), ...aura };
            await repo.updateAura(userId, mergedAura);
        }

        levelSystem.invalidateCache();
        const updatedUser = await repo.getUserById(userId);
        res.json({
            success: true,
            message: 'Usuário atualizado parcialmente com sucesso',
            userId: userId,
            user: enrichUserData(updatedUser)
        });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Erro interno do servidor' 
        });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const userId = formatUserId(req.params.id);
        const user = await repo.getUserById(userId);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado',
                userId: userId
            });
        }

        const deletedUser = await repo.addDeletedUser(userId, user);
        await repo.deleteUser(userId);
        levelSystem.invalidateCache();

        res.json({
            success: true,
            message: 'Usuário removido com sucesso. Backup criado por 30 dias.',
            userId: userId,
            deletedUser: user,
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

const isAdminRequest = (req) => {
    const userId = req.headers['x-user-id'] || req.query.adminUserId;
    if (!userId) return false;
    const adminsEnv = process.env.ADMINS;
    if (!adminsEnv) return false;
    const admins = adminsEnv.split(',').map(n => `${n.trim()}@s.whatsapp.net`);
    const normalized = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
    return admins.includes(normalized);
};

app.get('/api/admin/users/export', async (req, res) => {
    if (!isAdminRequest(req)) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Apenas administradores.' });
    }
    try {
        const users = await repo.getAllUsers();
        const exportData = {};
        for (const [key, val] of Object.entries(users)) {
            if (key === '__auraGlobal' || key === 'pendingMogByChat') continue;
            if (typeof key !== 'string' || !key.includes('@')) continue;
            if (val && typeof val === 'object') exportData[key] = val;
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="users-export.json"');
        res.send(JSON.stringify(exportData, null, 2));
    } catch (error) {
        console.error('Erro ao exportar usuários:', error);
        res.status(500).json({ success: false, message: error.message || 'Erro ao exportar' });
    }
});

app.post('/api/admin/users/import', async (req, res) => {
    if (!isAdminRequest(req)) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Apenas administradores.' });
    }
    try {
        const data = req.body;
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ success: false, message: 'JSON inválido. Envie um objeto com usuários.' });
        }
        const usersData = {};
        for (const [key, val] of Object.entries(data)) {
            if (key === '__auraGlobal' || key === 'pendingMogByChat') continue;
            if (typeof key !== 'string' || !key.includes('@')) continue;
            if (val && typeof val === 'object') usersData[key] = val;
        }
        await repo.saveAllUsers(usersData);
        levelSystem.invalidateCache();
        res.json({
            success: true,
            message: 'Importação concluída com sucesso',
            imported: Object.keys(usersData).length
        });
    } catch (error) {
        console.error('Erro ao importar usuários:', error);
        res.status(500).json({ success: false, message: error.message || 'Erro ao importar' });
    }
});

app.get('/api/backup/users', async (req, res) => {
    try {
        const backups = await repo.getDeletedUsers();

        res.json({
            success: true,
            count: backups.length,
            backups
        });
    } catch (error) {
        console.error('Erro ao listar backups:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.post('/api/backup/restore/:id', async (req, res) => {
    try {
        const userId = formatUserId(req.params.id);
        const backups = await repo.getDeletedUsers();
        const backupEntry = backups.find(u => u.id === userId);

        if (!backupEntry) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado no backup',
                userId: userId
            });
        }

        const existing = await repo.getUserById(userId);
        if (existing) {
            return res.status(409).json({ 
                success: false, 
                message: 'Usuário já existe na base de dados. Delete-o primeiro se quiser restaurar.',
                userId: userId
            });
        }

        const userData = backupEntry.data;
        await repo.restoreUser(userId, userData);
        await repo.removeDeletedUser(userId);
        levelSystem.invalidateCache();

        const user = await repo.getUserById(userId);

        res.json({
            success: true,
            message: 'Usuário restaurado com sucesso',
            userId: userId,
            user
        });
    } catch (error) {
        console.error('Erro ao restaurar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.get('/api/daily-bonus', async (req, res) => {
    try {
        const dailyBonus = await repo.getDailyBonus();

        res.json({
            success: true,
            dailyBonus
        });
    } catch (error) {
        console.error('Erro ao buscar bônus diário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.get('/api/mentions', async (req, res) => {
    try {
        const mentions = await repo.getMentionsPreferences();

        res.json({
            success: true,
            mentions
        });
    } catch (error) {
        console.error('Erro ao buscar menções:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.put('/api/mentions', async (req, res) => {
    try {
        const mentionsData = req.body;
        const mentions = await repo.updateMentionsPreferences(mentionsData);

        res.json({
            success: true,
            message: 'Preferências de menções atualizadas',
            mentions
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

app.get('/api/amigo-secreto', async (req, res) => {
    try {
        const amigoSecreto = await repo.getAmigoSecretoAll();

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
            groups
        });
    } catch (error) {
        console.error('Erro ao buscar amigo secreto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.get('/api/amigo-secreto/user/:id', async (req, res) => {
    try {
        let searchId = req.params.id.trim();
        
        if (!searchId.includes('@')) {
            searchId = `${searchId}@s.whatsapp.net`;
        }

        const amigoSecreto = await repo.getAmigoSecretoAll();
        const users = await repo.getAllUsers();

        let userIds = [searchId];

        if (users) {
            if (searchId.includes('@s.whatsapp.net') && users[searchId]?.jid) {
                userIds.push(users[searchId].jid);
            }
            
            for (const [oderId, userData] of Object.entries(users)) {
                if (userData && userData.jid === searchId) {
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

app.patch('/api/amigo-secreto/:groupId/presente', async (req, res) => {
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

        const amigoSecreto = await repo.getAmigoSecretoAll();

        if (!amigoSecreto[groupId]) {
            return res.status(404).json({
                success: false,
                message: 'Grupo não encontrado'
            });
        }

        const group = amigoSecreto[groupId];
        const users = await repo.getAllUsers();
        
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

        await repo.updateAmigoSecretoPresente(groupId, participantId, presente.trim() === '' ? '' : presente.trim());

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

app.get('/api/aura/ranking', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
        const rows = await repo.getAuraRanking(limit);
        const users = await repo.getAllUsers();
        const ranking = rows.map(row => {
            const data = users[row.userId];
            return {
                userId: row.userId,
                auraPoints: row.auraPoints,
                tierName: getAuraTier(row.auraPoints).name,
                displayName: data && (data.customNameEnabled && data.customName ? data.customName : (data.pushName || row.userId.split('@')[0])) || row.userId.split('@')[0],
                character: data?.aura?.character ?? null
            };
        });
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

app.get('/api/aura/users/:id', async (req, res) => {
    try {
        const requestedId = formatUserId(req.params.id);
        const users = await repo.getAllUsers();
        let userId = requestedId;
        let user = users[userId];
        if (!user) {
            for (const [uid, data] of Object.entries(users)) {
                if (!isUserKey(uid) || !data) continue;
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
        const auraKey = await getAuraKey(userId);
        const praisedBy = auraKey ? (await repo.getWhoPraised(auraKey) || []) : [];
        res.json({
            success: true,
            userId,
            displayName,
            aura: {
                auraPoints: aura.auraPoints ?? 0,
                stickerHash: aura.stickerHash ?? null,
                stickerDataUrl: aura.stickerDataUrl ?? null,
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

app.get('/api/aura/global', async (req, res) => {
    try {
        const global = await repo.getAuraGlobal();
        res.json({
            success: true,
            pendingMogByChat: global.pendingMogByChat ?? {}
        });
    } catch (error) {
        console.error('Erro ao buscar dados globais de aura:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

app.get('/api/aura/praised', async (req, res) => {
    try {
        const praised = await repo.getAllPraised();
        res.json({
            success: true,
            praised
        });
    } catch (error) {
        console.error('Erro ao buscar praised:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Slot machine (caça-níqueis) com tema de aura
const SLOT_SYMBOLS = [
    { id: 'fire', emoji: '🔥', weight: 5, pay: [0, 1, 5, 20] },
    { id: 'crystal', emoji: '✨', weight: 4, pay: [0, 2, 3, 15] },
    { id: 'star', emoji: '🌟', weight: 3, pay: [0, 3, 4, 10] },
    { id: 'diamond', emoji: '💎', weight: 2, pay: [0, 5, 20, 50] },
    { id: 'god', emoji: '👑', weight: 1, pay: [0, 10, 50, 100] },
    { id: 'wild', emoji: '💀', weight: 2, pay: [0, 0, 0, 0] }
];

function pickRandomSymbol() {
    const totalWeight = SLOT_SYMBOLS.reduce((s, sym) => s + sym.weight, 0);
    let r = Math.random() * totalWeight;
    for (const sym of SLOT_SYMBOLS) {
        r -= sym.weight;
        if (r <= 0) return sym;
    }
    return SLOT_SYMBOLS[0];
}

function calcSlotWin(reels, bet) {
    const [c0, c1, c2] = reels;
    let totalWin = 0;
    const lines = [
        [c0[0], c1[0], c2[0]],
        [c0[1], c1[1], c2[1]],
        [c0[2], c1[2], c2[2]]
    ];
    for (const line of lines) {
        const [a, b, c] = line;
        const isWild = (s) => s.id === 'wild';
        const syms = [a, b, c].filter(x => !isWild(x));
        const wilds = [a, b, c].filter(isWild).length;
        if (syms.length === 0) {
            totalWin += bet * 50;
            continue;
        }
        const sym = syms[0];
        const count = syms.filter(s => s.id === sym.id).length + wilds;
        if (count === 3) {
            totalWin += bet * sym.pay[3];
        }
    }
    return totalWin;
}

app.post('/api/aura/slot', async (req, res) => {
    try {
        const { token, bet } = req.body;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Token é obrigatório' });
        }
        const session = await repo.getSession(token);
        if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
            return res.status(401).json({ success: false, message: 'Sessão inválida ou expirada' });
        }
        const userId = session.userId;
        const auraKey = await getAuraKey(userId);
        if (!auraKey) {
            return res.status(400).json({ success: false, message: 'Usuário não encontrado no sistema de aura' });
        }
        const betAmount = Math.floor(Number(bet) || 0);
        if (betAmount < 1) {
            return res.status(400).json({
                success: false,
                message: 'Aposta mínima: 1 aura'
            });
        }
        const userAura = await auraSystem.getUserAura(auraKey);
        const balance = userAura?.auraPoints ?? 0;
        if (balance < betAmount) {
            return res.status(400).json({
                success: false,
                message: 'Saldo insuficiente',
                balance
            });
        }
        await auraSystem.addAuraPoints(auraKey, -betAmount);
        const reels = [
            [pickRandomSymbol(), pickRandomSymbol(), pickRandomSymbol()],
            [pickRandomSymbol(), pickRandomSymbol(), pickRandomSymbol()],
            [pickRandomSymbol(), pickRandomSymbol(), pickRandomSymbol()]
        ];
        const winAmount = calcSlotWin(reels, betAmount);
        const netChange = winAmount - betAmount;
        if (netChange > 0) {
            await auraSystem.addAuraPoints(auraKey, netChange);
        }
        const newBalance = balance - betAmount + winAmount;
        res.json({
            success: true,
            reels: reels.map(col => col.map(s => ({ id: s.id, emoji: s.emoji }))),
            bet: betAmount,
            win: winAmount,
            netChange,
            balance: newBalance
        });
    } catch (error) {
        console.error('Erro no slot:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

app.post('/api/aura/game-reward', async (req, res) => {
    try {
        const { token, game, score } = req.body;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Token é obrigatório' });
        }
        if (!game) {
            return res.status(400).json({ success: false, message: 'Dados inválidos' });
        }
        const scoreNum = Number(score);
        if (Number.isNaN(scoreNum)) {
            return res.status(400).json({ success: false, message: 'Dados inválidos' });
        }
        const session = await repo.getSession(token);
        if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
            return res.status(401).json({ success: false, message: 'Sessão inválida ou expirada' });
        }
        const userId = session.userId;
        const auraKey = await getAuraKey(userId);
        if (!auraKey) {
            return res.status(400).json({ success: false, message: 'Usuário não encontrado no sistema de aura' });
        }
        const reward = Math.floor(scoreNum);
        if (reward !== 0) {
            await auraSystem.addAuraPoints(auraKey, reward);
        }
        const userAura = await auraSystem.getUserAura(auraKey);
        const balance = userAura?.auraPoints ?? 0;
        res.json({
            success: true,
            reward,
            balance
        });
    } catch (error) {
        console.error('Erro no game-reward:', error);
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

const { initDatabase } = require('../database/init');

async function startApi() {
    const initOk = await initDatabase();
    if (!initOk) {
        console.warn('[DB] Init falhou - a API iniciará, mas funcionalidades que usam o banco podem não funcionar.');
    }
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
}

startApi();

module.exports = app;
