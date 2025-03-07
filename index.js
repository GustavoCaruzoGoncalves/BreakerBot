const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const commandsBot = require('./commands');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log("Escaneie o QR Code para conectar:");
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log("Conexão fechada, tentando reconectar:", shouldReconnect);
            if (shouldReconnect) connectBot();
        } else if (connection === 'open') {
            console.log("Bot conectado com sucesso!");
        }
    });
    
    sock.ev.on('messages.upsert', async (messages) => {
        await commandsBot(sock, messages);
    });
}

startBot();
