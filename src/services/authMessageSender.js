const fs = require('fs');
const path = require('path');

const PENDING_MESSAGES_FILE = path.join(__dirname, '..', '..', 'data', 'auth', 'pending_messages.json');
const MAX_RETRIES = 3;
const MESSAGE_EXPIRY_MS = 5 * 60 * 1000;

let isProcessing = false;

const readJsonFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`[Auth] Erro ao ler arquivo ${filePath}:`, error.message);
        return null;
    }
};

const writeJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`[Auth] Erro ao escrever arquivo ${filePath}:`, error.message);
        return false;
    }
};

const isSocketReady = (sock) => {
    try {
        return sock && sock.user && typeof sock.sendMessage === 'function';
    } catch {
        return false;
    }
};

async function processPendingAuthMessages(sock) {
    if (isProcessing) {
        return;
    }

    isProcessing = true;

    try {
        if (!isSocketReady(sock)) {
            return;
        }

        const pendingData = readJsonFile(PENDING_MESSAGES_FILE);
        
        if (!pendingData || !pendingData.pending || pendingData.pending.length === 0) {
            return;
        }

        const now = Date.now();
        const messagesToKeep = [];
        const messagesToProcess = [];

        for (const msg of pendingData.pending) {
            const createdAt = new Date(msg.createdAt).getTime();
            const isExpired = (now - createdAt) > MESSAGE_EXPIRY_MS;
            
            if (isExpired) {
                console.log(`[Auth] Mensagem para ${msg.to} expirada, removendo...`);
                continue;
            }

            messagesToProcess.push(msg);
        }

        for (const msg of messagesToProcess) {
            try {
                await sock.sendMessage(msg.to, { text: msg.message });
                console.log(`[Auth] Código enviado para ${msg.to}`);
            } catch (err) {
                console.error(`[Auth] Erro ao enviar mensagem para ${msg.to}:`, err.message);
                
                const retries = (msg.retries || 0) + 1;
                
                if (retries < MAX_RETRIES) {
                    messagesToKeep.push({
                        ...msg,
                        retries,
                        lastError: err.message,
                        lastAttempt: new Date().toISOString()
                    });
                    console.log(`[Auth] Tentativa ${retries}/${MAX_RETRIES} falhou para ${msg.to}, tentará novamente...`);
                } else {
                    console.error(`[Auth] Máximo de tentativas atingido para ${msg.to}, removendo mensagem.`);
                }
            }
        }

        pendingData.pending = messagesToKeep;
        writeJsonFile(PENDING_MESSAGES_FILE, pendingData);

    } catch (error) {
        console.error('[Auth] Erro ao processar mensagens pendentes:', error);
    } finally {
        isProcessing = false;
    }
}

function startAuthMessageProcessor(sock) {
    setTimeout(() => {
        processPendingAuthMessages(sock);
    }, 3000);
    
    setInterval(() => {
        processPendingAuthMessages(sock);
    }, 2000);
    
    console.log('[Auth] Processador de mensagens de autenticação iniciado');
}

module.exports = { startAuthMessageProcessor, processPendingAuthMessages };
