const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const imagesCommandsBot = require('./imagesCommands');
const audioCommandsBot = require('./audioCommands');
const jokesCommandsBot = require('./jokesCommands');
const menuCommandBot = require('./menuCommand');
const gptCommandBot = require('./gptCommand');
const gamesCommandsBot = require('./gamesCommands');
const grokCommandBot = require('./grokCommand');
const banCommandBot = require('./banCommand');
const lyricsCommandBot = require('./lyricsCommand')
const zhipuCommandsBot = require('./zhipuCommands');
const sendJsCommandBot = require('./sendJsCommand');
const levelCommandBot = require('./levelCommand');

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

        const sock = makeWASocket({ auth: state });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
        
            if (qr) {
                console.log("Escaneie o QR Code para conectar:");
                qrcode.generate(qr, { small: true });
            }
        
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const isStreamError = lastDisconnect?.error?.message?.includes('Stream Errored');
        
                const shouldReconnect = statusCode !== 401 || isStreamError;
                console.log("Conexão fechada. Código:", statusCode, "| Stream error:", isStreamError);
                if (shouldReconnect) {
                    console.log("Tentando reconectar...");
                    connectBot();
                } else {
                    console.log("Sessão inválida. Delete a pasta auth_info e reconecte via QR Code.");
                }
            } else if (connection === 'open') {
                console.log("✅ Bot conectado com sucesso!");
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
                await lyricsCommandBot(sock, messages);
		        await banCommandBot(sock, messages);
		        await zhipuCommandsBot(sock, messages);
		        await sendJsCommandBot(sock, messages);
		        await levelCommandBot(sock, messages);
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
