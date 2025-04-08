const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');  
const imagesCommandsBot = require('./imagesCommands');
const audioCommandsBot = require('./audioCommands');
const jokesCommandsBot = require('./jokesCommands');
const menuCommandBot = require('./menuCommand');
const gptCommandBot = require('./gptCommand');
const gamesCommandsBot = require('./gamesCommands');
const grokCommandBot = require('./grokCommand');

const isWindows = os.platform() === 'win32';
const clearCommand = isWindows ? 'cls' : 'clear';

const logError = (error) => {
    const errorMsg = `[${new Date().toISOString()}] ${error.stack || error.message || error}\n`;
    fs.appendFileSync('error.log', errorMsg);
};

process.on('uncaughtException', (err) => {
    console.error('Erro não capturado:', err);
    logError(err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição não tratada em:', promise, 'Motivo:', reason);
    logError(reason);
});

async function connectBot() {
    try {
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
            }
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                console.log("Conexão fechada, tentando reconectar:", shouldReconnect);
                if (shouldReconnect) {
                    connectBot()
                };
            } else if (connection === 'open') {
                console.log("Bot conectado com sucesso!");
            }
        });

        sock.ev.on('messages.upsert', async (messages) => {
            try {
                await imagesCommandsBot(sock, messages);
                await audioCommandsBot(sock, messages);
                await jokesCommandsBot(sock, messages);
                await menuCommandBot(sock, messages);
                await gptCommandBot(sock, messages);
                await gamesCommandsBot(sock, messages);
                await grokCommandBot(sock, messages);
            } catch (err) {
                console.error('Erro ao processar mensagem:', err);
                logError(err);
            }
        });

    } catch (err) {
        console.error('Erro ao iniciar o bot:', err);
        logError(err);
        setTimeout(connectBot, 5000);
    }
}

connectBot();
