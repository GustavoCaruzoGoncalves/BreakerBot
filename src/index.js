const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const imagesCommandsBot = require('./commands/media/imagesCommands');
const audioCommandsBot = require('./commands/media/audioCommands');
const jokesCommandsBot = require('./commands/fun/jokesCommands');
const gamesCommandsBot = require('./commands/fun/gamesCommands');
const amigoSecretoCommandBot = require('./commands/fun/amigoSecretoCommand');
const menuCommandBot = require('./commands/utility/menuCommand');
const gptCommandBot = require('./commands/ai/gptCommand');
const grokCommandBot = require('./commands/ai/grokCommand');
const zhipuCommandsBot = require('./commands/ai/zhipuCommands');
const banCommandBot = require('./commands/moderation/banCommand');
const lyricsCommandBot = require('./commands/utility/lyricsCommand');
const sendJsCommandBot = require('./commands/utility/sendJsCommand');
const levelCommandBot = require('./commands/level/levelCommand');

const logError = (error) => {
    const errorLogPath = path.join(__dirname, '..', 'data', 'logs', 'error.log');
    const errorMsg = `[${new Date().toISOString()}] ${error.stack || error.message || error}\n`;
    fs.appendFileSync(errorLogPath, errorMsg);
};

process.on('uncaughtException', (err) => {
    console.error('Erro não capturado:', err);
    logError(err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição não tratada em:', promise, 'Motivo:', reason);
    logError(reason);
});

const contactsCache = {};

async function connectBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, '..', 'auth_info'));

        const sock = makeWASocket({ auth: state });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('contacts.update', (updates) => {
            updates.forEach(contact => {
                if (contact.id) {
                    if (!contactsCache[contact.id]) {
                        contactsCache[contact.id] = {};
                    }
                    Object.assign(contactsCache[contact.id], contact);
                }
            });
        });

        sock.ev.on('contacts.upsert', (contacts) => {
            contacts.forEach(contact => {
                if (contact.id) {
                    contactsCache[contact.id] = contact;
                }
            });
        });

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
                console.log('\n========== MENSAGEM RECEBIDA ==========');
                console.log('Timestamp:', new Date().toISOString());
                console.log('Dados completos da API do Baileys:');
                console.log(JSON.stringify(messages, null, 2));
                console.log('========================================\n');
                
                await imagesCommandsBot(sock, messages);
                await audioCommandsBot(sock, messages);
                await jokesCommandsBot(sock, messages, contactsCache);
                await gamesCommandsBot(sock, messages);
                await amigoSecretoCommandBot(sock, messages, contactsCache);
                await menuCommandBot(sock, messages);
                await gptCommandBot(sock, messages);
                await grokCommandBot(sock, messages);
                await lyricsCommandBot(sock, messages);
		        await banCommandBot(sock, messages);
		        await zhipuCommandsBot(sock, messages);
		        await sendJsCommandBot(sock, messages);
		        await levelCommandBot(sock, messages, contactsCache);
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
