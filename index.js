const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const imagesCommandsBot = require('./imagesCommands');
const audioCommandsBot = require('./audioCommands');
const jokesCommandsBot = require('./jokesCommands')
const menuCommandBot = require('./menuCommand')
const gptCommandBot = require('./gptCommand')
const gamesCommandsBot = require('./gamesCommands')

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
        await imagesCommandsBot(sock, messages);
        await audioCommandsBot(sock, messages);
        await jokesCommandsBot(sock, messages);
        await menuCommandBot(sock, messages);
        await gptCommandBot(sock, messages);
        await gamesCommandsBot(sock, messages)
    });
}

startBot();
