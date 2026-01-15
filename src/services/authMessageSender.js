const fs = require('fs');
const path = require('path');

const PENDING_MESSAGES_FILE = path.join(__dirname, '..', '..', 'data', 'auth', 'pending_messages.json');

const readJsonFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
};

const writeJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        return false;
    }
};

async function processPendingAuthMessages(sock) {
    try {
        const pendingData = readJsonFile(PENDING_MESSAGES_FILE);
        
        if (!pendingData || !pendingData.pending || pendingData.pending.length === 0) {
            return;
        }

        const messagesToSend = [...pendingData.pending];
        pendingData.pending = [];
        writeJsonFile(PENDING_MESSAGES_FILE, pendingData);

        for (const msg of messagesToSend) {
            try {
                await sock.sendMessage(msg.to, { text: msg.message });
                console.log(`[Auth] Código enviado para ${msg.to}`);
            } catch (err) {
                console.error(`[Auth] Erro ao enviar mensagem para ${msg.to}:`, err.message);
            }
        }
    } catch (error) {
        console.error('[Auth] Erro ao processar mensagens pendentes:', error);
    }
}

function startAuthMessageProcessor(sock) {
    processPendingAuthMessages(sock);
    
    setInterval(() => {
        processPendingAuthMessages(sock);
    }, 2000);
    
    console.log('[Auth] Processador de mensagens de autenticação iniciado');
}

module.exports = { startAuthMessageProcessor, processPendingAuthMessages };
