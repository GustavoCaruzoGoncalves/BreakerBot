const path = require('path');
const fs = require('fs');
const admins = require('./adm');

async function sendJsCommandBot(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const chatId = msg.key.remoteJid;
    
    // Identificar o usuário corretamente: em grupos usa participantAlt, em privado usa remoteJid
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = isGroup 
        ? (msg.key.participantAlt || msg.key.participant || msg.key.remoteJid)
        : msg.key.remoteJid;
    
    const messageType = Object.keys(msg.message)[0];
    const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (msg.key.fromMe) return;

    if (textMessage.startsWith("!js")) {
        console.log(`[DEBUG] Comando !js detectado de ${sender} no chat ${chatId}`);

        if (!admins.admins.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: "❌ Você não tem permissão para usar este comando. Apenas administradores podem executar !js.",
            }, { quoted: msg });
            return;
        }

        try {
            const filePath = path.resolve(__dirname, 'jokesCommands.js');
            
            if (!fs.existsSync(filePath)) {
                await sock.sendMessage(chatId, {
                    text: "❌ Arquivo jokesCommands.js não encontrado!",
                }, { quoted: msg });
                return;
            }

            const fileContent = fs.readFileSync(filePath, 'utf8');
            
            await sock.sendMessage(chatId, {
                document: Buffer.from(fileContent, 'utf8'),
                fileName: 'jokesCommands.js',
                mimetype: 'application/javascript',
                caption: '📁 Arquivo jokesCommands.js enviado por comando !js'
            }, { quoted: msg });

            console.log(`[SUCCESS] Arquivo jokesCommands.js enviado para ${chatId}`);

        } catch (error) {
            console.error('[ERROR] Erro ao enviar arquivo:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao enviar o arquivo. Verifique os logs para mais detalhes.",
            }, { quoted: msg });
        }
    }

    if (textMessage.startsWith("!sendJson")) {
        console.log(`[DEBUG] Comando !sendJson detectado de ${sender} no chat ${chatId}`);

        if (!admins.admins.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: "❌ Você não tem permissão para usar este comando. Apenas administradores podem executar !sendJson.",
            }, { quoted: msg });
            return;
        }

        try {
            const filePath = path.resolve(__dirname, 'levels_info', 'users.json');
            
            if (!fs.existsSync(filePath)) {
                await sock.sendMessage(chatId, {
                    text: "❌ Arquivo users.json não encontrado!",
                }, { quoted: msg });
                return;
            }

            const fileContent = fs.readFileSync(filePath, 'utf8');
            
            await sock.sendMessage(chatId, {
                document: Buffer.from(fileContent, 'utf8'),
                fileName: 'users.json',
                mimetype: 'application/json',
                caption: '📊 Arquivo users.json (dados dos usuários) enviado por comando !sendJson'
            }, { quoted: msg });

            console.log(`[SUCCESS] Arquivo users.json enviado para ${chatId}`);

        } catch (error) {
            console.error('[ERROR] Erro ao enviar arquivo users.json:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Erro ao enviar o arquivo users.json. Verifique os logs para mais detalhes.",
            }, { quoted: msg });
        }
    }
}

module.exports = sendJsCommandBot;
